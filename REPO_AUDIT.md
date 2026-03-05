# Keep-In-Touch CRM — Repository Audit

> Generated 2026-03-04 by Claude Code (Phase 1 of Skills Build)

---

## 1. Tech Stack & Architecture

### Framework
- **Next.js 14.2.35** (App Router, `force-dynamic` pages, standalone output)
- **React 18.3.1** with TypeScript 5.7.3 (strict mode)
- **Tailwind CSS 3.4.17** with dark mode (class-based), tailwindcss-animate
- **Radix UI** for accessible primitives (dialog, dropdown, select, tabs, tooltip, slider, switch, toast)
- **Recharts 2.15.1** for dashboard charts
- **date-fns 4.1.0** for date utilities
- **lucide-react 0.474.0** for icons

### Backend
- Next.js API routes (App Router `route.ts` files)
- No separate backend framework — all server logic in API routes
- API key auth via `X-API-Key` header or same-origin referer check (`src/lib/auth.ts`)

### Database
- **Prisma 6.4.1** ORM
- **PostgreSQL** in production (Railway-hosted)
- **SQLite** in development (`file:./dev.db`)
- 5 models: Contact, SecondaryPhone, Message, SyncLog, Setting
- 1 migration applied (`0001_init`)

### Deployment
- **Railway** with NIXPACKS builder
- Start command: `npx prisma migrate deploy && npm start`
- Restart policy: ON_FAILURE, max 10 retries
- Build: `prisma generate && next build`

### Environment Variables
| Variable | Where Used | Purpose |
|----------|-----------|---------|
| `DATABASE_URL` | Prisma | PostgreSQL connection string |
| `API_KEY` | `src/lib/auth.ts` | API authentication |
| `NEXT_PUBLIC_APP_URL` | `src/lib/auth.ts`, settings page | Base URL, referer validation |
| `CRM_URL` | sync-agent plist | CRM API base URL |
| `CRM_API_KEY` | sync-agent plist | Sync agent auth key |

---

## 2. Core Domain Logic

### Contact Model
Contacts are the central entity. Each has:
- **Identity**: name, phone, email, appleContactId, localSqliteId
- **Classification**: category (Baseball/WHAM/Professional/Friend/Student/Hospitality), relationship (partner/friend/professional/family/mentor/student/colleague)
- **KIT scheduling**: frequencyDays (1-90, default 14), lastContact, nextDue, kitActive
- **Context**: topics (comma-separated), context (freetext), notes
- **State**: archived (soft delete)
- **Relations**: secondaryPhones[], messages[]

### Scoring & Scheduling
- No algorithmic scoring — uses simple frequency-based scheduling
- `nextDue = lastContact + frequencyDays`
- Contacts are "overdue" when `nextDue <= now`
- Queue page shows overdue (red) and upcoming 7 days (gray)
- Overdue severity: red (>7d), orange (3-7d), yellow (1-3d)
- Snooze adds 7 days to nextDue

### iMessage Integration
- **Not in this repo.** The iMessage scripts live at `~/imessage-keepintouch/` (separate Python project)
- This CRM receives contact data via sync-agent push, doesn't read chat.db directly
- The sync-agent bridges local SQLite (`~/.keepintouch/contacts.db`) → CRM API

### Message Generation
- **Not implemented yet.** Settings page has AI provider selector (OpenRouter/Ollama/Anthropic) but no actual generation code exists in the codebase
- Message model exists for tracking (status: draft/sent/failed) but creation is manual

### 30-Minute Sync Cycle
- macOS LaunchAgent runs `sync-agent/crm_sync_agent.py` every 1800 seconds
- Push flow: Local SQLite → enrich with topics/context → POST `/api/contacts/sync`
- Pull flow: GET `/api/contacts?since=<timestamp>` → update local SQLite
- Health check first — graceful exit if CRM is offline
- Audit logging via POST `/api/sync/log`

---

## 3. Data Flow & Integration Points

