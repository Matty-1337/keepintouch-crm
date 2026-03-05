# AI Provider Reference

Working configurations from the existing `~/imessage-keepintouch/` implementation.

---

## OpenRouter

### Endpoint
```
POST https://openrouter.ai/api/v1/chat/completions
```

### Authentication
```
Authorization: Bearer {OPENROUTER_API_KEY}
HTTP-Referer: https://deltakinetics.com
X-Title: KeepInTouch Engine
```

### Request Format
```json
{
  "model": "deepseek/deepseek-chat-v3-0324",
  "messages": [
    {"role": "system", "content": "System prompt"},
    {"role": "user", "content": "User message"}
  ],
  "temperature": 0.9,
  "max_tokens": 500
}
```

### Response Format
```json
{
  "choices": [
    {
      "message": {
        "content": "Generated text here"
      }
    }
  ]
}
```

### Available Models

| Model ID | Best For | Cost (in/out per 1M tokens) |
|----------|----------|----------------------------|
| `deepseek/deepseek-chat-v3-0324` | Default, message gen | $0.27 / $1.10 |
| `qwen/qwen3-30b-a3b` | Cheap classification | $0.10 / $0.50 |
| `anthropic/claude-sonnet-4` | High quality tasks | $3.00 / $15.00 |

### Config Keys (in ~/.keepintouch/config.json)
```json
{
  "openrouter_api_key": "sk-or-v1-...",
  "openrouter_url": "https://openrouter.ai/api/v1",
  "openrouter_model": "deepseek/deepseek-chat-v3-0324",
  "openrouter_message_model": "deepseek/deepseek-chat-v3-0324"
}
```

---

## Ollama (Local)

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `http://localhost:11434/api/chat` | POST | Chat completion |
| `http://localhost:11434/api/generate` | POST | Text generation |
| `http://localhost:11434/api/tags` | GET | List models / health check |

### Chat Request Format
```json
{
  "model": "llama3.1:8b",
  "messages": [
    {"role": "system", "content": "System prompt"},
    {"role": "user", "content": "User message"}
  ],
  "stream": false,
  "options": {
    "temperature": 0.9,
    "num_predict": 500
  }
}
```

### Chat Response Format
```json
{
  "message": {
    "content": "Generated text here"
  }
}
```

### Generate Request Format (alternative)
```json
{
  "model": "llama3.1:8b",
  "prompt": "Full prompt text",
  "stream": false,
  "options": {
    "temperature": 0.8,
    "top_p": 0.9,
    "num_predict": 60
  }
}
```

### Generate Response Format
```json
{
  "response": "Generated text here"
}
```

### Models Used
- `llama3.1:8b` — general purpose fallback
- Other models available via `ollama pull <model>`

### Config Keys
```json
{
  "ollama_model": "llama3.1:8b",
  "ollama_url": "http://localhost:11434",
  "fallback_to_ollama": true
}
```

---

## Task-Specific Settings

| Task Type | Temperature | Use Case |
|-----------|-------------|----------|
| `message_generation` | 0.9 | Creative, varied messages |
| `enrichment` | 0.7 | Factual extraction from search results |
| `classification` | 0.3 | Deterministic category assignment |
| `general` | 0.7 | Default for other tasks |

For classification tasks, the router forces Ollama (free, fast) by clearing the OpenRouter key.

---

## TypeScript Port Template

```typescript
// src/lib/llm.ts
interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMConfig {
  openrouterApiKey?: string
  openrouterModel?: string
  ollamaUrl?: string
  ollamaModel?: string
}

async function smartLLMCall(
  messages: LLMMessage[],
  config: LLMConfig,
  taskType: string = 'general'
): Promise<string | null> {
  const temp = taskType === 'classification' ? 0.3 :
               taskType === 'enrichment' ? 0.7 : 0.9

  // Try OpenRouter first
  if (config.openrouterApiKey) {
    try {
      const model = config.openrouterModel || 'deepseek/deepseek-chat-v3-0324'
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openrouterApiKey}`,
          'HTTP-Referer': 'https://deltakinetics.com',
          'X-Title': 'KeepInTouch CRM',
        },
        body: JSON.stringify({ model, messages, temperature: temp, max_tokens: 500 }),
      })
      const data = await res.json()
      return data.choices?.[0]?.message?.content?.trim() || null
    } catch (e) {
      console.warn('OpenRouter failed, trying Ollama...', e)
    }
  }

  // Fallback to Ollama
  try {
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434'
    const model = config.ollamaModel || 'llama3.1:8b'
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages, stream: false,
        options: { temperature: temp, num_predict: 500 },
      }),
    })
    const data = await res.json()
    return data.message?.content?.trim() || null
  } catch (e) {
    console.error('Both providers failed', e)
    return null
  }
}
```
