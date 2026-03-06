import { loadConfig } from './config'
import {
  storeMessage,
  getUnprocessedMessages,
  markMessagesProcessed,
  logScan,
} from './storage'
import { extractItems } from './extractor'
import type { ScanResult } from './types'

export async function scanMonitoredChats(overrides?: {
  chatJids?: string[]
  lookbackHours?: number
}): Promise<ScanResult[]> {
  const config = loadConfig()
  const chatJids = overrides?.chatJids || config.monitoredChats
  const lookbackHours = overrides?.lookbackHours || config.scanLookbackHours
  const results: ScanResult[] = []

  if (chatJids.length === 0) {
    console.log('[Scanner] No chats to scan.')
    return results
  }

  console.log(`[Scanner] Scanning ${chatJids.length} chat(s), lookback ${lookbackHours}h...`)

  for (const chatJid of chatJids) {
    const result = await scanChat(chatJid, lookbackHours)
    results.push(result)
    logScan(result)
  }

  const totalItems = results.reduce((sum, r) => sum + r.items_extracted, 0)
  console.log(`[Scanner] Scan complete. ${totalItems} items extracted from ${results.length} chat(s).`)

  return results
}

async function scanChat(chatJid: string, lookbackHours: number): Promise<ScanResult> {
  const startedAt = new Date().toISOString()
  const sinceTimestamp = Math.floor((Date.now() - lookbackHours * 60 * 60 * 1000) / 1000)

  try {
    const messages = getUnprocessedMessages(chatJid, sinceTimestamp)

    if (messages.length === 0) {
      console.log(`[Scanner] ${chatJid}: No unprocessed messages (bot only captures messages received after monitoring starts).`)
      return {
        chat_jid: chatJid,
        messages_scanned: 0,
        items_extracted: 0,
        scan_started_at: startedAt,
        scan_completed_at: new Date().toISOString(),
        status: 'success',
      }
    }

    console.log(`[Scanner] ${chatJid}: Processing ${messages.length} message(s)...`)

    const items = await extractItems(messages, chatJid)

    const messageIds = messages.map((m) => m.id)
    markMessagesProcessed(messageIds)

    console.log(`[Scanner] ${chatJid}: Extracted ${items.length} item(s) from ${messages.length} message(s).`)

    return {
      chat_jid: chatJid,
      messages_scanned: messages.length,
      items_extracted: items.length,
      scan_started_at: startedAt,
      scan_completed_at: new Date().toISOString(),
      status: 'success',
    }
  } catch (err) {
    console.error(`[Scanner] Error scanning ${chatJid}:`, err)
    return {
      chat_jid: chatJid,
      messages_scanned: 0,
      items_extracted: 0,
      scan_started_at: startedAt,
      scan_completed_at: new Date().toISOString(),
      status: 'error',
    }
  }
}

export function storeIncomingMessage(msg: any): void {
  const chatJid = msg.key.remoteJid
  if (!chatJid) return

  const content =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    null

  if (!content) return

  storeMessage({
    id: msg.key.id!,
    chat_jid: chatJid,
    sender_jid: msg.key.participant || msg.key.remoteJid || null,
    sender_name: msg.pushName || null,
    content,
    timestamp: typeof msg.messageTimestamp === 'number'
      ? msg.messageTimestamp
      : Number(msg.messageTimestamp),
    is_from_me: !!msg.key.fromMe,
    processed: false,
  })
}