```
┌─────────────────────────────────────────────────────────────────────┐
│ macOS (iMac M1 / MacBook Pro)                                       │
│                                                                     │
│  ~/imessage-keepintouch/     ~/.keepintouch/contacts.db             │
│  (Python scripts,            (local SQLite: contacts,               │
│   chat.db reading,            contact_topics,                       │
│   contact discovery)          contact_context)                      │
│         │                           │                               │
│         └──── populates ────────────┘                               │
│                                     │                               │
│  sync-agent/crm_sync_agent.py  ─────┤  (every 30 min)              │
│         │                           │                               │
│         │  Also reads:              │                               │
│         │  Apple Contacts           │                               │
│         │  (via osascript)          │                               │
└─────────┼───────────────────────────┼───────────────────────────────┘
          │                           │
          │  HTTPS (push/pull)        │
          ▼                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Railway (Production)                                                │
│                                                                     │
│  Next.js App ──── Prisma ──── PostgreSQL                            │
│  /api/contacts/sync  (POST - bulk upsert)                           │
│  /api/contacts       (GET - pull changes)                           │
│  /api/sync/log       (POST - audit trail)                           │
│  /api/health         (GET - connectivity check)                     │
└─────────────────────────────────────────────────────────────────────┘
```

### API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/health` | GET | No | Health check |
| `/api/contacts` | GET | Yes | List/filter contacts |
| `/api/contacts` | POST | Yes | Create contact |
| `/api/contacts/[id]` | GET | Yes | Get single contact |
| `/api/contacts/[id]` | PUT | Yes | Update contact |
| `/api/contacts/[id]` | DELETE | Yes | Archive (soft delete) |
| `/api/contacts/sync` | POST | Yes | Bulk upsert from sync agent |
| `/api/contacts/frequencies` | GET | Yes | List active contacts by nextDue |
| `/api/messages` | GET | Yes | List messages |
| `/api/messages` | POST | Yes | Create message + update lastContact |
| `/api/sync/log` | GET | Yes | List sync logs |
| `/api/sync/log` | POST | Yes | Record sync event |

### External APIs (referenced but not implemented)
- **OpenRouter** — mentioned in settings, no API calls in code
- **Ollama** — mentioned in settings, no API calls in code
- **Anthropic** — mentioned in settings, no API calls in code
- **Apple Contacts** — read via osascript in sync-agent (non-critical, fails gracefully)

---

## 4. File-by-File Map

### Root Configuration
| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts (dev/build/start/db:migrate/db:push/db:seed) |
| `next.config.js` | Standalone output mode |
| `tsconfig.json` | Strict TS, `@/*` path alias → `./src/*` |
| `tailwind.config.ts` | Dark mode, category colors, CSS variable theme |
| `postcss.config.js` | Tailwind + autoprefixer |
| `railway.json` | NIXPACKS builder, migrate-on-start, restart policy |
| `.eslintrc.json` | next/core-web-vitals |
| `.env.example` | DATABASE_URL, API_KEY, NEXT_PUBLIC_APP_URL templates |
| `.gitignore` | Standard Next.js + prisma/dev.db |

### Prisma
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | 5 models (Contact, SecondaryPhone, Message, SyncLog, Setting) |
| `prisma/migrations/0001_init/migration.sql` | Initial schema, 8 indexes, FK constraints |
| `prisma/seed.ts` | Default settings + sample contact |

### Sync Agent
| File | Purpose |
|------|---------|
| `sync-agent/crm_sync_agent.py` | Python sync script: push/pull contacts, health check, Apple Contacts |
| `sync-agent/com.deltakinetics.keepintouch.crmsync.plist` | LaunchAgent config (30-min interval) |
| `sync-agent/install.sh` | Copies plist to ~/Library/LaunchAgents, instructions |

