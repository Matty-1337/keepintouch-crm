import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  WASocket,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import fs from 'fs'
import pino from 'pino'
import path from 'path'
import qrcode from 'qrcode-terminal'
import type { ConversationInfo } from './types'

const AUTH_DIR = process.env.AUTH_DIR || path.resolve(__dirname, '..', 'auth_info')

// Clear auth state if CLEAR_AUTH=true (for recovering from corrupt sessions)
if (process.env.CLEAR_AUTH === 'true' && fs.existsSync(AUTH_DIR)) {
  console.log('CLEAR_AUTH=true — removing old auth state...')
  fs.rmSync(AUTH_DIR, { recursive: true })
}

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
}
const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })

let sock: WASocket | null = null
let reconnectAttempts = 0
let lastConnectedAt: number | null = null
let disconnectedSince: number | null = null
let pairingCodeRequested = false

const MAX_RECONNECT_ATTEMPTS = 20
const MAX_BACKOFF_MS = 60000

export function getUptime(): number {
  return lastConnectedAt ? Math.floor((Date.now() - lastConnectedAt) / 1000) : 0
}

export async function connectToWhatsApp(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  console.log(`Using WA version: ${version.join('.')}`)

  sock = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu('KIT-Bot'),
    syncFullHistory: true,
    logger,
    version,
  })

  sock.ev.on('creds.update', saveCreds)

  // Pairing code support for headless (Railway)
  const usePairingCode = process.env.USE_PAIRING_CODE === 'true'
  const pairingPhone = process.env.PAIRING_PHONE_NUMBER

  if (usePairingCode && pairingPhone && !state.creds.registered && !pairingCodeRequested) {
    pairingCodeRequested = true
    // Wait for socket to be ready before requesting pairing code
    setTimeout(async () => {
      try {
        console.log(`Requesting pairing code for ${pairingPhone}...`)
        const code = await sock!.requestPairingCode(pairingPhone)
        console.log(`\n========================================`)
        console.log(`PAIRING CODE: ${code}`)
        console.log(`Enter this code in WhatsApp > Linked Devices > Link with phone number`)
        console.log(`Phone number: ${pairingPhone}`)
        console.log(`========================================\n`)
      } catch (err) {
        console.error('Failed to request pairing code:', err)
      }
    }, 5000)
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      const encoded = encodeURIComponent(qr)
      const qrUrl = `https://quickchart.io/qr?text=${encoded}&size=300`
      console.log('\n========================================')
      console.log('SCAN THIS QR CODE:')
      console.log(qrUrl)
      console.log('========================================\n')
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      disconnectedSince = disconnectedSince || Date.now()

      if (statusCode === DisconnectReason.loggedOut) {
        console.error(
          '\n[CONNECTION] ❌ WhatsApp session LOGGED OUT.\n' +
          'To re-authenticate:\n' +
          '  1. Delete auth_info/ directory\n' +
          '  2. Restart the bot\n' +
          '  3. Scan the new QR code or use pairing code\n'
        )
        return
      }

      const disconnectedMs = Date.now() - disconnectedSince
      if (disconnectedMs > 5 * 60 * 1000) {
        console.warn(`[CONNECTION] ⚠️ Disconnected for ${Math.floor(disconnectedMs / 60000)} minutes.`)
      }

      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), MAX_BACKOFF_MS)
        console.log(`[CONNECTION] Reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${(delay / 1000).toFixed(0)}s (status: ${statusCode})`)
        setTimeout(() => connectToWhatsApp(), delay)
      } else {
        console.error('[CONNECTION] Max reconnect attempts reached. Waiting 5 minutes before resetting counter...')
        setTimeout(() => {
          reconnectAttempts = 0
          connectToWhatsApp()
        }, 5 * 60 * 1000)
      }
    } else if (connection === 'open') {
      reconnectAttempts = 0
      disconnectedSince = null
      lastConnectedAt = lastConnectedAt || Date.now()
      console.log('WhatsApp connection established successfully.')
    }
  })

  return sock
}

export function getSocket(): WASocket | null {
  return sock
}

export async function closeSocket(): Promise<void> {
  if (sock) {
    try {
      sock.end(undefined)
    } catch {}
    sock = null
  }
}

export function onNewMessage(callback: (msg: any) => void): void {
  if (!sock) throw new Error('Not connected to WhatsApp')

  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message) continue
      callback(msg)
    }
  })
}
