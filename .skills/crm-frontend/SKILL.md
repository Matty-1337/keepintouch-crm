---
name: crm-frontend
description: >
  Use this skill for ANY frontend or UI work on the Keep-In-Touch CRM: creating or
  modifying React components, pages, layouts; working with Tailwind CSS dark theme;
  using Radix UI / Shadcn primitives; building forms, tables, charts; responsive
  design; the sidebar or mobile navigation; dashboard widgets; or any visual/UX
  changes. Trigger on: component, page, UI, form, dashboard, sidebar, Tailwind,
  Radix, Shadcn, dark mode, responsive, layout, chart, table, mobile nav, toast,
  dialog, badge, button, card, icon, lucide.
---

# CRM Frontend Skill

You are working on the Keep-In-Touch CRM frontend — a Next.js 14 App Router
application with React 18, Tailwind CSS, Radix UI (Shadcn/ui), and Recharts.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 14.2.35 | App Router, server/client components |
| React | 18.3.1 | UI framework |
| Tailwind CSS | 3.4.17 | Styling (dark mode, class-based) |
| Radix UI | Various | Accessible primitives (via Shadcn/ui) |
| Recharts | 2.15.1 | Charts (dashboard donut) |
| lucide-react | 0.474.0 | Icons |
| date-fns | 4.1.0 | Date formatting |
| tailwind-merge | 3.0.1 | Class merging with `cn()` |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout (dark mode, sidebar, mobile nav)
│   ├── page.tsx            # Dashboard
│   ├── contacts/
│   │   ├── page.tsx        # Contact list with search/filter
│   │   └── [id]/page.tsx   # Contact detail
│   ├── queue/page.tsx      # Outreach queue
│   ├── messages/page.tsx   # Message history
│   ├── settings/page.tsx   # App settings
│   ├── sync/page.tsx       # Sync log viewer
│   └── api/                # API routes (see crm-backend skill)
├── components/
│   ├── layout/             # Sidebar, mobile nav
│   ├── dashboard/          # Stats cards, overdue list, category chart
│   ├── contacts/           # Contact form, table, search, frequency slider
│   ├── queue/              # Queue card
│   └── ui/                 # 17 Shadcn/ui primitives
└── lib/
    ├── utils.ts            # cn(), date helpers, category constants
    ├── prisma.ts           # Prisma singleton
    └── auth.ts             # API auth
```

## Conventions

### Server vs Client Components
- **Server components** (default): Pages that fetch data. Use `export const dynamic = 'force-dynamic'`
- **Client components**: Interactive components. Use `'use client'` directive at top
- Pattern: Server page fetches data via Prisma, passes to client components as props

### Dark Theme
The app uses Tailwind dark mode (class-based). The root `<html>` tag has `className="dark"`.
All colors use CSS variables defined in `globals.css` and mapped in `tailwind.config.ts`.

Key dark theme colors:
- Background: `hsl(var(--background))` → dark navy
- Foreground: `hsl(var(--foreground))` → light gray
- Card: `hsl(var(--card))` → slightly lighter dark
- Primary: `hsl(var(--primary))` → accent color
- Muted: `hsl(var(--muted))` → subdued elements

### Category Colors
Defined in TWO places (must stay in sync):

1. `src/lib/utils.ts` — `CATEGORY_COLORS` (Tailwind classes for badges):
```typescript
export const CATEGORY_COLORS: Record<string, string> = {
  'Baseball': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'WHAM': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Professional': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Friend': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Student': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  'Hospitality': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}
```

2. `src/lib/utils.ts` — `CATEGORY_CHART_COLORS` (hex for Recharts):
```typescript
export const CATEGORY_CHART_COLORS: Record<string, string> = {
  'Baseball': '#3b82f6', 'WHAM': '#22c55e', 'Professional': '#a855f7',
  'Friend': '#f97316', 'Student': '#6b7280', 'Hospitality': '#f59e0b',
}
```

### Utility Function: `cn()`
Merges Tailwind classes safely:
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

### Date Formatting
```typescript
import { formatDate, formatRelativeDate, getDaysOverdue } from '@/lib/utils'

formatDate(date)          // "Mar 4, 2026"
formatRelativeDate(date)  // "Today", "Yesterday", "3d ago", "2w ago", "1mo ago"
getDaysOverdue(nextDue)   // positive number = overdue, negative = not yet due
```

## Shadcn/ui Components Available

17 pre-built components in `src/components/ui/`:

| Component | File | Import |
|-----------|------|--------|
| Badge | `badge.tsx` | `@/components/ui/badge` |
| Button | `button.tsx` | `@/components/ui/button` |
| Card | `card.tsx` | `@/components/ui/card` |
| Dialog | `dialog.tsx` | `@/components/ui/dialog` |
| DropdownMenu | `dropdown-menu.tsx` | `@/components/ui/dropdown-menu` |
| Input | `input.tsx` | `@/components/ui/input` |
| Label | `label.tsx` | `@/components/ui/label` |
| Select | `select.tsx` | `@/components/ui/select` |
| Separator | `separator.tsx` | `@/components/ui/separator` |
| Slider | `slider.tsx` | `@/components/ui/slider` |
| Switch | `switch.tsx` | `@/components/ui/switch` |
| Tabs | `tabs.tsx` | `@/components/ui/tabs` |
| Textarea | `textarea.tsx` | `@/components/ui/textarea` |
| Toast | `toast.tsx` | `@/components/ui/toast` |
| Toaster | `toaster.tsx` | `@/components/ui/toaster` |
| Tooltip | `tooltip.tsx` | `@/components/ui/tooltip` |
| useToast | `use-toast.ts` | `@/components/ui/use-toast` |

### Button Variants
```tsx
<Button variant="default">Primary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Secondary</Button>
<Button variant="ghost">Subtle</Button>
<Button variant="link">Link style</Button>
<Button size="sm">Small</Button>
<Button size="icon"><Icon /></Button>
```

## Navigation

### Desktop Sidebar (`src/components/layout/sidebar.tsx`)
Fixed left sidebar, width-64. 6 nav items:
- Dashboard (LayoutDashboard icon)
- Contacts (Users icon)
- Queue (ListChecks icon)
- Messages (MessageSquare icon)
- Sync (RefreshCw icon)
- Settings (Settings icon)

### Mobile Nav (`src/components/layout/mobile-nav.tsx`)
Fixed bottom bar, `md:hidden`. 5 nav items (excludes Sync).

## Responsive Breakpoints
Standard Tailwind: `sm` (640px), `md` (768px), `lg` (1024px).
- Sidebar: Hidden on mobile, visible on `md:`
- Mobile nav: Visible on mobile, hidden on `md:`
- Tables: Columns hide progressively on smaller screens

## What's Missing (Opportunities)
- No `loading.tsx` or skeleton UI for any page
- No `error.tsx` error boundaries
- No empty states beyond basic "No X yet" text
- No toast notifications on form actions
- No confirmation dialogs on destructive actions
- No pagination on contacts list or messages
