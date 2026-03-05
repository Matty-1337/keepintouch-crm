import { getSocket } from './connection'
import { loadConfig } from './config'
import { getUnnotifiedItems, markItemsNotified } from './storage'

export async function notifyHaley(): Promise<number> {
  const config = loadConfig()
  const sock = getSocket()

  if (!sock) {
    console.warn('[Notifier] Not connected to WhatsApp. Skipping notifications.')
    return 0
  }

  if (!config.haleyWhatsAppJid) {
    console.warn('[Notifier] HALEY_WHATSAPP_JID not set. Skipping notifications.')
    return 0
  }

  const items = getUnnotifiedItems()
  if (items.length === 0) return 0

  console.log(`[Notifier] Sending ${items.length} notification(s) to Haley...`)

  // Group items by priority for a single digest message
  const high = items.filter((i: any) => i.priority === 'high')
  const medium = items.filter((i: any) => i.priority === 'medium')
  const low = items.filter((i: any) => i.priority === 'low')

  const lines: string[] = []
  lines.push(`*KIT Bot — ${items.length} new item(s)*\n`)

  if (high.length > 0) {
    lines.push(`*HIGH PRIORITY:*`)
    for (const item of high) {
      lines.push(`  - ${formatItem(item)}`)
    }
    lines.push('')
  }

  if (medium.length > 0) {
    lines.push(`*Medium:*`)
    for (const item of medium) {
      lines.push(`  - ${formatItem(item)}`)
    }
    lines.push('')
  }

  if (low.length > 0) {
    lines.push(`Low:`)
    for (const item of low) {
      lines.push(`  - ${formatItem(item)}`)
    }
    lines.push('')
  }

  lines.push(`_Reply !status to see all pending items_`)

  const message = lines.join('\n')

  try {
    await sock.sendMessage(config.haleyWhatsAppJid, { text: message })
    const itemIds = items.map((i: any) => i.id)
    markItemsNotified(itemIds)
    console.log(`[Notifier] Sent digest with ${items.length} items to Haley.`)
    return items.length
  } catch (err) {
    console.error('[Notifier] Failed to send notification:', err)
    return 0
  }
}

export async function sendDirectMessage(jid: string, text: string): Promise<boolean> {
  const sock = getSocket()
  if (!sock) {
    console.error('[Notifier] Not connected.')
    return false
  }

  try {
    await sock.sendMessage(jid, { text })
    return true
  } catch (err) {
    console.error(`[Notifier] Failed to send message to ${jid}:`, err)
    return false
  }
}

function formatItem(item: any): string {
  const type = item.item_type.replace('_', ' ')
  let line = `[${type}] ${item.title}`
  if (item.due_date) {
    line += ` (due: ${item.due_date})`
  }
  return line
}
