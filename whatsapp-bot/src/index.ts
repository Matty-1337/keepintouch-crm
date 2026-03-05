import cron from 'node-cron'
import { connectToWhatsApp, onNewMessage, getSocket } from './connection'
import { loadConfig } from './config'
import { getDb, closeDb } from './storage'
import { scanMonitoredChats, storeIncomingMessage } from './scanner'
import { routeToProjectOps, testProjectOpsConnection } from './router'
import { notifyHaley } from './notifier'
import { handleCommand, isCommand } from './commands'

const config = loadConfig()

async function main() {
  console.log('=== KIT WhatsApp Bot ===')
  console.log('Connecting to WhatsApp...\n')

  // Initialize database
  getDb()
  console.log('Database initialized.')

  // Connect to WhatsApp
  const sock = await connectToWhatsApp()

  // Wait for connection
  await new Promise<void>((resolve) => {
    sock.ev.on('connection.update', ({ connection }) => {
      if (connection === 'open') resolve()
    })
  })

  console.log('\nConnected!')

  // Test Project Ops connection
  await testProjectOpsConnection()

  // Listen for all incoming messages
  onNewMessage((msg) => {
    const chatJid = msg.key.remoteJid
    if (!chatJid) return

    const content =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      null

    // Handle bot commands (from any chat)
    if (content && isCommand(content)) {
      const senderJid = msg.key.participant || msg.key.remoteJid || ''
      handleCommand(chatJid, content, senderJid)
      return
    }

    // Store messages from monitored chats
    if (config.monitoredChats.length === 0 || config.monitoredChats.includes(chatJid)) {
      storeIncomingMessage(msg)
    }
  })

  // Schedule periodic scans
  const interval = config.scanIntervalMinutes
  console.log(`\nScheduling scans every ${interval} minutes.`)

  cron.schedule(`*/${interval} * * * *`, async () => {
    console.log(`\n[${new Date().toISOString()}] Running scheduled scan...`)
    try {
      await scanMonitoredChats()
      await routeToProjectOps()
      await notifyHaley()
    } catch (err) {
      console.error('[Cron] Scan cycle error:', err)
    }
  })

  // Status summary
  console.log('\n--- Bot Configuration ---')
  console.log(`  Monitored chats: ${config.monitoredChats.length || 'none (storing all)'}`)
  console.log(`  Haley JID: ${config.haleyWhatsAppJid || 'not set'}`)
  console.log(`  Scan interval: ${interval} min`)
  console.log(`  AI model: ${config.openrouterDefaultModel}`)
  console.log(`  Project Ops: ${config.projectOpsApiUrl || 'not configured'}`)
  console.log('-------------------------')
  console.log('\nBot is running. Send !help in WhatsApp for commands.\n')

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

function shutdown() {
  console.log('\nShutting down...')
  closeDb()
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  closeDb()
  process.exit(1)
})
