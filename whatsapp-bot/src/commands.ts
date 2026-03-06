import { getSocket } from './connection'
import { loadConfig } from './config'
import {
  getRecentExtractedItems,
  getFilteredItems,
  getLastScanSummary,
  getUnroutedItems,
  getUnnotifiedItems,
  getDb,
} from './storage'
import { scanMonitoredChats } from './scanner'
import { routeToProjectOps } from './router'
import { notifyHaley, sendDirectMessage } from './notifier'
import type { ConversationInfo } from './types'

// Chat name cache — populated from groupFetchAllParticipating
const chatNameCache = new Map<string, string>()

export async function populateChatNames(): Promise<void> {
  const sock = getSocket()
  if (!sock) return

  // Fetch group names
  try {
    const groups = await sock.groupFetchAllParticipating()
    for (const g of Object.values(groups)) {
      chatNameCache.set((g as any).id, (g as any).subject)
    }
  } catch {}

  // Cache contact names from contacts.upsert and contacts.update events
  const cacheContact = (c: any) => {
    const name = c.notify || c.name || c.verifiedName
    if (!name) return
    // Cache by all known IDs: id, lid, phoneNumber-derived JID
    if (c.id) chatNameCache.set(c.id, name)
    if (c.lid) chatNameCache.set(c.lid, name)
    if (c.phoneNumber) {
      const pnJid = c.phoneNumber.replace(/\+/g, '') + '@s.whatsapp.net'
      chatNameCache.set(pnJid, name)
    }
  }

  sock.ev.on('contacts.upsert', (contacts) => contacts.forEach(cacheContact))
  sock.ev.on('contacts.update', (contacts) => contacts.forEach(cacheContact))
}

export function setChatName(jid: string, name: string): void {
  chatNameCache.set(jid, name)
}

function getChatName(jid: string): string {
  return chatNameCache.get(jid) || jid.split('@')[0]
}

const COMMANDS: Record<string, string> = {
  '!help': 'Show available commands',
  '!chats': 'List all synced conversations with JIDs',
  '!status': 'Show bot status and pending items',
  '!scan': 'Scan chats — !scan [name] [Nh]',
  '!route': 'Route pending items to Project Ops',
  '!notify': 'Send pending notifications to Haily',
  '!recent': 'Recent items — !recent [name] [Nh] [high/med/low] [count]',
  '!digest': 'Get digest — !digest [name] [Nh]',
  '!config': 'Show current bot configuration',
}

export async function handleCommand(
  chatJid: string,
  command: string,
  senderJid: string,
  fromMe?: boolean
): Promise<void> {
  const config = loadConfig()

  // Normalize JID comparison: extract phone number from any format
  // Handles both standard (18323981541:XX@s.whatsapp.net) and LID (18323981541:12@lid.whatsapp.net)
  const extractPhone = (jid: string) => jid?.split('@')[0]?.split(':')[0] || ''

  const senderPhone = extractPhone(senderJid)
  const haleyPhone = extractPhone(config.haleyWhatsAppJid)

  const isAuthorized =
    senderJid === config.haleyWhatsAppJid ||
    chatJid === config.haleyWhatsAppJid ||
    (senderPhone && haleyPhone && senderPhone === haleyPhone)

  // Check if message is from the bot's own account
  const sock = getSocket()
  const myJid = sock?.user?.id
  const myPhone = myJid ? extractPhone(myJid) : ''
  const isFromMe = fromMe === true ||
    (myJid && senderJid === myJid) ||
    (myPhone && senderPhone && myPhone === senderPhone)

  if (!isAuthorized && !isFromMe) return

  const parts = command.trim().split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1)

  switch (cmd) {
    case '!help': await replyHelp(chatJid); break
    case '!chats': await replyChats(chatJid); break
    case '!status': await replyStatus(chatJid); break
    case '!scan': await replyScan(chatJid, args); break
    case '!route': await replyRoute(chatJid); break
    case '!notify': await replyNotify(chatJid); break
    case '!recent': await replyRecent(chatJid, args); break
    case '!digest': await replyDigest(chatJid, args); break
    case '!config': await replyConfig(chatJid); break
  }
}

