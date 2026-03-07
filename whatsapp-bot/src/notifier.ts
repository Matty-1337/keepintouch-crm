import { getSocket } from './connection'
import { loadConfig } from './config'
import { getUnnotifiedItems, markItemsNotified } from './storage'
import { formatItemsRich } from './commands'

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

  const header = `📋 *KIT Bot — ${items.length} new item(s)*\n\n━━━━━━━━━━━━━━━━━━━`
  const message = formatItemsRich(items, header) + '\n\n_Reply !status to see all pending items_'

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
