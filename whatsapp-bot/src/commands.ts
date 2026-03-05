import { getSocket } from './connection'
import { loadConfig } from './config'
import {
  getRecentExtractedItems,
  getLastScanSummary,
  getUnroutedItems,
  getUnnotifiedItems,
  getDb,
} from './storage'
import { scanMonitoredChats } from './scanner'
import { routeToProjectOps } from './router'
import { notifyHaley, sendDirectMessage } from './notifier'
import type { ConversationInfo } from './types'

const COMMANDS: Record<string, string> = {
  '!help': 'Show available commands',
  '!chats': 'List all synced conversations with JIDs',
  '!status': 'Show bot status and pending items',
  '!scan': 'Trigger an immediate scan of monitored chats',
  '!route': 'Route pending items to Project Ops',
  '!notify': 'Send pending notifications to Haley',
  '!recent': 'Show recently extracted items',
  '!config': 'Show current bot configuration',
}

export async function handleCommand(
  chatJid: string,
  command: string,
  senderJid: string
): Promise<void> {
  const config = loadConfig()

  // Only respond to commands from Haley or from self
  const isAuthorized =
    senderJid === config.haleyWhatsAppJid ||
    chatJid === config.haleyWhatsAppJid

  // Also allow commands sent by the bot's own account
  const sock = getSocket()
  const myJid = sock?.user?.id
  const isFromMe = myJid && (senderJid === myJid || senderJid?.includes(myJid.split(':')[0]))

  if (!isAuthorized && !isFromMe) return

  const cmd = command.trim().toLowerCase().split(' ')[0]

  switch (cmd) {
    case '!help':
      await replyHelp(chatJid)
      break
    case '!chats':
      await replyChats(chatJid)
      break
    case '!status':
      await replyStatus(chatJid)
      break
    case '!scan':
      await replyScan(chatJid)
      break
    case '!route':
      await replyRoute(chatJid)
      break
    case '!notify':
      await replyNotify(chatJid)
      break
    case '!recent':
      await replyRecent(chatJid)
      break
    case '!config':
      await replyConfig(chatJid)
      break
  }
}

export function isCommand(text: string): boolean {
  return text.startsWith('!') && Object.keys(COMMANDS).includes(text.trim().toLowerCase().split(' ')[0])
}

async function replyHelp(chatJid: string) {
  const lines = ['*KIT Bot Commands:*\n']
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    lines.push(`${cmd} — ${desc}`)
  }
  await sendDirectMessage(chatJid, lines.join('\n'))
}

async function replyChats(chatJid: string) {
  const sock = getSocket()
  if (!sock) return

  // Collect chats from stored data
  const chatMap = new Map<string, any>()

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 8000)

    sock.ev.on('messaging-history.set', ({ chats }: any) => {
      for (const chat of chats) chatMap.set(chat.id, chat)
    })

    sock.ev.on('chats.upsert', (chats: any[]) => {
      for (const chat of chats) chatMap.set(chat.id, chat)
    })

    // Also check if we already have chats in the DB
    const db = getDb()
    const dbChats = db
      .prepare(
        `SELECT DISTINCT chat_jid, MAX(timestamp) as last_ts, COUNT(*) as msg_count
         FROM messages GROUP BY chat_jid ORDER BY last_ts DESC`
      )
      .all() as any[]

    for (const c of dbChats) {
      if (!chatMap.has(c.chat_jid)) {
        chatMap.set(c.chat_jid, {
          id: c.chat_jid,
          conversationTimestamp: c.last_ts,
          name: null,
        })
      }
    }

    // Give history sync a moment
    setTimeout(() => {
      clearTimeout(timeout)
      resolve()
    }, 3000)
  })

  const conversations: ConversationInfo[] = []
  for (const [id, chat] of chatMap) {
    if (id === 'status@broadcast') continue
    const isGroup = id.endsWith('@g.us')
    const ts = chat.conversationTimestamp || chat.lastMessageRecvTimestamp
    conversations.push({
      jid: id,
      name: chat.name || chat.subject || (isGroup ? null : id.replace('@s.whatsapp.net', '').replace('@lid', '')),
      lastMessageTimestamp: ts ? (typeof ts === 'number' ? ts : ts.low) : null,
      isGroup,
    })
  }

  conversations.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0))

  if (conversations.length === 0) {
    await sendDirectMessage(chatJid, 'No conversations found yet. History may still be syncing.')
    return
  }

  const lines = [`*Conversations (${conversations.length}):*\n`]
  for (let i = 0; i < Math.min(conversations.length, 50); i++) {
    const c = conversations[i]
    const type = c.isGroup ? 'GRP' : 'DM'
    const name = c.name || 'Unknown'
    const ts = c.lastMessageTimestamp
      ? new Date(c.lastMessageTimestamp * 1000).toISOString().slice(0, 10)
      : '?'
    lines.push(`${i + 1}. [${type}] ${name}\n   ${c.jid}\n   Last: ${ts}`)
  }

  if (conversations.length > 50) {
    lines.push(`\n...and ${conversations.length - 50} more`)
  }

  await sendDirectMessage(chatJid, lines.join('\n'))
}