export function isCommand(text: string): boolean {
  return text.startsWith('!') && Object.keys(COMMANDS).includes(text.trim().toLowerCase().split(' ')[0])
}

// --- Argument parsing helpers ---

interface ParsedArgs {
  hours?: number
  name?: string
  priority?: string
  count?: number
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {}
  const nameTokens: string[] = []

  for (const arg of args) {
    const hourMatch = arg.match(/^(\d+)h$/i)
    if (hourMatch) {
      result.hours = parseInt(hourMatch[1], 10)
      continue
    }
    if (/^(high|medium|med|low)$/i.test(arg)) {
      result.priority = arg.toLowerCase() === 'med' ? 'medium' : arg.toLowerCase()
      continue
    }
    if (/^\d+$/.test(arg) && parseInt(arg) <= 500) {
      result.count = parseInt(arg, 10)
      continue
    }
    nameTokens.push(arg)
  }

  if (nameTokens.length > 0) {
    result.name = nameTokens.join(' ')
  }

  return result
}

function resolveChat(name: string): { jid: string; chatName: string } | string {
  const config = loadConfig()
  const search = name.toLowerCase()
  const matches: { jid: string; chatName: string }[] = []

  for (const jid of config.monitoredChats) {
    const chatName = getChatName(jid)
    // Match against display name, or phone number portion of JID
    const phoneNumber = jid.split('@')[0]
    if (chatName.toLowerCase().includes(search) || phoneNumber.includes(search)) {
      matches.push({ jid, chatName })
    }
  }

  if (matches.length === 1) return matches[0]
  if (matches.length === 0) return `No monitored chat matching '${name}'. Run !chats to see your monitored conversations.`
  return `Multiple matches for '${name}':\n${matches.map(m => `  - ${m.chatName} (${m.jid})`).join('\n')}\nBe more specific.`
}

// --- Rich item formatting ---

function formatItemsRich(items: any[], header: string): string {
  const high = items.filter((i: any) => i.priority === 'high')
  const medium = items.filter((i: any) => i.priority === 'medium')
  const low = items.filter((i: any) => i.priority === 'low')
  const routed = items.filter((i: any) => i.routed_to_projectops).length

  const lines: string[] = [header, '']

  const maxShow = 15
  let shown = 0

  if (high.length > 0) {
    lines.push('🔴 *HIGH PRIORITY*\n')
    for (const item of high) {
      if (shown >= maxShow) break
      shown++
      lines.push(formatSingleItem(item, shown))
    }
    lines.push('')
  }

  if (medium.length > 0 && shown < maxShow) {
    lines.push('🟡 *MEDIUM PRIORITY*\n')
    for (const item of medium) {
      if (shown >= maxShow) break
      shown++
      lines.push(formatSingleItem(item, shown))
    }
    lines.push('')
  }

  if (low.length > 0 && shown < maxShow) {
    lines.push('🟢 *LOW PRIORITY*\n')
    for (const item of low) {
      if (shown >= maxShow) break
      shown++
      lines.push(formatSingleItem(item, shown))
    }
    lines.push('')
  }

  if (items.length > maxShow) {
    lines.push(`...and ${items.length - maxShow} more. Check Project Ops for full list.`)
    lines.push('')
  }

  lines.push('━━━━━━━━━━━━━━━━━━━')
  lines.push(`✅ ${routed} item(s) routed to Project Ops`)

  return lines.join('\n')
}

function formatSingleItem(item: any, num: number): string {
  const lines: string[] = []
  lines.push(`${num}. *${item.title}*`)
  if (item.description) {
    lines.push(`   ${item.description.slice(0, 120)}`)
  }
  const chatName = getChatName(item.chat_jid)
  lines.push(`   📌 Source: ${chatName}`)
  lines.push(`   📅 Due: ${item.due_date || 'none set'}`)
  lines.push(`   🏷️ Type: ${item.item_type}`)
  return lines.join('\n')
}

