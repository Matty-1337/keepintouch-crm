# HANDOFF — Keep-In-Touch CRM

## Last Session
- **Date**: 2026-03-05
- **Focus**: WhatsApp Bot enhanced commands + Railway deployment config
- **Status**: Bot fully built with enhanced commands, Supabase routing, Railway config. Ready to deploy.

## Current State
- [x] Full repository audit (REPO_AUDIT.md)
- [x] 9 skills created under `.skills/` (8 CRM + 1 WhatsApp bot)
- [x] WhatsApp Bot — all phases complete + enhanced commands + Railway config
- [x] Supabase direct routing to haily_directives table

### WhatsApp Bot (`whatsapp-bot/`)

**Enhanced Commands:**
- `!scan [name] [Nh]` — targeted scan with lookback override, rich inline results
- `!recent [name] [Nh] [priority] [count]` — filtered item history
- `!digest [name] [Nh]` — on-demand digest (same format Haily gets)
- `!chats` — lists all groups with ✅ for monitored ones
- `!config` — shows monitored chat names, Supabase status

**Railway Deployment (prepared, NOT deployed):**
- `Dockerfile` — node:20-slim, `npm ci --omit=dev`, `npx tsc`
- `railway.json` — ALWAYS restart, max 10 retries
- Pairing code support: `USE_PAIRING_CODE=true` + `PAIRING_PHONE_NUMBER=18323981541`
- Volume mounts needed: `/app/auth_info`, `/app/data`
- Graceful SIGTERM shutdown (cron → socket → DB)
- 5-minute heartbeat for Railway health monitoring

**Key IDs:**
- Haily Rodriguez (EA) profile: `754954b4-2c7c-4c14-86ee-f81943098f26`
- Matt (CEO) profile: `6d8b760d-af8a-4755-8236-9cf364264498`
- Haily WhatsApp JID: `584140877668@s.whatsapp.net`
- Matty WhatsApp: `18323981541`
- Supabase project: `hyeislkhqkkcveqqbwix` (auditops-prod)
- Supabase URL: `https://hyeislkhqkkcveqqbwix.supabase.co`

**Monitored Chats (9):**
- Veritas Institute LMS Team, Tech Automations (Tamirat), Sculpture Team
- Moodle Site Builder & Typebot (Mitul), Mautic/Server/Docuseal, Matt Sculpture
- Finance Team (Jawed), Accounting, Haily DM

## Next Steps
1. **Deploy to Railway** — Create whatsapp-bot service, attach volumes, set env vars, deploy
2. **Rotate OpenRouter API key** — Key is in .env and committed history; rotate after deploy
3. **Test full pipeline** — Send message in monitored group, run !scan, verify Supabase insert
4. **Implement CRM message generation** — Port `llm_router.py` patterns to `src/lib/llm.ts`
5. **Add loading/error states** — Create loading.tsx and error.tsx files for CRM pages
6. **Configure sync agent** — Update LaunchAgent plist with real Railway URL

## Known Issues
- Bot stores messages only from when it's running (no retroactive history extraction)
- Baileys v7 `messaging-history.set` only fires on initial sync, not reconnects
- Bot spelling uses "Haily" (matches Project Ops DB) not "Haley"
- Sync agent plist has placeholder credentials
- No tests exist for bot or CRM

## Environment Notes
- Mac: user `apple2`
- CRM repo: `~/keepintouch-crm/`
- WhatsApp bot: `~/keepintouch-crm/whatsapp-bot/`
- iMessage repo: `~/imessage-keepintouch/`
- Commit prefix: `claude:` for Claude Code work
