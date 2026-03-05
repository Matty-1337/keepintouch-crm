import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  WASocket,
  BaileysEventMap,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import path from 'path'
import qrcode from 'qrcode-terminal'
import type { ConversationInfo } from './types'

const AUTH_DIR = path.resolve(__dirname, '..', 'auth_info')
const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })

let sock: WASocket | null = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 10

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

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      console.log('\n=== SCAN THIS QR CODE WITH WHATSAPP ===\n')
      qrcode.generate(qr, { small: true })

      const encoded = encodeURIComponent(qr)
      const qrUrl = `https://quickchart.io/qr?text=${encoded}&size=300`
      console.log('\nQR Code URL (for headless/Railway):')
      console.log(qrUrl)
      console.log('\n========================================\n')
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      console.log(
        `Connection closed. Status: ${statusCode}. ${shouldReconnect ? 'Reconnecting...' : 'Logged out — not reconnecting.'}`
      )

      if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000)
        console.log(`Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s...`)
        setTimeout(() => connectToWhatsApp(), delay)
      } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnect attempts reached. Please restart the bot.')
      }
    } else if (connection === 'open') {
      reconnectAttempts = 0
      console.log('WhatsApp connection established successfully.')
    }
  })

  return sock
}

export function getSocket(): WASocket | null {
  return sock
}

export async function listConversations(): Promise<ConversationInfo[]> {
  if (!sock) throw new Error('Not connected to WhatsApp')

  const conversations: ConversationInfo[] = []
  const chats = await getChatList()

  for (const chat of chats) {
    const isGroup = chat.id.endsWith('@g.us')
    let name = chat.name || null

    if (!isGroup && !name) {
      name = chat.id.replace('@s.whatsapp.net', '')
    }

    conversations.push({
      jid: chat.id,
      name,
      lastMessageTimestamp: chat.conversationTimestamp
        ? typeof chat.conversationTimestamp === 'number'
          ? chat.conversationTimestamp
          : chat.conversationTimestamp.low
        : null,
      isGroup,
      participantCount: isGroup ? chat.participants?.length : undefined,
    })
  }

  conversations.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0))

  return conversations
}

async function getChatList(): Promise<any[]> {
  if (!sock) return []

  return new Promise((resolve) => {
    const collected: any[] = []
    const timeout = setTimeout(() => resolve(collected), 5000)

    sock!.ev.on('messaging-history.set', ({ chats: syncedChats }) => {
      collected.push(...syncedChats)
      clearTimeout(timeout)
      setTimeout(() => resolve(collected), 2000)
    })
  })
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
