import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { loadConfig } from './config'
import { getUnroutedItems, markItemRouted, loadChatNames } from './storage'

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

// --- Smart Assignment Types ---

interface RoutingDecision {
  autoCreateTask: boolean
  smartList: 'Do Next' | 'Delegated' | 'Someday' | null
  myDay: boolean
  taskDueDate: string | null
  taskPriority: 'High' | 'Medium' | 'Low'
  directivePriority: 'Urgent' | 'High' | 'Normal' | 'Low'
  directiveDueDate: string | null
  category: string
}

// --- Classification Logic ---

function classifyItem(item: any): RoutingDecision {
  const whoActs = (item.who_acts || 'Haily').toLowerCase()
  const urgency = item.urgency || 'normal'
  const category = mapCategory(item)
  const text = `${item.title} ${item.description || ''} ${item.source_context || ''}`.toLowerCase()

  // STEP 1: Determine if Matt needs a task
  const autoCreateTask = shouldCreateTaskForMatt(whoActs, category, urgency, text)

  // STEP 2: Determine smart routing for Matt's task
  let smartList: RoutingDecision['smartList'] = null
  let myDay = false
  let taskDueDate: string | null = null

  if (autoCreateTask) {
    const routing = computeSmartRouting(whoActs, urgency, category, text, item.due_date)
    smartList = routing.smartList
    myDay = routing.myDay
    taskDueDate = routing.dueDate
  }

  // STEP 3: Map priorities
  const directivePriority = mapDirectivePriority(urgency, text)
  const taskPriority = mapTaskPriority(directivePriority)

  // STEP 4: Directive due date
  const directiveDueDate = computeDirectiveDueDate(item, directivePriority, text)

  return {
    autoCreateTask,
    smartList,
    myDay,
    taskDueDate,
    taskPriority,
    directivePriority,
    directiveDueDate,
    category,
  }
}

function shouldCreateTaskForMatt(whoActs: string, category: string, urgency: string, text: string): boolean {
  // RULE 3: Haily-only items — NO task for Matt
  if (isHailyOnlyTask(whoActs, category, text)) return false

  // RULE 2a: Matt is the actor
  if (whoActs === 'matt' || whoActs === 'matty') return true

  // RULE 2b: Decision only Matt can make
  if (/\b(approve|sign off|decide|authorize|hire|fire|buy|invest|commit to)\b/.test(text)) return true

  // RULE 2c: Matt's personal execution
  if (/\b(check (it |this )?yourself|review (it |this )?yourself|be present|attend|matt (should|needs|must|will))\b/.test(text)) return true

  // RULE 2d: Payment or financial approval
  if (category === 'Financial' && /\b(pay|payment|invoice|approve|transfer|send money|wire)\b/.test(text)) return true

  // RULE 2e: Hard deadline Matt must meet
  if ((urgency === 'urgent' || urgency === 'high') && (whoActs === 'matt' || whoActs === 'matty')) return true

  // RULE 2f: Delegated to third party — Matt tracks
  if (isThirdPartyActor(whoActs)) return true

  return false
}

function isHailyOnlyTask(whoActs: string, category: string, text: string): boolean {
  // RULE 3a: Scheduling/logistics Haily handles
  if (category === 'Scheduling' && (whoActs === 'haily' || whoActs === 'haley' || whoActs === 'haley rodriguez')) {
    if (/\b(schedule|book|set up|arrange|coordinate|organize|reschedule|cancel)\b/.test(text)) return true
  }

  // RULE 3b: Administrative tasks Haily does routinely
  if (whoActs === 'haily' || whoActs === 'haley' || whoActs === 'haley rodriguez') {
    if (/\b(update (the )?calendar|send (the |a )?file|confirm (the )?meeting|send (a )?reminder|follow up with|check in with|forward|share (the |a )?document)\b/.test(text)) return true
  }

  // RULE 3c: Matt is NOT the executor — third party doing it, and it's just informational
  if (isThirdPartyActor(whoActs)) {
    // Only Haily-only if it's purely informational with no tracking needed from Matt
    if (/\b(will send|will share|will forward|will email|will provide)\b/.test(text)) {
      // But if it's something Matt needs to review/act on when received, still create task
      if (!/\b(review|approve|check|decide|sign|pay)\b/.test(text)) {
        // This is a delegated item — Matt should track it (handled by shouldCreateTaskForMatt)
        // So we don't return true here; let the delegation logic handle it
        return false
      }
    }
  }

  // RULE 3d: FYI/informational
  if (/\b(fyi|for your (info|information|reference)|no action (needed|required)|just (letting|so) you know)\b/.test(text)) return true

  return false
}

