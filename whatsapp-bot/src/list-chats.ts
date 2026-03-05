import { connectToWhatsApp } from './connection'
import { getDb, closeDb } from './storage'
import type { ConversationInfo } from './types'

async function main() {
  console.log('Connecting to WhatsApp to list conversations...\n')
  getDb()

  const sock = await connectToWhatsApp()
  const chatMap = new Map<string, any>()

  // Collect chats from all possible events
  sock.ev.on('messaging-history.set', ({ chats }: any) => {
    for (const chat of chats) {
      chatMap.set(chat.id, chat)
    }
    console.log(`  Synced ${chats.length} chats (total: ${chatMap.size})`)
  })

  sock.ev.on('chats.upsert', (chats: any[]) => {
    for (const chat of chats) {
      chatMap.set(chat.id, chat)
    }
  })

  sock.ev.on('chats.update', (updates: any[]) => {
    for (const update of updates) {
      const existing = chatMap.get(update.id!) || {}
      chatMap.set(update.id!, { ...existing, ...update })
    }
  })

  // Wait for connection
  await new Promise<void>((resolve) => {
    sock.ev.on('connection.update', ({ connection }) => {
      if (connection === 'open') resolve()
    })
  })

  console.log('Connected! Waiting for chat sync (15 seconds)...\n')
  await new Promise((r) => setTimeout(r, 15000))

  const conversations: ConversationInfo[] = []
  for (const [id, chat] of chatMap) {
    if (id === 'status@broadcast') continue

    const isGroup = id.endsWith('@g.us')
    let name = chat.name || chat.subject || null

    if (!isGroup && !name) {
      name = id.replace('@s.whatsapp.net', '')
    }

    const ts = chat.conversationTimestamp || chat.lastMessageRecvTimestamp
    conversations.push({
      jid: id,
      name,
      lastMessageTimestamp: ts
        ? typeof ts === 'number' ? ts : ts.low
        : null,
      isGroup,
      participantCount: isGroup ? chat.participants?.length : undefined,
    })
  }

  conversations.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0))

  if (conversations.length > 0) {
    console.log('=== Your WhatsApp Conversations ===\n')
    console.log('  #  | Type  | JID                                    | Name                      | Last Activity')
    console.log('-----|-------|----------------------------------------|---------------------------|--------------------')

    conversations.forEach((c, i) => {
      const type = c.isGroup ? 'GROUP' : 'DM   '
      const name = (c.name || 'Unknown').padEnd(25).slice(0, 25)
      const jid = c.jid.padEnd(38).slice(0, 38)
      const lastActive = c.lastMessageTimestamp
        ? new Date(c.lastMessageTimestamp * 1000).toISOString().slice(0, 16).replace('T', ' ')
        : 'N/A'
      console.log(`  ${String(i + 1).padStart(2)} | ${type} | ${jid} | ${name} | ${lastActive}`)
    })

    console.log(`\nTotal: ${conversations.length} conversations`)
    console.log('\nCopy the JIDs you want to monitor and add them to MONITORED_CHATS in .env (comma-separated).')
  } else {
    console.log('No conversations found. Baileys may need a longer sync time on first connection.')
    console.log('Try running this script again — history sync often arrives in chunks.')
  }

  closeDb()
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err)
  closeDb()
  process.exit(1)
})
