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
| `src/index.ts` | Entry point — wires connection, cron, message listeners, graceful shutdown, heartbeat |
| `src/connection.ts` | Baileys v7 connection, QR + pairing code auth, auto-reconnect with exponential backoff |
| `src/config.ts` | Environment config loader from `.env` |
| `src/types.ts` | TypeScript interfaces: BotConfig, StoredMessage, ExtractedItem, ScanResult, ConversationInfo |
| `src/storage.ts` | SQLite layer — messages, extracted_items, scan_log tables + filtered queries |
| `src/scanner.ts` | Scans monitored chats with optional overrides (target chat, lookback hours) |
| `src/extractor.ts` | AI-powered extraction via OpenRouter (primary) / Anthropic (fallback) |
| `src/router.ts` | Routes extracted items to Supabase (haily_directives table) |
| `src/notifier.ts` | Sends WhatsApp digest notifications to Haily, grouped by priority |
| `src/commands.ts` | Enhanced bot commands with argument parsing, chat name resolution, rich formatting |

## Bot Commands

Commands are authorized — only Haily, Matty, or the bot's own account can trigger them.

### `!scan` — Scan with targeting and lookback
```
!scan                    → Scan all monitored chats, default lookback
!scan 72h                → Scan all, 72-hour lookback
!scan Sculpture          → Scan only Sculpture Team group
!scan Finance 48h        → Scan Finance Team, 48-hour lookback
```
Returns rich formatted results inline with priority grouping and item details.

### `!recent` — Filtered item history
```
!recent                  → Last 50 items from all chats
!recent 20               → Last 20 items
!recent Finance          → Items from Finance group (last 7 days)
!recent 72h              → Items from last 72 hours
!recent Finance high     → High-priority items from Finance
```

### `!digest` — On-demand digest (same format Haily receives)
```
!digest                  → Today's digest (last 24h)
!digest 72h              → Digest covering last 72 hours
!digest Sculpture        → Digest for Sculpture group only
```

### Other commands
- `!help` — list commands with examples
- `!chats` — list all conversations with JIDs (✅ marks monitored ones)
- `!status` — pending items, recent scans
- `!route` — manually route pending items to Project Ops
- `!notify` — manually send pending notifications to Haily
- `!config` — show configuration with monitored chat names

## Connection & Auth

- Uses `@whiskeysockets/baileys` v7 for WhatsApp Web protocol
- Auth persisted in `auth_info/` via `useMultiFileAuthState`
- `syncFullHistory: true` — pulls full conversation history
- **QR mode** (local): QR printed to terminal + quickchart.io URL
- **Pairing code mode** (Railway): Set `USE_PAIRING_CODE=true` + `PAIRING_PHONE_NUMBER` — generates numeric code for WhatsApp > Linked Devices
- Auto-reconnect with exponential backoff (1s → 60s max, 20 attempts, then 5-min cooldown)
- Logged-out detection with re-auth instructions
- 5-minute disconnect warning logged

## Railway Deployment

### Service Configuration
- Separate Railway service in the `keepintouch-crm` project
- Root directory: `whatsapp-bot/`
- Uses `Dockerfile` with `npm ci --omit=dev` for lean production build
- `railway.json` configures ALWAYS restart policy

### Volume Mounts (CRITICAL)
```
/app/auth_info → WhatsApp session credentials (persist across deploys)
/app/data      → SQLite database (messages, items, scan logs)
```

### First Deploy Auth
1. Set `USE_PAIRING_CODE=true` and `PAIRING_PHONE_NUMBER=18323981541`
2. Deploy, check Railway logs for the pairing code
3. Enter code in WhatsApp > Linked Devices > Link with phone number
4. Credentials auto-persist in volume mount

### Graceful Shutdown (SIGTERM)
On deploy/restart: stops cron → closes Baileys socket → closes SQLite → exits cleanly.

### Heartbeat
Logs RSS/heap memory every 5 minutes for Railway health monitoring.

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
| USE_PAIRING_CODE | No | false | Use pairing code instead of QR (for Railway) |
| PAIRING_PHONE_NUMBER | No | — | Phone number for pairing code (digits + country code) |

*Either OPENROUTER_API_KEY or ANTHROPIC_API_KEY required.

## Project Ops Integration (Supabase Direct)

- Inserts into `haily_directives` table
- Profile UUIDs:
  - Haily Rodriguez (EA): `754954b4-2c7c-4c14-86ee-f81943098f26`
  - Matt (CEO): `6d8b760d-af8a-4755-8236-9cf364264498`
- Priority mapping: high→High, medium→Normal, low→Low
- Category mapping: task/action_item→General, follow_up→Follow-Up, reminder→Administrative

## Running

```bash
# Development
cd whatsapp-bot && npx tsx src/index.ts

# Production (compiled)
npx tsc && node dist/index.js

# Docker
docker build -t kit-whatsapp-bot . && docker run -v ./auth_info:/app/auth_info -v ./data:/app/data --env-file .env kit-whatsapp-bot
```
