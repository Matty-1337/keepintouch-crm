# Prisma Schema Reference

Complete model definitions for the Keep-In-Touch CRM.

Source: `prisma/schema.prisma`

---

## Contact

The core entity. Represents a person you want to keep in touch with.

```prisma
model Contact {
  id              String           @id @default(cuid())
  name            String
  phone           String
  email           String?
  relationship    String?          // partner, friend, professional, family, mentor, student, colleague
  category        String?          // Baseball, WHAM, Professional, Friend, Student, Hospitality
  notes           String?
  frequencyDays   Int              @default(14)   // 1-90 days between contacts
  lastContact     DateTime?
  nextDue         DateTime?        // auto-calculated: lastContact + frequencyDays
  kitActive       Boolean          @default(true) // Keep-In-Touch active flag
  archived        Boolean          @default(false) // soft delete
  appleContactId  String?          // Apple Contacts ID (from osascript)
  localSqliteId   String?          // ID in local ~/.keepintouch/contacts.db
  topics          String?          // comma-separated interest topics
  context         String?          // freetext relationship context
  secondaryPhones SecondaryPhone[]
  messages        Message[]
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([kitActive])
  @@index([nextDue])
  @@index([category])
  @@index([archived])
}
```

**Index strategy**: kitActive and nextDue are indexed because the queue page queries
`WHERE kitActive = true AND nextDue <= now()` on every load. Category is indexed
for the dashboard aggregation. Archived is indexed to exclude archived contacts efficiently.

---

## SecondaryPhone

Additional phone numbers for a contact.

```prisma
model SecondaryPhone {
  id        String  @id @default(cuid())
  phone     String
  label     String  @default("mobile") // mobile, home, work, etc.
  contactId String
  contact   Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
}
```

---

## Message

Tracks outreach messages (drafts, sent, failed).

```prisma
model Message {
  id        String   @id @default(cuid())
  contactId String
  contact   Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  message   String
  status    String   @default("draft") // draft, sent, failed
  sentAt    DateTime?
  createdAt DateTime @default(now())

  @@index([contactId])
  @@index([sentAt])
}
```

**Lifecycle**: Messages start as "draft". When marked "sent", the API auto-updates
the parent Contact's `lastContact` to now and recalculates `nextDue`.

---

## SyncLog

Audit trail for sync operations between local Mac and Railway CRM.

```prisma
model SyncLog {
  id        String   @id @default(cuid())
  direction String   // "push" (local→CRM) or "pull" (CRM→local)
  source    String   // "mac-sync-agent", "manual", etc.
  status    String   // "success", "partial", "failed"
  details   String   @default("")
  contacts  Int      @default(0) // number of contacts affected
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

---

## Setting

Key-value store for application configuration.

```prisma
model Setting {
  id    String @id @default(cuid())
  key   String @unique
  value String
}
```

**Default settings** (from `prisma/seed.ts`):
| Key | Default Value | Purpose |
|-----|---------------|---------|
| `defaultFrequency` | `"14"` | Default days between contacts |
| `aiProvider` | `"openrouter"` | AI provider for message generation |
| `messageWindowStart` | `"09:00"` | Earliest time to send messages |
| `messageWindowEnd` | `"20:00"` | Latest time to send messages |

---

## Common Query Patterns

### Dashboard stats
```typescript
const [totalContacts, kitActive, totalMessages, overdueCount] = await Promise.all([
  prisma.contact.count({ where: { archived: false } }),
  prisma.contact.count({ where: { kitActive: true, archived: false } }),
  prisma.message.count(),
  prisma.contact.count({
    where: { kitActive: true, archived: false, nextDue: { lte: new Date() } }
  }),
])
```

### Category breakdown
```typescript
const categories = await prisma.contact.groupBy({
  by: ['category'],
  _count: { category: true },
  where: { archived: false },
})
```

### Overdue contacts for queue
```typescript
const overdue = await prisma.contact.findMany({
  where: { kitActive: true, archived: false, nextDue: { lte: new Date() } },
  orderBy: { nextDue: 'asc' },
})
```

### Contact with relations
```typescript
const contact = await prisma.contact.findUnique({
  where: { id },
  include: {
    secondaryPhones: true,
    messages: { orderBy: { createdAt: 'desc' }, take: 20 },
  },
})
```

### Bulk upsert (sync)
```typescript
const existing = await prisma.contact.findFirst({
  where: { OR: [
    { localSqliteId: contact.localSqliteId },
    { phone: contact.phone },
  ]},
})
if (existing) {
  await prisma.contact.update({ where: { id: existing.id }, data: { ... } })
} else {
  await prisma.contact.create({ data: { ... } })
}
```
