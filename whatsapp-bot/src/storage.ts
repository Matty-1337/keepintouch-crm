import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import type { StoredMessage, ExtractedItem, ScanResult } from './types'

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '..', 'data', 'whatsapp-bot.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema(): void {
  const d = getDb()
  d.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_jid TEXT NOT NULL,
      sender_jid TEXT,
      sender_name TEXT,
      content TEXT,
      timestamp INTEGER NOT NULL,
      is_from_me INTEGER DEFAULT 0,
      processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS extracted_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      chat_jid TEXT NOT NULL,
      item_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      assigned_to TEXT DEFAULT 'Haley Rodriguez',
      source_context TEXT,
      routed_to_projectops INTEGER DEFAULT 0,
      projectops_task_id TEXT,
      notified_haley INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (message_id) REFERENCES messages(id)
    );

    CREATE TABLE IF NOT EXISTS scan_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_jid TEXT NOT NULL,
      messages_scanned INTEGER,
      items_extracted INTEGER,
      scan_started_at TEXT,
      scan_completed_at TEXT,
      status TEXT DEFAULT 'success'
    );

    CREATE TABLE IF NOT EXISTS chat_names (
      jid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jid_mappings (
      lid TEXT PRIMARY KEY,
      phone_jid TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_processed ON messages(processed, chat_jid);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_extracted_routed ON extracted_items(routed_to_projectops);
    CREATE INDEX IF NOT EXISTS idx_extracted_notified ON extracted_items(notified_haley);
    CREATE INDEX IF NOT EXISTS idx_jid_mappings_phone ON jid_mappings(phone_jid);
  `)

  // Migrate: add columns for smart assignment (safe to run on existing DBs)
  const migrations = [
    `ALTER TABLE extracted_items ADD COLUMN who_acts TEXT DEFAULT 'Haily'`,
    `ALTER TABLE extracted_items ADD COLUMN urgency TEXT DEFAULT 'normal'`,
    `ALTER TABLE extracted_items ADD COLUMN category TEXT DEFAULT 'General'`,
    `ALTER TABLE extracted_items ADD COLUMN business_identity TEXT`,
  ]
  for (const sql of migrations) {
    try { d.exec(sql) } catch (_) { /* column already exists */ }
  }
}

export function saveJidMapping(lid: string, phoneJid: string): void {
  const d = getDb()
  d.prepare(`INSERT OR REPLACE INTO jid_mappings (lid, phone_jid, updated_at) VALUES (?, ?, datetime('now'))`).run(lid, phoneJid)
}

export function resolveJid(jid: string): string {
  if (!jid.endsWith('@lid')) return jid
  const d = getDb()
  const row = d.prepare('SELECT phone_jid FROM jid_mappings WHERE lid = ?').get(jid) as any
  return row?.phone_jid || jid
}

export function resolveLidFromPhone(phoneJid: string): string | null {
  const d = getDb()
  const row = d.prepare('SELECT lid FROM jid_mappings WHERE phone_jid = ?').get(phoneJid) as any
  return row?.lid || null
}

export function loadAllJidMappings(): Map<string, string> {
  const d = getDb()
  const rows = d.prepare('SELECT lid, phone_jid FROM jid_mappings').all() as any[]
  const map = new Map<string, string>()
  for (const r of rows) {
    map.set(r.lid, r.phone_jid)
  }
  return map
}

export function saveChatName(jid: string, name: string): void {
  const d = getDb()
  d.prepare(`INSERT OR REPLACE INTO chat_names (jid, name, updated_at) VALUES (?, ?, datetime('now'))`).run(jid, name)
}

export function loadChatNames(): Map<string, string> {
  const d = getDb()
  const rows = d.prepare('SELECT jid, name FROM chat_names').all() as any[]
  const map = new Map<string, string>()
  for (const r of rows) {
    map.set(r.jid, r.name)
  }
  return map
}

export function storeMessage(msg: StoredMessage): void {
  const d = getDb()
  d.prepare(`
    INSERT OR IGNORE INTO messages (id, chat_jid, sender_jid, sender_name, content, timestamp, is_from_me, processed)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(msg.id, msg.chat_jid, msg.sender_jid, msg.sender_name, msg.content, msg.timestamp, msg.is_from_me ? 1 : 0)
}

export function getUnprocessedMessages(chatJid: string, sinceTimestamp: number): StoredMessage[] {
  const d = getDb()
  const rows = d.prepare(`
    SELECT id, chat_jid, sender_jid, sender_name, content, timestamp, is_from_me, processed
    FROM messages
    WHERE chat_jid = ? AND processed = 0 AND timestamp >= ?
    ORDER BY timestamp ASC
  `).all(chatJid, sinceTimestamp) as any[]

  return rows.map(r => ({
    ...r,
    is_from_me: !!r.is_from_me,
    processed: !!r.processed,
  }))
}

export function markMessagesProcessed(messageIds: string[]): void {
  const d = getDb()
  const stmt = d.prepare('UPDATE messages SET processed = 1 WHERE id = ?')
  const txn = d.transaction(() => {
    for (const id of messageIds) {
      stmt.run(id)
    }
  })
  txn()
}

export function storeExtractedItem(item: Omit<ExtractedItem, 'routed_to_projectops' | 'notified_haley'>): number {
  const d = getDb()
  const result = d.prepare(`
    INSERT INTO extracted_items (message_id, chat_jid, item_type, title, description, priority, due_date, assigned_to, source_context, who_acts, urgency, category, business_identity)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.message_id, item.chat_jid, item.item_type, item.title,
    item.description, item.priority, item.due_date, item.assigned_to,
    item.source_context, item.who_acts || 'Haily', item.urgency || 'normal',
    item.category || 'General', item.business_identity || null
  )
  return result.lastInsertRowid as number
}

export function isDuplicateItem(chatJid: string, title: string, hoursBack: number = 48): boolean {
  const d = getDb()
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
  const row = d.prepare(`
    SELECT COUNT(*) as count FROM extracted_items
    WHERE chat_jid = ? AND LOWER(title) = LOWER(?) AND created_at >= ?
  `).get(chatJid, title, cutoff) as any
  return row.count > 0
}

export function getUnroutedItems(): any[] {
  const d = getDb()
  return d.prepare(`
    SELECT * FROM extracted_items WHERE routed_to_projectops = 0
    ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
  `).all()
}

export function markItemRouted(itemId: number, projectOpsTaskId?: string): void {
  const d = getDb()
  d.prepare(`
    UPDATE extracted_items SET routed_to_projectops = 1, projectops_task_id = ? WHERE id = ?
  `).run(projectOpsTaskId || null, itemId)
}

export function getUnnotifiedItems(): any[] {
  const d = getDb()
  return d.prepare(`
    SELECT * FROM extracted_items WHERE notified_haley = 0
    ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
  `).all()
}

export function markItemsNotified(itemIds: number[]): void {
  const d = getDb()
  const stmt = d.prepare('UPDATE extracted_items SET notified_haley = 1 WHERE id = ?')
  const txn = d.transaction(() => {
    for (const id of itemIds) {
      stmt.run(id)
    }
  })
  txn()
}

export function logScan(result: ScanResult): void {
  const d = getDb()
  d.prepare(`
    INSERT INTO scan_log (chat_jid, messages_scanned, items_extracted, scan_started_at, scan_completed_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(result.chat_jid, result.messages_scanned, result.items_extracted, result.scan_started_at, result.scan_completed_at, result.status)
}

export function getLastScanSummary(): any {
  const d = getDb()
  return d.prepare(`
    SELECT chat_jid, messages_scanned, items_extracted, scan_completed_at, status
    FROM scan_log ORDER BY id DESC LIMIT 10
  `).all()
}

export function getRecentExtractedItems(limit: number = 10): any[] {
  const d = getDb()
  return d.prepare(`
    SELECT * FROM extracted_items ORDER BY id DESC LIMIT ?
  `).all(limit)
}

export interface ItemFilter {
  chatJid?: string
  hoursBack?: number
  priority?: string
  limit?: number
}

export function getFilteredItems(filter: ItemFilter): any[] {
  const d = getDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filter.chatJid) {
    conditions.push('chat_jid = ?')
    params.push(filter.chatJid)
  }

  if (filter.hoursBack) {
    const cutoff = new Date(Date.now() - filter.hoursBack * 60 * 60 * 1000).toISOString()
    conditions.push('created_at >= ?')
    params.push(cutoff)
  }

  if (filter.priority) {
    conditions.push('LOWER(priority) = LOWER(?)')
    params.push(filter.priority)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filter.limit || 50

  return d.prepare(`
    SELECT * FROM extracted_items ${where}
    ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, id DESC
    LIMIT ?
  `).all(...params, limit)
}

export function closeDb(): void {
  if (db) {
    db.close()
  }
}