function isThirdPartyActor(whoActs: string): boolean {
  const hailyNames = ['haily', 'haley', 'haley rodriguez']
  const mattNames = ['matt', 'matty']
  return !hailyNames.includes(whoActs) && !mattNames.includes(whoActs)
}

function computeSmartRouting(
  whoActs: string,
  urgency: string,
  category: string,
  text: string,
  explicitDueDate: string | null
): { smartList: RoutingDecision['smartList']; myDay: boolean; dueDate: string | null } {
  const today = formatDate(new Date())
  const tomorrow = formatDate(addDays(new Date(), 1))

  // Delegated to third party
  if (isThirdPartyActor(whoActs)) {
    return { smartList: 'Delegated', myDay: false, dueDate: null }
  }

  // Use explicit due date if AI extracted one
  if (explicitDueDate) {
    const isToday = explicitDueDate === today
    return { smartList: null, myDay: isToday, dueDate: explicitDueDate }
  }

  // Payment / expiring link → today + My Day
  if (/\b(payment|pay now|expir|link will expire|pay.*soon|invoice.*due)\b/.test(text)) {
    return { smartList: null, myDay: true, dueDate: today }
  }

  // Decision needed urgently → today + My Day
  if (urgency === 'urgent' && /\b(approve|decide|sign|authorize)\b/.test(text)) {
    return { smartList: null, myDay: true, dueDate: today }
  }

  // Urgent → today
  if (urgency === 'urgent') {
    return { smartList: null, myDay: true, dueDate: today }
  }

  // High priority, Matt must do within 24h → tomorrow
  if (urgency === 'high') {
    return { smartList: null, myDay: false, dueDate: tomorrow }
  }

  // ASAP language
  if (/\basap\b/.test(text)) {
    return { smartList: null, myDay: false, dueDate: tomorrow }
  }

  // "This week" language
  if (/\b(this week|by (friday|end of week))\b/.test(text)) {
    const friday = getNextWeekday(new Date(), 5) // Friday
    return { smartList: null, myDay: false, dueDate: formatDate(friday) }
  }

  // Normal priority with clear action → Do Next
  if (urgency === 'normal' && (category === 'Financial' || category === 'Project Support')) {
    return { smartList: 'Do Next', myDay: false, dueDate: null }
  }

  // Low priority, no deadline → Someday
  if (urgency === 'low') {
    return { smartList: 'Someday', myDay: false, dueDate: null }
  }

  // Default: Do Next
  return { smartList: 'Do Next', myDay: false, dueDate: null }
}

// --- Priority Mapping ---

function mapDirectivePriority(urgency: string, text: string): 'Urgent' | 'High' | 'Normal' | 'Low' {
  if (/\basap\b|urgent|immediately|deadline|expir/.test(text)) return 'Urgent'
  if (urgency === 'urgent') return 'Urgent'
  if (urgency === 'high') return 'High'
  if (/\b(payment|invoice|approve|decision)\b/.test(text) && urgency !== 'low') return 'High'
  if (urgency === 'low') return 'Low'
  if (/\b(fyi|informational|no action)\b/.test(text)) return 'Low'
  return 'Normal'
}

function mapTaskPriority(directivePriority: 'Urgent' | 'High' | 'Normal' | 'Low'): 'High' | 'Medium' | 'Low' {
  // Tasks table uses High/Medium/Low (no Urgent, no Normal)
  switch (directivePriority) {
    case 'Urgent': return 'High'
    case 'High': return 'High'
    case 'Normal': return 'Medium'
    case 'Low': return 'Low'
  }
}

// --- Category Mapping ---

function mapCategory(item: any): string {
  // Use AI-provided category if valid
  if (item.category && VALID_CATEGORIES.includes(item.category)) {
    return item.category
  }

  // Fallback: keyword-based categorization
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

  if (item.item_type === 'follow_up') return 'Follow-Up'
  if (item.item_type === 'reminder') return 'Scheduling'

  return 'General'
}

// --- Due Date Helpers ---

