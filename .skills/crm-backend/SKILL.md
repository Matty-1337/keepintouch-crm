---
name: crm-backend
description: >
  Use this skill for ANY backend work on the Keep-In-Touch CRM: Prisma schema changes,
  database migrations, API route development, query optimization, adding/modifying
  endpoints, auth middleware, seed data, or debugging database issues. Trigger when
  the user mentions prisma, schema, migration, database, query, API route, endpoint,
  route.ts, auth, API key, validateApiKey, db:push, db:migrate, db:seed, PostgreSQL,
  SQLite, Contact model, Message model, SyncLog, Setting model, or any CRUD operation
  on the CRM data.
---

# CRM Backend — Database & API Skill

You are working on the Keep-In-Touch CRM backend: a Next.js 14 App Router application
using Prisma ORM with PostgreSQL (production on Railway) and SQLite (local development).

## Architecture Overview

- **ORM**: Prisma 6.4.1 with `@prisma/client`
- **Schema**: `prisma/schema.prisma` — 5 models
- **Migrations**: `prisma/migrations/` — run via `npx prisma migrate dev` (local) or `npx prisma migrate deploy` (prod)
- **API routes**: `src/app/api/` — Next.js App Router route handlers
- **Auth**: `src/lib/auth.ts` — API key validation via `X-API-Key` header or same-origin referer
- **Client singleton**: `src/lib/prisma.ts` — prevents multiple PrismaClient instances in dev

## Database Models

See `references/schema.md` for complete model definitions. Summary:

| Model | Purpose | Key Fields |
|-------|---------|------------|
| Contact | Core entity | name, phone, category, frequencyDays, lastContact, nextDue, kitActive, archived |
| SecondaryPhone | Additional phone numbers | phone, label, contactId → Contact |
| Message | Outreach tracking | contactId → Contact, message, status (draft/sent/failed), sentAt |
| SyncLog | Sync audit trail | direction (push/pull), source, status, details, contacts count |
| Setting | Key-value config | key (unique), value |

## Key Patterns

### NextDue Calculation
Whenever `lastContact` or `frequencyDays` changes, recalculate `nextDue`:
```typescript
import { addDays } from 'date-fns'
const nextDue = lastContact ? addDays(new Date(lastContact), frequencyDays) : null
```
This happens in:
- `PUT /api/contacts/[id]` — when updating a contact
- `POST /api/messages` — when creating a message with status "sent"
- `POST /api/contacts/sync` — during bulk sync

### API Route Pattern
Every API route follows this structure:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateApiKey, unauthorizedResponse } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request)
  if (authError) return unauthorizedResponse()

  try {
    const data = await prisma.contact.findMany({ /* ... */ })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

### Auth Flow
`validateApiKey()` in `src/lib/auth.ts` checks two things:
1. Same-origin: If request referer/origin matches `NEXT_PUBLIC_APP_URL`, allow (browser requests)
2. API key: If `X-API-Key` header matches `API_KEY` env var, allow (sync agent, external calls)

### Soft Delete
Contacts are never hard-deleted. `DELETE /api/contacts/[id]` sets `archived: true`.

### Dual Database
- Dev: `DATABASE_URL="file:./dev.db"` (SQLite at `prisma/dev.db`)
- Prod: `DATABASE_URL="postgresql://..."` (Railway PostgreSQL)
- Prisma abstracts most differences, but be aware of case sensitivity differences

## API Endpoints

See `references/api-endpoints.md` for full request/response examples. Quick reference:

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/health` | GET | Health check (no auth) |
| `/api/contacts` | GET, POST | List/create contacts |
| `/api/contacts/[id]` | GET, PUT, DELETE | Single contact CRUD |
| `/api/contacts/sync` | POST | Bulk upsert from sync agent |
| `/api/contacts/frequencies` | GET | Active contacts by nextDue |
| `/api/messages` | GET, POST | List/create messages |
| `/api/sync/log` | GET, POST | Sync audit log |

## Common Tasks

### Adding a New Field to Contact
1. Add field to `prisma/schema.prisma` Contact model
2. Run `npx prisma migrate dev --name add-field-name`
3. Update relevant API routes to accept/return the new field
4. Update `src/components/contacts/contact-form.tsx` if UI-editable
5. Update `sync-agent/crm_sync_agent.py` if the field should sync

### Creating a New API Endpoint
1. Create `src/app/api/{resource}/route.ts`
2. Import prisma, auth helpers
3. Add `validateApiKey()` check
4. Use Prisma client for data operations
5. Return `NextResponse.json()`

### Running Migrations
```bash
# Local development
npx prisma migrate dev --name description-of-change

# Push schema without migration (dev only)
npx prisma db push

# Production (runs automatically on Railway deploy)
npx prisma migrate deploy

# Seed database
npm run db:seed
```

## Environment Variables
| Variable | Used In | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | prisma/schema.prisma | Database connection |
| `API_KEY` | src/lib/auth.ts | API authentication secret |
| `NEXT_PUBLIC_APP_URL` | src/lib/auth.ts | Same-origin validation |

## Files to Know
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Data model definitions |
| `prisma/seed.ts` | Database seeding script |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/auth.ts` | API key validation |
| `src/app/api/contacts/route.ts` | Contact list + create |
| `src/app/api/contacts/[id]/route.ts` | Contact get/update/archive |
| `src/app/api/contacts/sync/route.ts` | Bulk sync endpoint |
| `src/app/api/messages/route.ts` | Message list + create |