### Source: Pages (src/app/)
| File | Purpose |
|------|---------|
| `layout.tsx` | Root layout: dark mode, Inter font, sidebar + mobile nav |
| `page.tsx` | Dashboard: stats, overdue list, category chart, last sync |
| `contacts/page.tsx` | Contact list with search/filter/sort |
| `contacts/[id]/page.tsx` | Contact detail: stats, edit form, message history |
| `messages/page.tsx` | Message log (last 100, filterable by contact) |
| `queue/page.tsx` | Outreach queue: overdue + upcoming 7 days |
| `settings/page.tsx` | App settings (frequency, AI provider, send window) |
| `sync/page.tsx` | Sync log viewer |

### Source: API Routes (src/app/api/)
| File | Purpose |
|------|---------|
| `health/route.ts` | GET health check |
| `contacts/route.ts` | GET list / POST create |
| `contacts/[id]/route.ts` | GET/PUT/DELETE single contact |
| `contacts/sync/route.ts` | POST bulk upsert |
| `contacts/frequencies/route.ts` | GET active contact frequencies |
| `messages/route.ts` | GET list / POST create (auto-updates lastContact) |
| `sync/log/route.ts` | GET list / POST create |

### Source: Components (src/components/)
| File | Purpose |
|------|---------|
| `layout/sidebar.tsx` | Desktop sidebar nav (6 items) |
| `layout/mobile-nav.tsx` | Mobile bottom nav (5 items) |
| `dashboard/stats-cards.tsx` | 4 stat cards (total, active, messages, overdue) |
| `dashboard/overdue-list.tsx` | Overdue contacts with severity badges |
| `dashboard/category-chart.tsx` | Recharts donut chart by category |
| `contacts/contacts-table.tsx` | Responsive contact table with status |
| `contacts/search-filter.tsx` | Search + category + KIT status filters |
| `contacts/contact-form.tsx` | Full contact edit form (8.2K, largest component) |
| `contacts/frequency-slider.tsx` | 1-90 day slider with preset buttons |
| `contacts/message-history.tsx` | Message list for contact detail |
| `queue/queue-card.tsx` | Queue item with mark-contacted + snooze actions |
| `ui/*.tsx` | 17 Shadcn/ui components (Radix primitives + Tailwind) |

### Source: Libraries (src/lib/)
| File | Purpose |
|------|---------|
| `prisma.ts` | Prisma client singleton (prevents multiple instances) |
| `auth.ts` | API key validation + same-origin check |
| `utils.ts` | cn(), getDaysOverdue(), getNextDueDate(), formatDate/Relative, category constants |

---

## 5. Existing Patterns & Conventions

### Commit Prefixes
- `cursor:` for Cursor-assisted work
- `claude:` for Claude Code-assisted work
- 3 commits total on main

### Session Continuity
- No HANDOFF.md exists yet
- No CLAUDE.md exists yet
- No `.claude/` directory

### Code Patterns
- **API auth**: All API routes call `validateApiKey(request)` first, return `unauthorizedResponse()` on failure
- **Soft delete**: Contacts archived via `archived: true` flag, never hard-deleted
- **NextDue auto-calc**: `nextDue` recalculated whenever `lastContact` or `frequencyDays` changes
- **Prisma singleton**: Global instance reused in dev to prevent connection exhaustion
- **Dynamic pages**: Server components use `export const dynamic = 'force-dynamic'`
- **Client components**: Form/interactive components use `'use client'` directive
- **Category colors**: Defined in both `utils.ts` (Tailwind classes) and `tailwind.config.ts` (hex values)
- **No error boundaries or loading states**: Pages don't have error.tsx or loading.tsx files

### Missing Patterns
- No logging framework (just console output in sync-agent)
- No retry logic in API routes
- No rate limiting
- No input validation beyond basic type checking
- No tests of any kind

---

## 6. Pain Points & Complexity Hotspots

### Largest / Most Complex Files
1. `src/components/contacts/contact-form.tsx` (8.2K) — full CRUD form with many fields
2. `src/components/ui/dropdown-menu.tsx` (7.1K) — Radix wrapper (boilerplate, not complex)
3. `src/app/settings/page.tsx` (5.7K) — settings UI with multiple sections
4. `src/components/ui/select.tsx` (5.5K) — Radix wrapper
5. `sync-agent/crm_sync_agent.py` (~200 lines) — entire sync logic in one file