// --- Command handlers ---

async function replyHelp(chatJid: string) {
  const lines = ['*KIT Bot Commands:*\n']
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    lines.push(`${cmd} — ${desc}`)
  }
  lines.push('\n*Examples:*')
  lines.push('!scan Sculpture 48h')
  lines.push('!recent Finance high')
  lines.push('!digest 72h')
  await sendDirectMessage(chatJid, lines.join('\n'))
}

async function replyChats(chatJid: string) {
  const sock = getSocket()
  if (!sock) return

  const config = loadConfig()

  // Fetch groups directly
  let groups: Record<string, any> = {}
  try {
    groups = await sock.groupFetchAllParticipating()
  } catch {}

  // Build chat map starting with groups
  const chatMap = new Map<string, any>()
  for (const [id, g] of Object.entries(groups)) {
    chatMap.set(id, { id, name: g.subject, isGroup: true, members: g.participants?.length })
  }

  // Add DB-known chats
  const db = getDb()
  const dbChats = db.prepare(
    `SELECT DISTINCT chat_jid, MAX(timestamp) as last_ts, COUNT(*) as msg_count
     FROM messages GROUP BY chat_jid ORDER BY last_ts DESC`
  ).all() as any[]

  for (const c of dbChats) {
    if (!chatMap.has(c.chat_jid)) {
      chatMap.set(c.chat_jid, { id: c.chat_jid, name: null, isGroup: c.chat_jid.endsWith('@g.us') })
    }
  }

  // Ensure ALL monitored chats appear (including DMs with no messages yet)
  for (const jid of config.monitoredChats) {
    if (!chatMap.has(jid)) {
      chatMap.set(jid, { id: jid, name: getChatName(jid), isGroup: jid.endsWith('@g.us') })
    }
  }

  const monitored = new Set(config.monitoredChats)
  const conversations = Array.from(chatMap.values())

  const lines = [`*Conversations (${conversations.length}):*\n`]
  for (let i = 0; i < Math.min(conversations.length, 50); i++) {
    const c = conversations[i]
    const type = c.isGroup ? 'GRP' : 'DM'
    const name = c.name || c.id.split('@')[0]
    const mon = monitored.has(c.id) ? ' ✅' : ''
    lines.push(`${i + 1}. [${type}] ${name}${mon}\n   ${c.id}`)
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
      const name = getChatName(s.chat_jid)
      lines.push(`  ${s.scan_completed_at?.slice(0, 16)} — ${name}: ${s.items_extracted} items (${s.status})`)
    }
  }

  await sendDirectMessage(chatJid, lines.join('\n'))
}

