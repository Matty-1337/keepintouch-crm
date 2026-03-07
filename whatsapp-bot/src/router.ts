import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { loadConfig } from './config'
import { getUnroutedItems, markItemRouted } from './storage'
import type { ExtractionResult } from './extractor'

const HAILY_PROFILE_ID = '754954b4-2c7c-4c14-86ee-f81943098f26'
const CEO_PROFILE_ID = '6d8b760d-af8a-4755-8236-9cf364264498'

let supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase

  const config = loadConfig()
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    return null
  }

  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)
  return supabase
}

// Valid categories per DB CHECK constraint
const VALID_CATEGORIES = [
  'Communication', 'Follow-Up', 'Research', 'Scheduling',
  'Administrative', 'Procurement', 'Financial', 'Project Support',
  'Personal', 'General',
]

function mapCategory(item: any): string {
  // Use AI-provided category if valid
  if (item.category && VALID_CATEGORIES.includes(item.category)) {
    return item.category
  }

  // Fallback: keyword-based categorization from title + description
  const text = `${item.title} ${item.description || ''} ${item.source_context || ''}`.toLowerCase()

  if (/payment|invoice|cost|budget|money|pricing|pay|financial/.test(text)) return 'Financial'
  if (/follow.?up|check.?in|update.?on|remind|status/.test(text)) return 'Follow-Up'
  if (/meeting|call|schedule|appointment|calendar/.test(text)) return 'Scheduling'
  if (/vendor|contractor|freelancer|hiring|recruit/.test(text)) return 'Procurement'
  if (/document|file|report|proposal|contract|pdf/.test(text)) return 'Administrative'
  if (/code|github|deploy|build|app|dashboard|website|database|api|server/.test(text)) return 'Project Support'
  if (/email|message|contact|reach.?out|tell|share|send/.test(text)) return 'Communication'
  if (/research|look.?into|find.?out|compare|investigate/.test(text)) return 'Research'
  if (/personal|family|health|travel/.test(text)) return 'Personal'

  // Map by item_type as last resort
  if (item.item_type === 'follow_up') return 'Follow-Up'
  if (item.item_type === 'reminder') return 'Scheduling'

  return 'General'
}

function mapPriority(item: any): string {
  // Use AI-provided urgency if available
  const urgency = item.urgency || item.priority || 'normal'

  // Check for urgent keywords in content
  const text = `${item.title} ${item.description || ''} ${item.source_context || ''}`.toLowerCase()
  if (/asap|urgent|immediately|deadline|expir/.test(text)) return 'Urgent'

  switch (urgency) {
    case 'urgent': return 'Urgent'
    case 'high': return 'High'
    case 'medium':
    case 'normal': return 'Normal'
    case 'low': return 'Low'
    default: return 'Normal'
  }
}

