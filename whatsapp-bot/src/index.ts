import cron from 'node-cron'
import { connectToWhatsApp, onNewMessage, onSocketCreated, closeSocket } from './connection'
import { loadConfig } from './config'
import { getDb, closeDb, resolveJid, saveJidMapping } from './storage'
import { scanMonitoredChats, storeIncomingMessage } from './scanner'
import { routeToProjectOps, testProjectOpsConnection } from './router'
import { notifyHaley } from './notifier'
import { handleCommand, isCommand, registerContactListeners, populateChatNames, setChatName, tryAutoMapLid } from './commands'

const config = loadConfig()
let cronTask: ReturnType<typeof cron.schedule> | null = null
let heartbeatInterval: NodeJS.Timeout | null = null

async function main() {
  console.log('=== KIT WhatsApp Bot ===')
  console.log('Connecting to WhatsApp...\n')

  // Initialize database
  getDb()
  console.log('Database initialized.')

  // Register persistent callbacks BEFORE connecting
  // These survive socket reconnections automatically

  // Re-register contact listeners on every new socket
  onSocketCreated((s) => {
    registerContactListeners()
    console.log('[Connection] Socket created — contact listeners registered.')
  })

  // Register message handler (persists across reconnections)
  // type: 'notify' = real-time, 'append' = pushed from phone, 'history' = history sync
  onNewMessage((msg, type) => {
    try {
      const rawChatJid = msg.key.remoteJid
      if (!rawChatJid) return

      // Resolve LID JIDs to phone number JIDs for matching monitored chats
      const chatJid = resolveJid(rawChatJid)
      const wasResolved = chatJid !== rawChatJid

      const content =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        null

      // Only log real-time messages in detail (history can be noisy)
      if (type === 'notify') {
        const resolvedNote = wasResolved ? ` -> ${chatJid.slice(0, 20)}` : ''
        console.log(`[Message] from=${msg.key.fromMe ? 'me' : (msg.pushName || 'unknown')} chat=${rawChatJid.slice(0, 20)}${resolvedNote} content=${content?.slice(0, 50) || '(media)'}`)
      }

      // Cache DM contact names from pushName + auto-detect LID mappings
      if (msg.pushName && !msg.key.fromMe) {
        if (chatJid.endsWith('@s.whatsapp.net')) {
          setChatName(chatJid, msg.pushName)
        }
        if (rawChatJid.endsWith('@lid')) {
          setChatName(rawChatJid, msg.pushName)
          // Try to auto-map this LID to a monitored phone JID
          if (!wasResolved) {
            tryAutoMapLid(rawChatJid, msg.pushName)
            // Re-resolve after potential mapping
            const newResolved = resolveJid(rawChatJid)
            if (newResolved !== rawChatJid) {
              // Re-run with resolved JID — store the message
              if (config.monitoredChats.includes(newResolved)) {
                console.log(`[Message] Auto-resolved ${rawChatJid} -> ${newResolved}, storing message`)
                const msgToStore = { ...msg, key: { ...msg.key, remoteJid: newResolved } }
                storeIncomingMessage(msgToStore)
              }
              return
            }
          }
        }
      }

      // Handle bot commands ONLY from real-time messages (not history)
      if (type === 'notify' && content && isCommand(content)) {
        console.log(`[Command] Detected: "${content}" from ${chatJid}`)
        const senderJid = msg.key.participant || msg.key.remoteJid || ''
        handleCommand(chatJid, content, senderJid, msg.key.fromMe === true)
        return
      }

      // Store messages from monitored chats (all types: real-time + history)
      // Use the resolved phone JID for storage so scanner can find them
      if (config.monitoredChats.length === 0 || config.monitoredChats.includes(chatJid)) {
        // Override remoteJid with resolved JID before storing
        const msgToStore = wasResolved
          ? { ...msg, key: { ...msg.key, remoteJid: chatJid } }
          : msg
        storeIncomingMessage(msgToStore)
      } else if (rawChatJid.endsWith('@lid') && !wasResolved) {
        // Unresolved LID — log it so we can see which chats are being missed
        console.log(`[Message] Unresolved LID: ${rawChatJid} (not in monitored chats, no mapping found)`)
      }
    } catch (err) {
      console.error('[Message] Error processing message:', err)
    }
  })

  // Connect to WhatsApp (creates first socket, triggers callbacks above)
  const sock = await connectToWhatsApp()

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
