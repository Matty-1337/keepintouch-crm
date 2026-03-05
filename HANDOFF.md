# HANDOFF — Keep-In-Touch CRM

## Last Session
- **Date**: 2026-03-05
- **Focus**: WhatsApp Bot build (Phases 1-8) + Supabase routing
- **Status**: Bot fully built and compiled. Needs SUPABASE_SERVICE_KEY and MONITORED_CHATS to go live.

## Current State
- [x] Full repository audit (REPO_AUDIT.md)
- [x] 9 skills created under `.skills/` (8 CRM + 1 WhatsApp bot)
- [x] Eval test cases written for all skills
- [x] SKILLS_INDEX.md with inventory and dependency graph
- [x] WhatsApp Bot — all 8 phases complete

### Skills Built
| Skill | Priority | Status |
|-------|----------|--------|
| crm-backend | P0 | Complete — schema, API endpoints, auth documented |
| contact-management | P0 | Complete — categories, frequency, queue documented |
| sync-agent | P0 | Complete — sync workflow, SQLite schema, LaunchAgent documented |
| whatsapp-bot | P0 | Complete — Baileys connection, AI extraction, Supabase routing, WhatsApp notifications |
| crm-frontend | P1 | Complete — components, theme, Shadcn/ui documented |
| message-generation | P1 | Complete — OpenRouter/Ollama patterns from imessage-keepintouch ported |
| railway-deployment | P1 | Complete — Railway config, env vars, deployment checklist |
| imessage-integration | P1 | Complete — two-repo architecture, chat.db, boundary documented |
| dev-workflow | P2 | Complete — setup, commit conventions, HANDOFF template |

### WhatsApp Bot (`whatsapp-bot/`)
| Component | File | Status |
|-----------|------|--------|
| Connection | `src/connection.ts` | Done — Baileys v7, QR auth, auto-reconnect |
| Config | `src/config.ts` | Done — env loader |
| Storage | `src/storage.ts` | Done — SQLite: messages, extracted_items, scan_log |
| Scanner | `src/scanner.ts` | Done — cron-triggered scan of monitored chats |
| Extractor | `src/extractor.ts` | Done — OpenRouter primary, Anthropic fallback |
| Router | `src/router.ts` | Done — Supabase direct insert to haily_directives |
| Notifier | `src/notifier.ts` | Done — WhatsApp DM digest to Haily |
| Commands | `src/commands.ts` | Done — !help, !chats, !scan, !status, !route, !notify, !recent, !config |
| Entry | `src/index.ts` | Done — wires everything, cron scheduler |
| Docker | `Dockerfile` | Done — node:20-slim, multi-stage |

**Key IDs:**
- Haily Rodriguez (EA) profile: `754954b4-2c7c-4c14-86ee-f81943098f26`
- Matt (CEO) profile: `6d8b760d-af8a-4755-8236-9cf364264498`
- Haily WhatsApp JID: `584140877668@s.whatsapp.net`
- Supabase project: `hyeislkhqkkcveqqbwix` (auditops-prod)
- Supabase URL: `https://hyeislkhqkkcveqqbwix.supabase.co`

## Next Steps
1. **Add SUPABASE_SERVICE_KEY** — Get from Supabase dashboard > Settings > API > service_role key, add to `whatsapp-bot/.env`
2. **Configure MONITORED_CHATS** — Run `npx tsx src/list-chats.ts`, pick JIDs, add to `.env`
3. **Test full pipeline** — Send !scan to trigger extraction, verify items appear in Project Ops
4. **Deploy to Railway** — Push Docker image, mount auth_info volume, set env vars
5. **Implement message generation** — Port `llm_router.py` patterns to `src/lib/llm.ts`
6. **Add loading/error states** — Create loading.tsx and error.tsx files for CRM pages
7. **Configure sync agent** — Update LaunchAgent plist with real Railway URL

## Known Issues
- WhatsApp bot needs SUPABASE_SERVICE_KEY to route to Project Ops (currently stores locally)
- Baileys v7 `syncFullHistory: true` may take time to sync all chats on first connection
- Bot spelling uses "Haily" (matches Project Ops DB) not "Haley"
- Sync agent plist has placeholder credentials (CRM_URL, CRM_API_KEY)
- Settings page AI provider selector is cosmetic
- No conflict resolution in push/pull sync
- No tests exist

## Environment Notes
- Mac: user `apple2`
- CRM repo: `~/keepintouch-crm/`
- WhatsApp bot: `~/keepintouch-crm/whatsapp-bot/`
- iMessage repo: `~/imessage-keepintouch/`
- Local contacts DB: `~/.keepintouch/contacts.db`
- Commit prefix: `claude:` for Claude Code work
