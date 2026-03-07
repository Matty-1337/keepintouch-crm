import { loadConfig } from './config'
import { storeExtractedItem, isDuplicateItem } from './storage'
import type { StoredMessage, ExtractedItem } from './types'

const EXTRACTION_PROMPT = `You are an AI assistant that extracts actionable items from WhatsApp business conversations between Matt (CEO) and his team/vendors.

Analyze the conversation and extract ONLY genuinely actionable items. Be strict — quality over quantity.

For each item, provide a JSON array with objects containing:
- item_type: one of "task", "follow_up", "action_item", "reminder"
- title: brief actionable summary (under 80 chars, start with a verb)
- description: one sentence explaining WHO needs to do WHAT
- who_acts: who needs to take the action — "Matt", the other person's name, or "Haily" for admin tasks
- urgency: one of "urgent", "high", "normal", "low"
  - "urgent": payment deadlines, expiring items, "ASAP", "immediately"
  - "high": payments, approvals, finalize, important deliverables
  - "normal": follow-ups, reviews, updates, general tasks
  - "low": FYI, nice-to-have, informational
- category: one of "Financial", "Follow-Up", "Scheduling", "Administrative", "Procurement", "Communication", "Research", "Project Support", "Personal", "General"
  - Financial: payment, invoice, cost, budget, money, pricing
  - Follow-Up: follow up, check in, update on, remind, status
  - Scheduling: meeting, call, schedule, appointment
  - Procurement: vendor, contractor, freelancer, hiring
  - Administrative: document, file, report, proposal, contract
  - Project Support: code, GitHub, deploy, build, app, dashboard, website, database
  - Communication: email, message, contact, reach out, tell, share
  - Research: research, look into, find out, compare
  - Personal: personal, family, health, travel
  - General: everything else
- business_identity: if clearly about a specific brand, one of "HTX TAP", "CoreTAP", "AtlasTAP", "SignalTap", "LearnTAP", "Veritas Officiating Institute", or null
- source_context: the relevant 1-2 line quote from the conversation (NEVER include passwords, API keys, tokens, login credentials, or secrets — redact or skip)
- due_date: ISO date string ONLY if explicitly mentioned in conversation (or null)

STRICT RULES — DO NOT extract:
- Casual greetings, small talk, acknowledgments ("ok", "sure", "thanks", "yes")
- Items already completed ("is done", "I already", "completed", "finished", "sent it")
- Vague statements with no clear action ("we will optimize", "having confusion")
- Pure decisions/statements that aren't tasks ("We will use Slack")
- Near-duplicates — if two items have the same action, keep only the most specific one
- Anything containing passwords, API keys, tokens, or credentials

Respond with ONLY a valid JSON array. No markdown, no explanation. Return [] if nothing actionable.`

export interface ExtractionResult {
  item_type: ExtractedItem['item_type']
  title: string
  description: string | null
  who_acts: string
  urgency: 'urgent' | 'high' | 'normal' | 'low'
  category: string
  business_identity: string | null
  priority: ExtractedItem['priority']
  due_date: string | null
  assigned_to: string
  source_context: string | null
}

