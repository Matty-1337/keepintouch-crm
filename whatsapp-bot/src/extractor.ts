import { loadConfig } from './config'
import { storeExtractedItem, isDuplicateItem } from './storage'
import type { StoredMessage, ExtractedItem } from './types'

const EXTRACTION_PROMPT = `You are an AI assistant that extracts actionable items from WhatsApp business conversations.

Analyze the following conversation messages and extract any:
- Tasks that need to be done
- Follow-ups that were promised or requested
- Action items assigned to someone
- Reminders about deadlines or events
- Important decisions that were made

For each item found, provide a JSON array with objects containing:
- item_type: one of "task", "follow_up", "action_item", "reminder", "decision"
- title: brief summary (under 80 chars)
- description: fuller context if needed (or null)
- priority: "high", "medium", or "low"
- due_date: ISO date string if mentioned (or null)
- assigned_to: person's name if clear (default: "Haley Rodriguez")
- source_context: the relevant quote from the conversation

If no actionable items are found, return an empty array: []

IMPORTANT: Only extract genuinely actionable items. Do NOT extract:
- Casual greetings or small talk
- Simple acknowledgments ("ok", "sure", "thanks")
- Questions without action implications
- Already-completed items

Respond with ONLY a valid JSON array. No markdown, no explanation.`

interface ExtractionResult {
  item_type: ExtractedItem['item_type']
  title: string
  description: string | null
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

  // Format messages for the AI prompt
  const conversationText = messages
    .map((m) => {
      const sender = m.sender_name || (m.is_from_me ? 'Me' : 'Unknown')
      const time = new Date(m.timestamp * 1000).toLocaleString()
      return `[${time}] ${sender}: ${m.content}`
    })
    .join('\n')

  const userPrompt = `Extract actionable items from this WhatsApp conversation:\n\n${conversationText}`

  try {
    const rawItems = await callAI(config, userPrompt)
    const validItems: ExtractionResult[] = []

    for (const item of rawItems) {
      // Validate item structure
      if (!item.title || !item.item_type) continue

      // Check for duplicates
      if (isDuplicateItem(chatJid, item.title)) {
        console.log(`[Extractor] Skipping duplicate: "${item.title}"`)
        continue
      }

      // Store in database
      storeExtractedItem({
        message_id: messages[0].id,
        chat_jid: chatJid,
        item_type: item.item_type,
        title: item.title,
        description: item.description || null,
        priority: item.priority || 'medium',
        due_date: item.due_date || null,
        assigned_to: item.assigned_to || 'Haley Rodriguez',
        source_context: item.source_context || null,
      })

      validItems.push(item)
    }

    return validItems
  } catch (err) {
    console.error('[Extractor] AI extraction failed:', err)
    return []
  }
}

async function callAI(
  config: ReturnType<typeof loadConfig>,
  userPrompt: string
): Promise<ExtractionResult[]> {
  // Try OpenRouter first, then Anthropic fallback
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
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    // Try fallback model
    if (config.openrouterFallbackModel) {
      console.warn(`[Extractor] Primary model failed (${response.status}), trying fallback model...`)
      return await callOpenRouterWithModel(config, config.openrouterFallbackModel, userPrompt)
    }
    throw new Error(`OpenRouter API error ${response.status}: ${errText}`)
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
      max_tokens: 2000,
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
      max_tokens: 2000,
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
  // Strip markdown code fences if present
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
        ['task', 'follow_up', 'action_item', 'reminder', 'decision'].includes(item.item_type)
    )
  } catch (err) {
    console.error('[Extractor] Failed to parse AI response:', cleaned.slice(0, 200))
    return []
  }
}
