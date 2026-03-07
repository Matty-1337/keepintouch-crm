import { loadConfig } from './config'
import { getSocket } from './connection'
import {
  storeMessage,
  getUnprocessedMessages,
  markMessagesProcessed,
  logScan,
  getDb,
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
    let messages = getUnprocessedMessages(chatJid, sinceTimestamp)

    // If no messages stored, try requesting on-demand history from WhatsApp
    if (messages.length === 0) {
      const totalStored = (getDb().prepare('SELECT COUNT(*) as count FROM messages WHERE chat_jid = ?').get(chatJid) as any)?.count || 0
      if (totalStored === 0) {
        console.log(`[Scanner] ${chatJid}: No messages stored. Requesting on-demand history...`)
        try {
          const sock = getSocket()
          if (sock && (sock as any).fetchMessageHistory) {
            // Request 50 recent messages; use a synthetic anchor at current time
            await (sock as any).fetchMessageHistory(50, {
              remoteJid: chatJid,
              fromMe: false,
              id: '',
            }, Date.now())
            // Wait for history sync response to arrive and be stored
            await new Promise(resolve => setTimeout(resolve, 5000))
            // Re-check for messages
            messages = getUnprocessedMessages(chatJid, sinceTimestamp)
            if (messages.length > 0) {
              console.log(`[Scanner] ${chatJid}: History sync delivered ${messages.length} message(s).`)
            }
          }
        } catch (err) {
          console.log(`[Scanner] ${chatJid}: On-demand history fetch not available: ${(err as Error).message}`)
        }
      }
    }

    if (messages.length === 0) {
      console.log(`[Scanner] ${chatJid}: No unprocessed messages.`)
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