### Common Failure Modes
1. **Sync agent silently fails**: CRM_URL and CRM_API_KEY are placeholders in the plist — sync won't work until manually configured
2. **NextDue calculation drift**: If a contact is marked contacted via the API but the sync agent also pushes an older lastContact, nextDue could regress
3. **No conflict resolution**: Push-then-pull pattern means CRM wins on pull, but there's no merge logic for simultaneous edits
4. **SQLite in dev vs PostgreSQL in prod**: Prisma abstracts most differences, but edge cases exist (e.g., case sensitivity, date handling)
5. **No message sending**: The message model tracks drafts/sent status but nothing actually sends iMessages — that lives in the separate imessage-keepintouch repo

### What Requires Manual Intervention
1. Installing the LaunchAgent (run install.sh, edit plist with real URLs/keys)
2. Seeding the database (`npm run db:seed`)
3. Configuring environment variables on Railway
4. Any AI-generated message workflow (not implemented)
5. Keeping the two repos (CRM + imessage scripts) in sync conceptually

### What a New Developer Would Struggle With
1. **Two-repo architecture**: Understanding that the CRM is only half the system, and the iMessage scripts are a separate project
2. **Local SQLite schema undocumented**: The sync-agent assumes tables (contacts, contact_topics, contact_context) that aren't defined anywhere in this repo
3. **No README**: No onboarding documentation exists
4. **Settings page is cosmetic**: AI provider settings are stored but don't drive any behavior yet
5. **Category system is implicit**: Categories are hardcoded strings in utils.ts and tailwind.config.ts, not an enum or database table
6. **Sync agent environment**: Understanding the LaunchAgent + plist + local paths + log locations

---

## 7. Database Schema Summary

```prisma
model Contact {
  id              String    @id @default(cuid())
  name            String
  phone           String
  email           String?
  relationship    String?
  category        String?
  notes           String?
  frequencyDays   Int       @default(14)
  lastContact     DateTime?
  nextDue         DateTime?
  kitActive       Boolean   @default(true)
  archived        Boolean   @default(false)
  appleContactId  String?
  localSqliteId   String?
  topics          String?
  context         String?
  secondaryPhones SecondaryPhone[]
  messages        Message[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@index([kitActive]) @@index([nextDue]) @@index([category]) @@index([archived])
}

model SecondaryPhone { id, phone, label, contactId → Contact (cascade) }
model Message { id, contactId → Contact (cascade), message, status, sentAt, createdAt }
model SyncLog { id, direction, source, status, details, contacts, createdAt }
model Setting { id, key (unique), value }
```

---

## 8. What Exists vs. What's Missing

| Feature | Status | Notes |
|---------|--------|-------|
| Contact CRUD | Done | Full API + UI |
| Contact scheduling | Done | Frequency-based, auto nextDue |
| Contact categories | Done | 6 categories, color-coded |
| Dashboard | Done | Stats, overdue, chart |
| Queue/outreach | Done | Overdue + upcoming, snooze |
| Message tracking | Partial | Model exists, manual creation only |
| Sync (local → CRM) | Done | Python agent, 30-min cycle |
| Sync (CRM → local) | Done | Pull with since parameter |
| AI message generation | Not started | Settings UI exists, no backend |
| iMessage sending | Not in repo | Lives in ~/imessage-keepintouch/ |
| Search & filter | Done | By name, category, KIT status |
| Soft delete/archive | Done | Archived flag |
| Auth | Basic | API key + same-origin check |
| Tests | None | No test files exist |
| Documentation | None | No README, HANDOFF, or CLAUDE.md |
| Error handling | Minimal | Try/catch in API routes, no user-facing errors |
| Loading states | None | No loading.tsx or skeleton UI |
