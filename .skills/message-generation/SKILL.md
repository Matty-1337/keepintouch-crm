---
name: message-generation
description: >
  Use this skill for ANY work involving AI-powered message generation, drafting
  outreach messages, OpenRouter API integration, Ollama local LLM usage, prompt
  templates for iMessage ghostwriting, tone calibration, the Message model lifecycle
  (draft to sent), AI provider configuration, or porting the existing message
  generation from ~/imessage-keepintouch/ into the CRM. Trigger on: message
  generation, AI message, OpenRouter, Ollama, draft message, send message, tone,
  prompt template, generate a message, ghostwrite, LLM, DeepSeek, text message,
  AI provider, llm_router, enrichment.
---

# Message Generation Skill

You are implementing or working on AI-powered message generation for the Keep-In-Touch
CRM. A working reference implementation exists in `~/imessage-keepintouch/` — this
skill documents those patterns and how to port them into the CRM's Next.js architecture.

## Current State

- **Settings UI exists** (`src/app/settings/page.tsx`) — AI provider selection stored in Setting model
- **Message model exists** — draft/sent/failed lifecycle in Prisma
- **No generation code in the CRM yet** — all AI logic is in `~/imessage-keepintouch/`
- **Goal**: Port the proven Python patterns into Next.js API routes

## Reference Implementation (~/imessage-keepintouch/)

### LLM Router (`llm_router.py`)

The router tries OpenRouter first, falls back to local Ollama:

```python
def smart_llm_call(messages, config, task_type="general"):
    # Tier 1: OpenRouter (cloud, paid, fast)
    # Tier 2: Ollama (local, free, slower)
```

**Task-specific temperature settings:**
| Task | Temperature | Max Tokens |
|------|-------------|------------|
| `message_generation` | 0.9 | 500 |
| `enrichment` | 0.7 | 500 |
| `classification` | 0.3 | 500 |

### OpenRouter Integration

```
Endpoint: https://openrouter.ai/api/v1/chat/completions
Auth: Bearer {OPENROUTER_API_KEY}
Headers:
  - HTTP-Referer: https://deltakinetics.com
  - X-Title: KeepInTouch Engine
```

**Models used:**
| Model ID | Use Case | Cost (in/out per 1M) |
|----------|----------|---------------------|
| `deepseek/deepseek-chat-v3-0324` | Default, general | $0.27 / $1.10 |
| `qwen/qwen3-30b-a3b` | Lightweight tasks | $0.10 / $0.50 |
| `anthropic/claude-sonnet-4` | High quality | $3.00 / $15.00 |

Config keys: `openrouter_api_key`, `openrouter_model`, `openrouter_message_model`, `openrouter_url`

### Ollama Integration

```
Endpoint: http://localhost:11434/api/chat (chat mode)
         http://localhost:11434/api/generate (generate mode)
Health:  http://localhost:11434/api/tags
```

Config keys: `ollama_model` (default: `llama3.1:8b`), `ollama_url` (default: `http://localhost:11434`), `fallback_to_ollama` (default: `true`)

### Message Generation Prompt

The ghostwriting prompt template (from `llm_router.py` `generate_text_message()`):

```
System: You ghostwrite short, natural iMessage texts.

User:
You are ghostwriting a short iMessage text from {sender_name} to {contact_name}.
Write ONLY the message text itself. No quotes, no labels, no explanation.
The message should feel natural and human — like a real text between friends.

{sender_name}'s texting style: {sender_style}
About {sender_name}: {sender_context}
Relationship: {contact_name} is {sender_name}'s {relationship}.
Context/notes: {notes}
Recent life updates from the web about {contact_name}: {enrichment_data}
Their social profiles: {profiles}

Respond with ONLY the message text. One to two sentences max.
No quotation marks. No 'Here's a message:' prefix. Just the text itself.
```

### Response Cleaning

LLM outputs often include unwanted prefixes. The cleaner strips:
- "Here's a message:", "Message:", "Sure!", etc.
- Surrounding quotes
- Everything after the first blank line

### Contact Enrichment

Before generating a message, the system enriches context:
- Pulls from `contact_enrichment` table (summaries from web searches)
- Pulls from `contact_profiles` table (social media links)
- This data feeds into the prompt for personalized messages

### Cost Tracking

All LLM calls are logged to `llm_usage_log` table in local SQLite:
```sql
CREATE TABLE llm_usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    task_type TEXT NOT NULL,
    input_tokens_approx INTEGER,
    output_tokens_approx INTEGER,
    cost_estimate REAL,
    latency_ms INTEGER,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Porting to Next.js CRM

### Recommended API Routes

```
POST /api/messages/generate     — Generate a draft message for a contact
GET  /api/ai/providers          — Check which providers are available
GET  /api/ai/cost-report        — Get LLM usage/cost summary
```

### Environment Variables to Add

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API authentication |
| `OPENROUTER_MODEL` | Default model (e.g., `deepseek/deepseek-chat-v3-0324`) |
| `OLLAMA_URL` | Ollama endpoint (only if running locally on same machine) |

### Implementation Steps

1. **Create `src/lib/llm.ts`** — TypeScript port of `smart_llm_call` with OpenRouter → Ollama fallback
2. **Create `POST /api/messages/generate`** — accepts contactId, generates draft message using contact data
3. **Create `GET /api/ai/providers`** — health check for configured providers
4. **Add UI** — "Generate Message" button on contact detail and queue card
5. **Store config** — Use existing Setting model for provider/model preferences

### Key Considerations

- **OpenRouter works from Railway** (cloud API, no local dependency)
- **Ollama only works locally** (on the Mac) — won't work from Railway
- In production: OpenRouter is the primary provider
- In local dev: Ollama fallback is available
- Cost tracking should use a dedicated database table (port `llm_usage_log`)

## Message Model Lifecycle

```
1. User clicks "Generate" on a contact
2. POST /api/messages/generate → AI generates text
3. Message created with status: "draft"
4. User reviews, edits if needed
5. User clicks "Send" → status changes to "sent"
6. Contact.lastContact updated, nextDue recalculated
7. (Actual iMessage sending happens via local scripts, NOT from Railway)
```

## Dependencies
- **crm-backend**: Uses Message model, Contact model, Setting model
- **contact-management**: Needs contact data for prompt context
