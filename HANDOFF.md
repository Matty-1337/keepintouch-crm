# HANDOFF — Keep-In-Touch CRM

## Last Session
- **Date**: 2026-03-06
- **Focus**: Deploy WhatsApp Bot to Railway, fix CRM build, fix LID JID command auth
- **Status**: Bot deployed and running on Railway. CRM deployed and running. Both services healthy.

## Current State
- [x] Full repository audit (REPO_AUDIT.md)
- [x] 9 skills created under `.skills/` (8 CRM + 1 WhatsApp bot)
- [x] WhatsApp Bot — deployed to Railway, connected to WhatsApp, monitoring 10 chats
- [x] Supabase direct routing to haily_directives table
- [x] CRM deployed on Railway (NIXPACKS builder)

### WhatsApp Bot (`whatsapp-bot/`)

**Enhanced Commands:**
- `!scan [name] [Nh]` — targeted scan with lookback override, rich inline results
- `!recent [name] [Nh] [priority] [count]` — filtered item history
- `!digest [name] [Nh]` — on-demand digest (same format Haily gets)
- `!chats` — lists all groups with ✅ for monitored ones
- `!config` — shows monitored chat names, Supabase status

**Railway Deployment (LIVE):**
- `Dockerfile` — node:20-slim, `npm ci`, `npx tsc`, `npm prune --omit=dev`
- `railway.json` — ALWAYS restart, max 10 retries
- Service config: `rootDirectory: whatsapp-bot` (set via API, not env var)
- Start command: uses Dockerfile CMD (`./entrypoint.sh`) — no Railway override
- Volume: `/app/persist` (auth at `/app/persist/auth_info`, DB at `/app/persist/data`)
- Graceful SIGTERM shutdown (cron → socket → DB)
- 5-minute heartbeat for Railway health monitoring

**Key IDs:**
- Haily Rodriguez (EA) profile: `754954b4-2c7c-4c14-86ee-f81943098f26`
- Matt (CEO) profile: `6d8b760d-af8a-4755-8236-9cf364264498`
- Haily WhatsApp JID: `584140877668@s.whatsapp.net`
- Matty WhatsApp: `18323981541`
- Supabase project: `hyeislkhqkkcveqqbwix` (auditops-prod)
- Supabase URL: `https://hyeislkhqkkcveqqbwix.supabase.co`

**Monitored Chats (10):**
- Veritas Institute LMS Team, Tech Automations (Tamirat), Sculpture Team
- Moodle Site Builder & Typebot (Mitul), Mautic/Server/Docuseal, Matt Sculpture
- Finance Team (Jawed), Accounting, Haily DM
- Keval DM (`917359961709@s.whatsapp.net`)

## Next Steps
1. **Rotate OpenRouter API key** — Key is in .env and committed history; rotate after deploy
2. **Test full pipeline** — Send message in monitored group, run !scan, verify Supabase insert
3. **Implement CRM message generation** — Port `llm_router.py` patterns to `src/lib/llm.ts`
4. **Add loading/error states** — Create loading.tsx and error.tsx files for CRM pages
5. **Configure sync agent** — Update LaunchAgent plist with real Railway URL

## Known Issues
- Bot stores messages only from when it's running (no retroactive history extraction)
- Baileys v7 `messaging-history.set` only fires on initial sync, not reconnects
- Bot spelling uses "Haily" (matches Project Ops DB) not "Haley"
- Sync agent plist has placeholder credentials
- No tests exist for bot or CRM

## Deployment Notes (2026-03-06)
- **CRM build**: `tsconfig.json` excludes `whatsapp-bot/` to prevent Next.js type-checking bot code
- **Bot rootDirectory**: Set via Railway service API (`serviceInstanceUpdate`), NOT as env var — env var was unreliable
- **Bot start command**: Must be empty/null in Railway — Docker CMD handles it. Root `railway.json` has Prisma start command for CRM; bot's own `railway.json` has no startCommand
- **LID JID fix**: `commands.ts` extracts phone numbers from any JID format (standard, LID, lid.whatsapp.net) for auth matching. Also uses `msg.key.fromMe` as fallback

## Environment Notes
- Mac: user `apple2`
- CRM repo: `~/keepintouch-crm/`
- WhatsApp bot: `~/keepintouch-crm/whatsapp-bot/`
- iMessage repo: `~/imessage-keepintouch/`
- Commit prefix: `claude:` for Claude Code work