function computeDueDate(item: any): string {
  // If AI extracted an explicit due date, use it
  if (item.due_date) return item.due_date

  const now = new Date()
  const text = `${item.title} ${item.description || ''} ${item.source_context || ''}`.toLowerCase()
  const priority = mapPriority(item)

  // Urgent / payment / deadline → today
  if (priority === 'Urgent' || /payment|pay now|deadline|expir/.test(text)) {
    return formatDate(now)
  }

  // High priority → tomorrow
  if (priority === 'High') {
    return formatDate(addDays(now, 1))
  }

  // Follow-ups → 2 days
  if (item.item_type === 'follow_up' || /follow.?up|check.?in|remind/.test(text)) {
    return formatDate(addDays(now, 2))
  }

  // Normal tasks → tomorrow
  if (item.item_type === 'task' || item.item_type === 'action_item') {
    return formatDate(addDays(now, 1))
  }

  // Everything else → next Monday or 3 days, whichever is sooner
  const threeDays = addDays(now, 3)
  const nextMonday = getNextMonday(now)
  return formatDate(threeDays < nextMonday ? threeDays : nextMonday)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getNextMonday(date: Date): Date {
  const result = new Date(date)
  const day = result.getDay()
  const daysUntilMonday = day === 0 ? 1 : (8 - day)
  result.setDate(result.getDate() + daysUntilMonday)
  return result
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getChatDisplayName(chatJid: string): string {
  // Extract phone number from JID
  const phone = chatJid.split('@')[0]
  return phone
}

function buildDescription(item: any, chatJid: string): string {
  const who = item.who_acts || 'Haily'
  const desc = item.description || item.title
  const chatName = getChatDisplayName(chatJid)
  const extractedAt = item.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19)

  const parts: string[] = []

  // WHO: Action statement
  parts.push(`${who}: ${desc}`)
  parts.push('')

  // Source info
  parts.push(`Source: WhatsApp with ${chatName}`)
  parts.push(`Extracted: ${extractedAt}`)

  // Context quote
  if (item.source_context) {
    parts.push('')
    parts.push('Context:')
    parts.push(`> ${item.source_context}`)
  }

  // Action for Haily
  parts.push('')
  parts.push('Action for Haily:')

  if (who === 'Matt' || who.toLowerCase() === 'matty') {
    parts.push(`- Schedule this for Matt. Add to Reclaim calendar by due date.`)
  } else if (who === 'Haily' || who === 'Haley Rodriguez') {
    parts.push(`- Complete this directly. Update status when done.`)
  } else {
    parts.push(`- Follow up with ${who} about this. Remind them if no response by due date.`)
  }

  return parts.join('\n')
}

export async function routeToProjectOps(): Promise<number> {
  const items = getUnroutedItems()
  if (items.length === 0) return 0

  const sb = getSupabase()
  if (!sb) {
    console.warn('[Router] Supabase not configured. Storing locally only.')
    for (const item of items) {
      markItemRouted(item.id, 'local-only')
    }
    return 0
  }

  console.log(`[Router] Routing ${items.length} item(s) to Project Ops...`)
  let routed = 0

  for (const item of items) {
    try {
      const id = await insertDirective(sb, item)
      markItemRouted(item.id, id)
      routed++
      console.log(`[Router] Created directive: "${item.title}" (${id}) due=${computeDueDate(item)} cat=${mapCategory(item)}`)
    } catch (err) {
      console.error(`[Router] Failed to route item ${item.id}:`, err)
      markItemRouted(item.id, 'route-failed')
    }
  }

  console.log(`[Router] Routed ${routed}/${items.length} items.`)
  return routed
}

async function insertDirective(sb: SupabaseClient, item: any): Promise<string> {
  const category = mapCategory(item)
  const priority = mapPriority(item)
  const dueDate = computeDueDate(item)

  const row = {
    title: item.title,
    description: buildDescription(item, item.chat_jid),
    category,
    subcategory: `WhatsApp ${(item.item_type || 'task').replace('_', ' ')}`,
    priority,
    status: 'New',
    due_date: dueDate,
    created_by: CEO_PROFILE_ID,
    assigned_to: HAILY_PROFILE_ID,
    business_identity: item.business_identity || null,
  }

  const { data, error } = await sb
    .from('haily_directives')
    .insert(row)
    .select('id')
    .single()

  if (error) throw new Error(`Directive insert failed: ${error.message}`)
  return data.id
}

export async function testProjectOpsConnection(): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) {
    console.log('[Router] Supabase not configured — routing will store locally only.')
    console.log('[Router] Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env to enable.')
    return false
  }

  try {
    const { count, error } = await sb
      .from('haily_directives')
      .select('id', { count: 'exact', head: true })

    if (error) {
      console.warn(`[Router] Supabase connection test failed: ${error.message}`)
      return false
    }

    console.log(`[Router] Supabase connection OK. Haily directives table has ${count} row(s).`)
    return true
  } catch (err) {
    console.warn('[Router] Cannot reach Supabase:', err)
    return false
  }
}