async function replyScan(chatJid: string, args: string[]) {
  const parsed = parseArgs(args)
  const lookbackHours = parsed.hours || undefined

  let targetJids: string[] | undefined
  let chatLabel = 'all monitored chats'

  if (parsed.name) {
    const resolved = resolveChat(parsed.name)
    if (typeof resolved === 'string') {
      await sendDirectMessage(chatJid, resolved)
      return
    }
    targetJids = [resolved.jid]
    chatLabel = resolved.chatName
  }

  const hourLabel = lookbackHours ? `${lookbackHours}h` : 'default'
  await sendDirectMessage(chatJid, `⏳ Scanning ${chatLabel} (lookback: ${hourLabel})...`)

  const results = await scanMonitoredChats({
    chatJids: targetJids,
    lookbackHours,
  })

  await routeToProjectOps()

  const totalItems = results.reduce((s, r) => s + r.items_extracted, 0)
  const totalMsgs = results.reduce((s, r) => s + r.messages_scanned, 0)

  if (totalItems === 0) {
    await sendDirectMessage(chatJid,
      `📋 *Scan Results* — ${chatLabel}\n📅 ${new Date().toISOString().slice(0, 10)} | ⏰ Lookback: ${hourLabel} | Scanned: ${totalMsgs} messages\n\nNo actionable items found.`)
    return
  }

  // Fetch the items we just extracted (most recent N)
  const recentItems = getRecentExtractedItems(totalItems)

  const header = `📋 *Scan Results* — ${chatLabel}\n📅 ${new Date().toISOString().slice(0, 10)} | ⏰ Lookback: ${hourLabel} | Found: ${totalItems} items\n\n━━━━━━━━━━━━━━━━━━━`
  const message = formatItemsRich(recentItems, header)

  await sendDirectMessage(chatJid, message)
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

async function replyRecent(chatJid: string, args: string[]) {
  const parsed = parseArgs(args)

  let filterChatJid: string | undefined
  let chatLabel = 'all chats'

  if (parsed.name) {
    const resolved = resolveChat(parsed.name)
    if (typeof resolved === 'string') {
      await sendDirectMessage(chatJid, resolved)
      return
    }
    filterChatJid = resolved.jid
    chatLabel = resolved.chatName
  }

  const items = getFilteredItems({
    chatJid: filterChatJid,
    hoursBack: parsed.hours || (parsed.name ? 168 : undefined), // 7 days default for name filter
    priority: parsed.priority,
    limit: parsed.count || 50,
  })

  if (items.length === 0) {
    await sendDirectMessage(chatJid, 'No items found matching your filters.')
    return
  }

  const filterDesc = [chatLabel]
  if (parsed.hours) filterDesc.push(`${parsed.hours}h`)
  if (parsed.priority) filterDesc.push(parsed.priority)

  const header = `📋 *Recent Items* — ${filterDesc.join(' | ')}\nShowing ${items.length} item(s)\n\n━━━━━━━━━━━━━━━━━━━`
  const message = formatItemsRich(items, header)

  await sendDirectMessage(chatJid, message)
}

async function replyDigest(chatJid: string, args: string[]) {
  const parsed = parseArgs(args)
  const hoursBack = parsed.hours || 24

  let filterChatJid: string | undefined
  let chatLabel = 'all chats'

  if (parsed.name) {
    const resolved = resolveChat(parsed.name)
    if (typeof resolved === 'string') {
      await sendDirectMessage(chatJid, resolved)
      return
    }
    filterChatJid = resolved.jid
    chatLabel = resolved.chatName
  }

  const items = getFilteredItems({
    chatJid: filterChatJid,
    hoursBack,
  })

  if (items.length === 0) {
    await sendDirectMessage(chatJid, `No items in the last ${hoursBack}h for ${chatLabel}.`)
    return
  }

  const header = `📋 *Digest* — ${chatLabel}\n📅 Last ${hoursBack}h | ${items.length} item(s)\n\n━━━━━━━━━━━━━━━━━━━`
  const message = formatItemsRich(items, header)

  await sendDirectMessage(chatJid, message)
}

async function replyConfig(chatJid: string) {
  const config = loadConfig()
  const lines = ['*Bot Configuration:*\n']
  lines.push(`Scan interval: ${config.scanIntervalMinutes} min`)
  lines.push(`Lookback: ${config.scanLookbackHours} hours`)
  lines.push(`Monitored: ${config.monitoredChats.length} chat(s)`)
  for (const jid of config.monitoredChats) {
    lines.push(`  - ${getChatName(jid)}`)
  }
  lines.push(`\nHaily JID: ${config.haleyWhatsAppJid || 'not set'}`)
  lines.push(`AI model: ${config.openrouterDefaultModel}`)
  lines.push(`Supabase: ${config.supabaseUrl ? 'connected' : 'NOT SET'}`)
  lines.push(`OpenRouter key: ${config.openrouterApiKey ? 'set' : 'NOT SET'}`)

  await sendDirectMessage(chatJid, lines.join('\n'))
}
