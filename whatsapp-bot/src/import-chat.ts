/**
 * Import a WhatsApp exported chat (.txt) into the bot's SQLite database.
 * Usage: node dist/import-chat.js <chat-file.txt> <chat-jid>
 *
 * Parses the WhatsApp export format:
 *   [M/D/YY, H:MM:SS AM] Sender: message text
 */
import { getDb, closeDb, storeMessage } from './storage'
import fs from 'fs'
import crypto from 'crypto'

const LINE_REGEX = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}:\d{2}\s[AP]M)\]\s(.+?):\s([\s\S]*)$/

function parseExportFile(filePath: string, chatJid: string): void {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  const db = getDb()
  const ownerName = process.env.OWNER_NAME || 'Matty'

  let imported = 0
  let skipped = 0
  let currentMsg: { date: string; time: string; sender: string; content: string } | null = null

  const flushMessage = () => {
    if (!currentMsg) return

    const { date, time, sender, content } = currentMsg
    const trimmed = content.trim()

    // Skip system messages
    if (trimmed.startsWith('\u200e') || trimmed === '' || trimmed.includes('omitted')) {
      skipped++
      currentMsg = null
      return
    }

    // Parse timestamp
    const dateTimeStr = `${date} ${time}`
    const parsed = new Date(dateTimeStr)
    if (isNaN(parsed.getTime())) {
      skipped++
      currentMsg = null
      return
    }

    const timestamp = Math.floor(parsed.getTime() / 1000)
    const isFromMe = sender.toLowerCase() === ownerName.toLowerCase()
    const msgId = crypto.createHash('md5').update(`${chatJid}:${timestamp}:${trimmed.slice(0, 100)}`).digest('hex')

    try {
      storeMessage({
        id: msgId,
        chat_jid: chatJid,
        sender_jid: isFromMe ? null : chatJid,
        sender_name: sender,
        content: trimmed,
        timestamp,
        is_from_me: isFromMe,
        processed: false,
      })
      imported++
    } catch {
      // Duplicate — INSERT OR IGNORE handles this
      skipped++
    }

    currentMsg = null
  }

  for (const line of lines) {
    const match = line.match(LINE_REGEX)
    if (match) {
      // Flush previous message before starting new one
      flushMessage()
      currentMsg = {
        date: match[1],
        time: match[2],
        sender: match[3],
        content: match[4],
      }
    } else if (currentMsg) {
      // Continuation line (multi-line message)
      currentMsg.content += '\n' + line
    }
  }

  // Flush last message
  flushMessage()

  console.log(`Import complete: ${imported} messages imported, ${skipped} skipped (system/duplicates)`)
  console.log(`Chat JID: ${chatJid}`)
}

// CLI entry point
const args = process.argv.slice(2)
if (args.length < 2) {
  console.log('Usage: node dist/import-chat.js <chat-file.txt> <chat-jid>')
  console.log('Example: node dist/import-chat.js _chat.txt 917359961709@s.whatsapp.net')
  process.exit(1)
}

const [filePath, chatJid] = args
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`)
  process.exit(1)
}

parseExportFile(filePath, chatJid)
closeDb()
