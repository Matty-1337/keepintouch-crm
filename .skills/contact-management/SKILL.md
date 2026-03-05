---
name: contact-management
description: >
  Use this skill for ANY work involving contacts in the Keep-In-Touch CRM: creating,
  editing, categorizing, or archiving contacts; adjusting contact frequency or KIT
  scheduling; working with the outreach queue; understanding the category system
  (Baseball, WHAM, Professional, Friend, Student, Hospitality); contact scoring,
  overdue logic, or snooze functionality; deduplication; search and filtering;
  or anything related to the Contact, SecondaryPhone, or relationship models.
  Trigger on: contact, category, frequency, overdue, queue, snooze, archive,
  KIT active, nextDue, scoring, relationship, dedup, secondary phone.
---

# Contact Management Skill

You are working on the contact management system for the Keep-In-Touch CRM.
This system helps users maintain regular contact with important people through
frequency-based scheduling.

## Core Concepts

### Contact Lifecycle
1. **Created** — via UI form, API, or sync agent push
2. **Active (KIT)** — `kitActive: true`, appears in queue when overdue
3. **Archived** — `archived: true`, soft-deleted, excluded from all views

### Frequency Scheduling
Every active contact has a `frequencyDays` value (1-90 days, default 14).
The system tracks when you last contacted someone and calculates when you're next due:

```
nextDue = lastContact + frequencyDays
overdue = nextDue <= now
daysOverdue = differenceInDays(now, nextDue)
```

**Frequency presets** (from `src/components/contacts/frequency-slider.tsx`):
| Label | Days |
|-------|------|
| Daily | 1 |
| Weekly | 7 |
| Bi-weekly | 14 |
| Monthly | 30 |
| Bi-monthly | 60 |
| Quarterly | 90 |

### Overdue Severity
Displayed in the queue and contact list with color coding:
- **Red**: >7 days overdue
- **Orange**: 3-7 days overdue
- **Yellow**: 1-3 days overdue
- **Green**: On track (not overdue)

### Queue System
The queue page (`src/app/queue/page.tsx`) shows two sections:
1. **Due Now** — contacts where `nextDue <= now` (sorted by most overdue first)
2. **Coming Up** — contacts due in next 7 days (limit 10)

Queue actions (in `src/components/queue/queue-card.tsx`):
- **Mark Contacted**: Sets `lastContact = now`, recalculates `nextDue`, refreshes page
- **Snooze 7d**: Adds 7 days to `nextDue` without updating `lastContact`
- **View**: Links to contact detail page

## Category System

6 categories with distinct colors (defined in `src/lib/utils.ts` and `tailwind.config.ts`):

| Category | Tailwind Class | Hex Color | Description |
|----------|---------------|-----------|-------------|
| Baseball | `bg-blue-500/10 text-blue-400` | `#3b82f6` | Baseball community contacts |
| WHAM | `bg-green-500/10 text-green-400` | `#22c55e` | WHAM network contacts |
| Professional | `bg-purple-500/10 text-purple-400` | `#a855f7` | Professional/business contacts |
| Friend | `bg-orange-500/10 text-orange-400` | `#f97316` | Personal friends |
| Student | `bg-gray-500/10 text-gray-400` | `#6b7280` | Students/mentees |
| Hospitality | `bg-amber-500/10 text-amber-400` | `#f59e0b` | Hospitality industry contacts |

Categories are hardcoded strings, NOT a database enum. To add a new category:
1. Add to `CATEGORY_OPTIONS` in `src/lib/utils.ts`
2. Add color to `CATEGORY_COLORS` in `src/lib/utils.ts`
3. Add hex color to `CATEGORY_CHART_COLORS` in `src/lib/utils.ts`
4. Add Tailwind config entry in `tailwind.config.ts` under `theme.extend.colors`

## Relationship Types

7 relationship types (defined in `src/lib/utils.ts`):
`partner`, `friend`, `professional`, `family`, `mentor`, `student`, `colleague`

## Contact Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | String | Yes | Display name |
| phone | String | Yes | Primary phone number |
| email | String | No | Email address |
| relationship | String | No | One of 7 relationship types |
| category | String | No | One of 6 categories |
| notes | String | No | General notes |
| frequencyDays | Int | No | Default 14, range 1-90 |
| lastContact | DateTime | No | When you last reached out |
| nextDue | DateTime | Auto | Calculated from lastContact + frequencyDays |
| kitActive | Boolean | No | Default true |
| archived | Boolean | No | Default false |
| topics | String | No | Comma-separated interest topics |
| context | String | No | Freetext relationship context |
| appleContactId | String | No | Apple Contacts ID from sync |
| localSqliteId | String | No | Local SQLite ID from sync |

## Key Components

### Contact Form (`src/components/contacts/contact-form.tsx`)
The largest component (8.2K). Sections:
1. KIT Toggle — switch button to enable/disable KIT
2. Frequency Slider — only shown when KIT active
3. Basic Info — name, phone, email, relationship, category
4. Topics & Context — topics (comma-separated), notes, context
5. Actions — Save (PUT), Archive (DELETE soft)

### Contacts Table (`src/components/contacts/contacts-table.tsx`)
Responsive table showing all contacts. Columns:
- Name (always visible, shows category badge on mobile)
- Category (hidden on mobile)
- Frequency (hidden on tablet)
- Last Contact (always visible)
- Status (hidden on mobile) — "On track" / "X days overdue" / "Inactive"

### Search & Filter (`src/components/contacts/search-filter.tsx`)
URL-based filtering with three controls:
- Text search (case-insensitive name matching)
- Category dropdown
- KIT status dropdown (All/Active/Inactive)

## Common Tasks

### Adding a New Category
See the 4-step process in the Category System section above.

### Changing the Default Frequency
Update the seed in `prisma/seed.ts` (key: `defaultFrequency`).
The settings page UI allows changing this at runtime via the Setting model.

### Implementing Contact Scoring
Currently uses simple frequency scheduling. To add scoring:
1. Add a `score` field to the Contact model
2. Create a scoring function considering: frequency adherence, message count, relationship type
3. Add a recalculation trigger on contact update and message creation
4. Update the queue to sort by score instead of (or in addition to) nextDue

## Dependencies
- **crm-backend**: This skill depends on the Prisma schema and API routes defined in crm-backend