function computeDirectiveDueDate(item: any, priority: string, text: string): string {
  if (item.due_date) return item.due_date

  const now = new Date()

  if (priority === 'Urgent' || /payment|pay now|deadline|expir/.test(text)) {
    return formatDate(now)
  }
  if (priority === 'High') {
    return formatDate(addDays(now, 1))
  }
  if (item.item_type === 'follow_up' || /follow.?up|check.?in|remind/.test(text)) {
    return formatDate(addDays(now, 2))
  }
  if (item.item_type === 'task' || item.item_type === 'action_item') {
    return formatDate(addDays(now, 1))
  }

  const threeDays = addDays(now, 3)
  const nextMonday = getNextWeekday(now, 1)
  return formatDate(threeDays < nextMonday ? threeDays : nextMonday)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function getNextWeekday(date: Date, targetDay: number): Date {
  const result = new Date(date)
  const currentDay = result.getDay()
  let daysUntil = targetDay - currentDay
  if (daysUntil <= 0) daysUntil += 7
  result.setDate(result.getDate() + daysUntil)
  return result
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// --- Description Builders ---

function getChatDisplayName(chatJid: string): string {
  const chatNames = loadChatNames()
  return chatNames.get(chatJid) || chatJid.split('@')[0]
}

function buildDirectiveDescription(item: any, chatJid: string, decision: RoutingDecision): string {
  const who = item.who_acts || 'Haily'
  const desc = item.description || item.title
  const chatName = getChatDisplayName(chatJid)
  const extractedAt = item.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19)

  const parts: string[] = []

  parts.push(`${who}: ${desc}`)
  parts.push('')
  parts.push(`Source: WhatsApp with ${chatName}`)
  parts.push(`Extracted: ${extractedAt}`)

  if (item.source_context) {
    parts.push('')
    parts.push('Context:')
    parts.push(`> ${item.source_context}`)
  }

  parts.push('')
  parts.push('Action for Haily:')

  if (decision.autoCreateTask) {
    if (decision.smartList === 'Delegated') {
      parts.push(`- Follow up with ${who} on this. A tracking task has been created for Matt.`)
    } else {
      const dueInfo = decision.taskDueDate ? ` by ${decision.taskDueDate}` : ''
      parts.push(`- Matt has a task for this${dueInfo}. Support as needed.`)
    }
  } else {
    const whoLower = who.toLowerCase()
    if (whoLower === 'matt' || whoLower === 'matty') {
      parts.push(`- Schedule this for Matt. Add to Reclaim calendar by due date.`)
    } else if (whoLower === 'haily' || whoLower === 'haley' || whoLower === 'haley rodriguez') {
      parts.push(`- Complete this directly. Update status when done.`)
    } else {
      parts.push(`- Follow up with ${who} about this. Remind them if no response by due date.`)
    }
  }

  return parts.join('\n')
}

function buildTaskDescription(item: any, chatJid: string): string {
  const chatName = getChatDisplayName(chatJid)
  const parts: string[] = []

  parts.push(item.description || item.title)
  parts.push('')
  parts.push(`Source: WhatsApp — ${chatName}`)

  if (item.source_context) {
    parts.push(`Context: ${item.source_context}`)
  }

  return parts.join('\n')
}

// --- Main Routing ---

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
      const decision = classifyItem(item)
      const directiveId = await insertDirective(sb, item, decision)

      let taskId: string | null = null
      if (decision.autoCreateTask) {
        taskId = await insertTask(sb, item, decision)
        // Link task to directive
        await sb
          .from('haily_directives')
          .update({ linked_task_id: taskId })
          .eq('id', directiveId)
      }

      markItemRouted(item.id, directiveId)

      const taskInfo = decision.autoCreateTask
        ? ` + task(${decision.smartList || 'dated'}, ${decision.myDay ? 'My Day' : 'normal'})`
        : ' (directive only)'
      console.log(`[Router] ${item.title} → directive(${decision.directivePriority})${taskInfo}`)

      routed++
    } catch (err) {
      console.error(`[Router] Failed to route item ${item.id}:`, err)
      markItemRouted(item.id, 'route-failed')
    }
  }

  console.log(`[Router] Routed ${routed}/${items.length} items.`)
  return routed
}

async function insertDirective(sb: SupabaseClient, item: any, decision: RoutingDecision): Promise<string> {
  const row = {
    title: item.title,
    description: buildDirectiveDescription(item, item.chat_jid, decision),
    category: decision.category,
    subcategory: `WhatsApp ${(item.item_type || 'task').replace('_', ' ')}`,
    priority: decision.directivePriority,
    status: 'New',
    due_date: decision.directiveDueDate,
    source: 'whatsapp',
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

async function insertTask(sb: SupabaseClient, item: any, decision: RoutingDecision): Promise<string> {
  const row: Record<string, any> = {
    title: item.title,
    description: buildTaskDescription(item, item.chat_jid),
    priority: decision.taskPriority,
    status: 'Planned',
    assignee: CEO_PROFILE_ID,
    label: ['WhatsApp', decision.category],
    my_day: decision.myDay,
  }

  if (decision.taskDueDate) {
    row.due_date = decision.taskDueDate
  }

  if (decision.smartList) {
    row.smart_list = decision.smartList
  }

  if (decision.smartList === 'Delegated') {
    row.delegated_to = HAILY_PROFILE_ID
  }

  const { data, error } = await sb
    .from('tasks')
    .insert(row)
    .select('id')
    .single()

  if (error) throw new Error(`Task insert failed: ${error.message}`)
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
