export interface ExtractedItem {
  message_id: string
  chat_jid: string
  item_type: 'task' | 'follow_up' | 'action_item' | 'reminder' | 'decision'
  title: string
  description: string | null
  priority: 'high' | 'medium' | 'low'
  due_date: string | null
  assigned_to: string
  source_context: string | null
  routed_to_projectops: boolean
  notified_haley: boolean
}

export interface StoredMessage {
  id: string
  chat_jid: string
  sender_jid: string | null
  sender_name: string | null
  content: string | null
  timestamp: number
  is_from_me: boolean
  processed: boolean
}

export interface ScanResult {
  chat_jid: string
  messages_scanned: number
  items_extracted: number
  scan_started_at: string
  scan_completed_at: string
  status: 'success' | 'error' | 'partial'
}

export interface ConversationInfo {
  jid: string
  name: string | null
  lastMessageTimestamp: number | null
  isGroup: boolean
  participantCount?: number
}

export interface BotConfig {
  scanIntervalMinutes: number
  scanLookbackHours: number
  monitoredChats: string[]
  haleyWhatsAppJid: string
  openrouterApiKey: string
  openrouterDefaultModel: string
  openrouterFallbackModel: string
  anthropicApiKey: string
  supabaseUrl: string
  supabaseServiceKey: string
  projectOpsApiUrl: string
  projectOpsApiKey: string
  crmApiUrl: string
  crmApiKey: string
  logLevel: string
}