export async function extractItems(
  messages: StoredMessage[],
  chatJid: string
): Promise<ExtractionResult[]> {
  if (messages.length === 0) return []

  const config = loadConfig()

  const conversationText = messages
    .map((m) => {
      const sender = m.sender_name || (m.is_from_me ? 'Matt' : 'Unknown')
      const time = new Date(m.timestamp * 1000).toLocaleString()
      return `[${time}] ${sender}: ${m.content}`
    })
    .join('\n')

  const userPrompt = `Extract actionable items from this WhatsApp conversation:\n\n${conversationText}`

  try {
    const rawItems = await callAI(config, userPrompt)
    const validItems: ExtractionResult[] = []
    const seenTitles = new Set<string>()

    for (const item of rawItems) {
      if (!item.title || !item.item_type) continue
      if (item.item_type === 'decision') continue // Skip pure decisions

      // Deduplicate within this batch
      const normalizedTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (seenTitles.has(normalizedTitle)) continue
      seenTitles.add(normalizedTitle)

      // Check for duplicates in DB
      if (isDuplicateItem(chatJid, item.title)) {
        console.log(`[Extractor] Skipping duplicate: "${item.title}"`)
        continue
      }

      // Map urgency to legacy priority field for local storage
      const legacyPriority = item.urgency === 'urgent' ? 'high' : (item.urgency || 'medium') as ExtractedItem['priority']

      const enrichedItem: ExtractionResult = {
        ...item,
        priority: legacyPriority,
        who_acts: item.who_acts || 'Haily',
        urgency: item.urgency || 'normal',
        category: item.category || 'General',
        business_identity: item.business_identity || null,
        assigned_to: item.assigned_to || 'Haley Rodriguez',
      }

      storeExtractedItem({
        message_id: messages[0].id,
        chat_jid: chatJid,
        item_type: item.item_type,
        title: item.title,
        description: item.description || null,
        priority: legacyPriority,
        due_date: item.due_date || null,
        assigned_to: item.assigned_to || 'Haley Rodriguez',
        source_context: item.source_context || null,
        who_acts: item.who_acts || 'Haily',
        urgency: item.urgency || 'normal',
        category: item.category || 'General',
        business_identity: item.business_identity || null,
      })

      validItems.push(enrichedItem)
    }

    return validItems
  } catch (err) {
    console.error('[Extractor] AI extraction failed:', err)
    throw err
  }
}

async function callAI(
  config: ReturnType<typeof loadConfig>,
  userPrompt: string
): Promise<ExtractionResult[]> {
  if (config.openrouterApiKey) {
    try {
      return await callOpenRouter(config, userPrompt)
    } catch (err) {
      console.warn('[Extractor] OpenRouter failed, trying fallback...', err)
    }
  }

  if (config.anthropicApiKey) {
    return await callAnthropic(config, userPrompt)
  }

  throw new Error('No AI API key configured. Set OPENROUTER_API_KEY or ANTHROPIC_API_KEY in .env')
}

async function callOpenRouter(
  config: ReturnType<typeof loadConfig>,
  userPrompt: string
): Promise<ExtractionResult[]> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openrouterApiKey}`,
    },
    body: JSON.stringify({
      model: config.openrouterDefaultModel,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 3000,
    }),
  })

  if (!response.ok) {
    if (config.openrouterFallbackModel) {
      console.warn(`[Extractor] Primary model failed (${response.status}), trying fallback model...`)
      return await callOpenRouterWithModel(config, config.openrouterFallbackModel, userPrompt)
    }
    throw new Error(`OpenRouter API error ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as any
  const content = data.choices?.[0]?.message?.content || '[]'
  return parseAIResponse(content)
}

async function callOpenRouterWithModel(
  config: ReturnType<typeof loadConfig>,
  model: string,
  userPrompt: string
): Promise<ExtractionResult[]> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openrouterApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 3000,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter fallback API error ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as any
  const content = data.choices?.[0]?.message?.content || '[]'
  return parseAIResponse(content)
}

async function callAnthropic(
  config: ReturnType<typeof loadConfig>,
  userPrompt: string
): Promise<ExtractionResult[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: EXTRACTION_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`)
  }

  const data = (await response.json()) as any
  const content = data.content?.[0]?.text || '[]'
  return parseAIResponse(content)
}

function parseAIResponse(content: string): ExtractionResult[] {
  let cleaned = content.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item: any) =>
        item &&
        typeof item.title === 'string' &&
        ['task', 'follow_up', 'action_item', 'reminder'].includes(item.item_type)
    )
  } catch (err) {
    console.error('[Extractor] Failed to parse AI response:', cleaned.slice(0, 200))
    return []
  }
}
