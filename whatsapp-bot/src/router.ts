import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { loadConfig } from './config'
import { getUnroutedItems, markItemRouted } from './storage'

// Project Ops profile UUIDs
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

function mapPriority(priority: string): string {
  switch (priority) {
    case 'high': return 'High'
    case 'medium': return 'Normal'
    case 'low': return 'Low'
    default: return 'Normal'
  }
}

function mapCategory(itemType: string): string {
  switch (itemType) {
    case 'task': return 'General'
    case 'follow_up': return 'Follow-Up'
    case 'action_item': return 'General'
    case 'reminder': return 'Administrative'
    case 'decision': return 'General'
    default: return 'General'
  }
}

export async function routeToProjectOps(): Promise<number> {
  const items = getUnroutedItems()
  if (items.length === 0) return 0

  const sb = getSupabase()
  if (!sb) {
    console.warn('[Router] Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing). Storing locally only.')
    for (const item of items) {
      markItemRouted(item.id, 'local-only')
    }
    return 0
  }

  console.log(`[Router] Routing ${items.length} item(s) to Project Ops via Supabase...`)
  let routed = 0

  for (const item of items) {
    try {
      const taskId = await insertTask(sb, item)
      await insertHailyDirective(sb, item, taskId)
      markItemRouted(item.id, taskId)
      routed++
      console.log(`[Router] Created task + directive: "${item.title}" (${taskId})`)
    } catch (err) {
      console.error(`[Router] Failed to route item ${item.id}:`, err)
      markItemRouted(item.id, 'route-failed')
    }
  }

  console.log(`[Router] Routed ${routed}/${items.length} items.`)
  return routed
}

async function insertTask(sb: SupabaseClient, item: any): Promise<string> {
  const { data, error } = await sb
    .from('haily_directives')
    .select('id')
    .limit(0)

  // Insert into the tasks table
  const taskRow = {
    title: item.title,
    description: buildTaskDescription(item),
    status: 'New',
    priority: mapPriority(item.priority),
    category: mapCategory(item.item_type),
    subcategory: `WhatsApp ${item.item_type.replace('_', ' ')}`,
    assigned_to: HAILY_PROFILE_ID,
    created_by: CEO_PROFILE_ID,
    due_date: item.due_date || null,
    archived: false,
    instructions: item.source_context
      ? `Source context from WhatsApp:\n> ${item.source_context}`
      : null,
    success_criteria: null,
    estimated_minutes: null,
  }

  const { data: inserted, error: insertErr } = await sb
    .from('haily_directives')
    .insert(taskRow)
    .select('id')
    .single()

  if (insertErr) throw new Error(`Task insert failed: ${insertErr.message}`)
  return inserted.id
}

async function insertHailyDirective(
  sb: SupabaseClient,
  item: any,
  linkedTaskId: string
): Promise<void> {
  const directiveRow = {
    title: item.title,
    description: buildDirectiveDescription(item),
    category: mapCategory(item.item_type),
    priority: mapPriority(item.priority),
    status: 'New',
    created_by: CEO_PROFILE_ID,
    assigned_to: HAILY_PROFILE_ID,
    due_date: item.due_date || null,
    linked_task_id: linkedTaskId,
    instructions: item.source_context
      ? `From WhatsApp conversation:\n> ${item.source_context}`
      : null,
    success_criteria: `Complete the ${item.item_type.replace('_', ' ')} extracted from WhatsApp`,
  }

  const { error } = await sb
    .from('haily_directives')
    .insert(directiveRow)

  if (error) {
    console.warn(`[Router] Directive insert warning: ${error.message}`)
  }
}

function buildTaskDescription(item: any): string {
  const parts: string[] = []

  if (item.description) parts.push(item.description)

  parts.push(`\n---`)
  parts.push(`Extracted by KIT WhatsApp Bot`)
  parts.push(`Source: WhatsApp conversation (${item.chat_jid})`)
  parts.push(`Type: ${item.item_type}`)
  parts.push(`Extracted at: ${item.created_at}`)

  if (item.source_context) {
    parts.push(`\nContext:\n> ${item.source_context}`)
  }

  return parts.join('\n')
}

function buildDirectiveDescription(item: any): string {
  const parts: string[] = []

  if (item.description) parts.push(item.description)

  parts.push(`\nThis ${item.item_type.replace('_', ' ')} was automatically extracted from a WhatsApp conversation by the KIT Bot.`)

  if (item.source_context) {
    parts.push(`\nOriginal context:\n> ${item.source_context}`)
  }

  return parts.join('\n')
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
