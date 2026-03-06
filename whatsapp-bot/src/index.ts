import cron from 'node-cron'
import { connectToWhatsApp, onNewMessage, closeSocket } from './connection'
import { loadConfig } from './config'
import { getDb, closeDb } from './storage'
import { scanMonitoredChats, storeIncomingMessage } from './scanner'
import { routeToProjectOps, testProjectOpsConnection } from './router'
import { notifyHaley } from './notifier'
import { handleCommand, isCommand, registerContactListeners, populateChatNames, setChatName } from './commands'

const config = loadConfig()
let cronTask: ReturnType<typeof cron.schedule> | null = null
let heartbeatInterval: NodeJS.Timeout | null = null

async function main() {
  console.log('=== KIT WhatsApp Bot ===')
  console.log('Connecting to WhatsApp...\n')

  // Initialize database
  getDb()
  console.log('Database initialized.')

  // Connect to WhatsApp
  const sock = await connectToWhatsApp()

  // Register contact listeners BEFORE connection opens
  // so we catch contacts.upsert events during initial sync
  registerContactListeners()

  // Wait for connection
  await new Promise<void>((resolve) => {
    sock.ev.on('connection.update', ({ connection }) => {
      if (connection === 'open') resolve()
    })
  })

  console.log('\nConnected!')

  // Load persisted names + fetch group names
  await populateChatNames()

  // Test Project Ops connection
  await testProjectOpsConnection()

  // Listen for all incoming messages
  onNewMessage((msg) => {
    try {
      const chatJid = msg.key.remoteJid
      if (!chatJid) return

      // Cache DM contact names from pushName
      if (msg.pushName && chatJid.endsWith('@s.whatsapp.net') && !msg.key.fromMe) {
        setChatName(chatJid, msg.pushName)
      }

      const content =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        null

      // Handle bot commands (from any chat)
      if (content && isCommand(content)) {
        const senderJid = msg.key.participant || msg.key.remoteJid || ''
        handleCommand(chatJid, content, senderJid, msg.key.fromMe === true)
        return
      }

      // Store messages from monitored chats
      if (config.monitoredChats.length === 0 || config.monitoredChats.includes(chatJid)) {
        storeIncomingMessage(msg)
      }
    } catch (err) {
      console.error('[Message] Error processing message:', err)
    }
  })

  // Schedule periodic scans
  const interval = config.scanIntervalMinutes
  console.log(`\nScheduling scans every ${interval} minutes.`)

  cronTask = cron.schedule(`*/${interval} * * * *`, async () => {
    console.log(`\n[${new Date().toISOString()}] Running scheduled scan...`)
    try {
      await scanMonitoredChats()
      await routeToProjectOps()
      await notifyHaley()
    } catch (err) {
      console.error('[Cron] Scan cycle error:', err)
    }
  })

  // Heartbeat every 5 minutes (for Railway health monitoring)
  heartbeatInterval = setInterval(() => {
    const mem = process.memoryUsage()
    console.log(
      `[Heartbeat] ${new Date().toISOString()} | RSS: ${Math.round(mem.rss / 1024 / 1024)}MB | Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`
    )
  }, 5 * 60 * 1000)

  // Status summary
  console.log('\n--- Bot Configuration ---')
  console.log(`  Monitored chats: ${config.monitoredChats.length || 'none (storing all)'}`)
  console.log(`  Haily JID: ${config.haleyWhatsAppJid || 'not set'}`)
  console.log(`  Scan interval: ${interval} min`)
  console.log(`  AI model: ${config.openrouterDefaultModel}`)
  console.log(`  Supabase: ${config.supabaseUrl ? 'connected' : 'not configured'}`)
  console.log('-------------------------')
  console.log('\nBot is running. Send !help in WhatsApp for commands.\n')

  process.on('SIGINT', gracefulShutdown)
  process.on('SIGTERM', gracefulShutdown)
}

async function gracefulShutdown() {
  console.log('\n[Shutdown] Graceful shutdown initiated...')

  // Stop cron
  if (cronTask) {
    cronTask.stop()
    console.log('[Shutdown] Cron stopped.')
  }

  // Stop heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }

  // Close WhatsApp socket
  await closeSocket()
  console.log('[Shutdown] WhatsApp socket closed.')

  // Close database
  closeDb()
  console.log('[Shutdown] Database closed.')

  console.log('[Shutdown] Complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  closeDb()
  process.exit(1)
})