async function replyStatus(chatJid: string) {
  const config = loadConfig()
  const unrouted = getUnroutedItems()
  const unnotified = getUnnotifiedItems()
  const scans = getLastScanSummary() as any[]

  const lines = ['*KIT Bot Status:*\n']
  lines.push(`Monitored chats: ${config.monitoredChats.length || 'none'}`)
  lines.push(`Pending routing: ${unrouted.length} item(s)`)
  lines.push(`Pending notification: ${unnotified.length} item(s)`)

  if (scans.length > 0) {
    lines.push(`\n*Recent scans:*`)
    for (const s of scans.slice(0, 5)) {
      lines.push(
        `  ${s.scan_completed_at?.slice(0, 16)} — ${s.chat_jid?.split('@')[0]}: ${s.items_extracted} items (${s.status})`
      )
    }
  }

  await sendDirectMessage(chatJid, lines.join('\n'))
}

async function replyScan(chatJid: string) {
  await sendDirectMessage(chatJid, 'Scanning monitored chats...')
  const results = await scanMonitoredChats()
  const total = results.reduce((s, r) => s + r.items_extracted, 0)
  await sendDirectMessage(
    chatJid,
    `Scan complete. ${results.length} chat(s) scanned, ${total} item(s) extracted.`
  )
}

async function replyRoute(chatJid: string) {
  await sendDirectMessage(chatJid, 'Routing pending items to Project Ops...')
  const count = await routeToProjectOps()
  await sendDirectMessage(chatJid, `Routed ${count} item(s).`)
}

async function replyNotify(chatJid: string) {
  const count = await notifyHaley()
  if (count > 0) {
    await sendDirectMessage(chatJid, `Sent ${count} notification(s).`)
  } else {
    await sendDirectMessage(chatJid, 'No pending notifications.')
  }
}

async function replyRecent(chatJid: string) {
  const items = getRecentExtractedItems(10) as any[]
  if (items.length === 0) {
    await sendDirectMessage(chatJid, 'No extracted items yet.')
    return
  }

  const lines = ['*Recent Extracted Items:*\n']
  for (const item of items) {
    const routed = item.routed_to_projectops ? 'routed' : 'pending'
    const notified = item.notified_haley ? 'notified' : 'quiet'
    lines.push(
      `- [${item.priority}] ${item.title}\n  Type: ${item.item_type} | ${routed} | ${notified}\n  ${item.created_at}`
    )
  }

  await sendDirectMessage(chatJid, lines.join('\n'))
}

async function replyConfig(chatJid: string) {
  const config = loadConfig()
  const lines = ['*Bot Configuration:*\n']
  lines.push(`Scan interval: ${config.scanIntervalMinutes} min`)
  lines.push(`Lookback: ${config.scanLookbackHours} hours`)
  lines.push(`Monitored: ${config.monitoredChats.length ? config.monitoredChats.join(', ') : 'none'}`)
  lines.push(`Haley JID: ${config.haleyWhatsAppJid || 'not set'}`)
  lines.push(`AI model: ${config.openrouterDefaultModel}`)
  lines.push(`Project Ops: ${config.projectOpsApiUrl || 'not set'}`)
  lines.push(`OpenRouter key: ${config.openrouterApiKey ? 'set' : 'NOT SET'}`)

  await sendDirectMessage(chatJid, lines.join('\n'))
}
