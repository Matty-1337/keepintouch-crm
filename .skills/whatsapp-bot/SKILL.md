---
name: whatsapp-bot
description: WhatsApp conversation intelligence bot — scans chats, extracts action items via AI, routes to Project Ops Supabase, notifies Haily via WhatsApp
---

# WhatsApp Bot Skill

## Overview

The WhatsApp Bot (`whatsapp-bot/`) is a Node.js/TypeScript module that connects to WhatsApp via Baileys, monitors business conversations, uses AI (OpenRouter/Anthropic) to extract actionable items, routes them to the Project Ops Supabase database, and sends digest notifications to Haily Rodriguez via WhatsApp.

## Architecture

```
WhatsApp (Baileys) → Scanner → Extractor (AI) → Router (Supabase) → Notifier (WhatsApp DM)
                         ↓                          ↓
                    SQLite cache              Project Ops DB
                                        (haily_directives table)
```

## File Map

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point — wires connection, cron scheduler, message listeners, commands |
| `src/connection.ts` | Baileys WebSocket connection, QR auth, auto-reconnect, chat listing |
| `src/config.ts` | Environment config loader from `.env` |
| `src/types.ts` | TypeScript interfaces: BotConfig, StoredMessage, ExtractedItem, ScanResult, ConversationInfo |
| `src/storage.ts` | SQLite layer — messages, extracted_items, scan_log tables |
| `src/scanner.ts` | Scans monitored chats, triggers extraction on unprocessed messages |
| `src/extractor.ts` | AI-powered extraction via OpenRouter (primary) / Anthropic (fallback) |
| `src/router.ts` | Routes extracted items to Supabase (haily_directives table) |
| `src/notifier.ts` | Sends WhatsApp digest notifications to Haily, grouped by priority |
| `src/commands.ts` | Bot commands: !help, !chats, !scan, !status, !route, !notify, !recent, !config |
| `src/list-chats.ts` | Standalone script to list all WhatsApp conversations with JIDs |

## Key Concepts

### Connection & Auth
- Uses `@whiskeysockets/baileys` v7 for WhatsApp Web protocol
- Auth persisted in `auth_info/` via `useMultiFileAuthState`
- `syncFullHistory: true` — pulls full conversation history on first connect
- QR code printed to terminal + quickchart.io URL for headless environments
- Auto-reconnect with exponential backoff (max 10 attempts)

### Scan Pipeline
1. **Cron trigger** every `SCAN_INTERVAL_MINUTES` (default: 30)
2. **Scanner** pulls unprocessed messages from SQLite for each monitored chat
3. **Extractor** sends message batch to AI with structured prompt, parses JSON response
4. **Deduplication** — `isDuplicateItem()` checks title similarity within 48h window
5. **Router** inserts into Supabase `haily_directives` table with correct profile UUIDs
6. **Notifier** sends WhatsApp message to Haily with priority-grouped digest

### Project Ops Integration (Supabase Direct)
- Inserts into `haily_directives` table (serves as both task and directive)
- Profile UUIDs:
  - Haily Rodriguez (EA): `754954b4-2c7c-4c14-86ee-f81943098f26`
  - Matt (CEO): `6d8b760d-af8a-4755-8236-9cf364264498`
- Priority mapping: high→High, medium→Normal, low→Low
- Category mapping: task/action_item→General, follow_up→Follow-Up, reminder→Administrative

### AI Extraction
- Primary: OpenRouter (`glm-4.7` default, `deepseek/deepseek-chat-v3.2` fallback)
- Secondary fallback: Anthropic (`claude-haiku-4-5-20251001`)
- Temperature: 0.1 for consistent structured output
- Response format: JSON array of ExtractedItem objects
- Handles markdown code fences in AI responses

### Bot Commands
Commands are authorized — only Haily or the bot's own account can trigger them:
- `!help` — list commands
- `!chats` — list all synced conversations with JIDs
- `!scan` — trigger immediate scan
- `!status` — show pending items, recent scans
- `!route` — manually route pending items to Project Ops
- `!notify` — manually send pending notifications
- `!recent` — show recently extracted items
- `!config` — show current configuration

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| MONITORED_CHATS | No | empty | Comma-separated WhatsApp JIDs to monitor |
| HALEY_WHATSAPP_JID | Yes | — | Haily's WhatsApp JID for notifications |
| OPENROUTER_API_KEY | Yes* | — | OpenRouter API key for AI extraction |
| SUPABASE_URL | Yes | — | Project Ops Supabase URL |
| SUPABASE_SERVICE_KEY | Yes | — | Supabase service role key |
| SCAN_INTERVAL_MINUTES | No | 30 | Cron interval for scanning |
| SCAN_LOOKBACK_HOURS | No | 24 | How far back to scan |

*Either OPENROUTER_API_KEY or ANTHROPIC_API_KEY required.

## Running

```bash
# Development
cd whatsapp-bot && npx tsx src/index.ts

# List conversations
npx tsx src/list-chats.ts

# Production (compiled)
npx tsc && node dist/index.js

# Docker
docker build -t kit-whatsapp-bot . && docker run -v ./auth_info:/app/auth_info -v ./data:/app/data --env-file .env kit-whatsapp-bot
```

## SQLite Schema

Three tables in `data/whatsapp-bot.db`:
- **messages** — raw message cache (id, chat_jid, sender, content, timestamp, processed flag)
- **extracted_items** — AI-extracted items (type, title, priority, routed/notified flags)
- **scan_log** — scan history (messages_scanned, items_extracted, status)

## Debugging

- Set `LOG_LEVEL=warn` or `LOG_LEVEL=debug` in .env for Baileys logging
- Check `data/whatsapp-bot.db` with `sqlite3` for stored messages/items
- Run `!status` in WhatsApp to see pending items and recent scan results
- If connection drops, check `auth_info/` — delete and re-scan QR if corrupted
