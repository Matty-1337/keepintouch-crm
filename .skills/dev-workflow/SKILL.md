---
name: dev-workflow
description: >
  Use this skill for development workflow tasks on the Keep-In-Touch CRM: maintaining
  HANDOFF.md for session continuity, following commit conventions (claude:/cursor:
  prefixes), local development setup, understanding the two-repo architecture,
  onboarding a new developer, or managing the development environment. Trigger on:
  HANDOFF, commit, session, setup, local dev, dev environment, onboarding, getting
  started, clone, npm install, two repos, commit message, commit prefix.
---

# Development Workflow Skill

You are working on the Keep-In-Touch CRM development workflow. This skill covers
conventions, setup, and session continuity patterns.

## Two-Repo Architecture

This project spans two repositories:

| Repo | Location | Purpose | Runs On |
|------|----------|---------|---------|
| `keepintouch-crm` | `~/keepintouch-crm/` | Next.js CRM web app + sync agent | Railway (web) + Mac (sync agent) |
| `imessage-keepintouch` | `~/imessage-keepintouch/` | iMessage reading, contact discovery, message sending | Mac only (needs chat.db) |

The sync agent in `keepintouch-crm/sync-agent/` bridges the two by pushing local
SQLite data to the Railway CRM API.

## Commit Conventions

| Prefix | When to Use |
|--------|-------------|
| `claude:` | Commits made with Claude Code assistance |
| `cursor:` | Commits made with Cursor assistance |

Examples:
```
claude: add contact scoring algorithm
cursor: fix responsive layout on queue page
claude: build complete skills system for keepintouch-crm
```

## HANDOFF.md

Update `HANDOFF.md` at the repo root at the end of every coding session. Template:

```markdown
# HANDOFF — Keep-In-Touch CRM

## Last Session
- **Date**: YYYY-MM-DD
- **Focus**: What was worked on
- **Status**: What was completed / what's in progress

## Current State
- [ ] In-progress task 1
- [ ] In-progress task 2
- [x] Completed task

## Next Steps
1. Priority task
2. Follow-up task

## Known Issues
- Issue description and where it manifests

## Environment Notes
- Any env-specific context for the next session
```

## Local Development Setup

### Prerequisites
- Node.js (LTS)
- Python 3 (for sync agent)
- Git

### First-Time Setup
```bash
# Clone
git clone https://github.com/Matty-1337/keepintouch-crm.git
cd keepintouch-crm

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local — defaults work for local dev (SQLite)

# Set up database
npx prisma migrate dev
npm run db:seed

# Start dev server
npm run dev
# Open http://localhost:3000
```

### Available Scripts
```bash
npm run dev          # Start Next.js dev server
npm run build        # Build for production (prisma generate + next build)
npm run start        # Start production server
npm run lint         # ESLint
npm run db:migrate   # prisma migrate dev
npm run db:push      # prisma db push (no migration file)
npm run db:seed      # tsx prisma/seed.ts
```

### Local vs Production Database
- **Local**: SQLite at `prisma/dev.db` (`DATABASE_URL="file:./dev.db"`)
- **Production**: PostgreSQL on Railway
- Prisma handles the abstraction, but test migrations against PostgreSQL before deploying

## Project Structure Quick Reference

```
keepintouch-crm/
├── .skills/              # Claude Code skills (this system)
├── prisma/
│   ├── schema.prisma     # Data model
│   ├── migrations/       # Migration history
│   └── seed.ts           # Database seed
├── src/
│   ├── app/              # Pages + API routes
│   ├── components/       # React components
│   └── lib/              # Utilities, auth, Prisma client
├── sync-agent/           # Python sync agent + LaunchAgent
├── .env.example          # Environment template
├── railway.json          # Railway deployment config
├── REPO_AUDIT.md         # Full repo audit
└── HANDOFF.md            # Session continuity doc
```

## Mac Environment

| Detail | Value |
|--------|-------|
| Machine | 2017 MacBook Pro 13" Intel |
| RAM | 16 GB |
| OS | macOS Ventura 13.6.7 |
| User | `apple2` |
| Node | LTS |
| Python | 3.x (system) |
| Local contacts DB | `~/.keepintouch/contacts.db` |
| Sync logs | `~/.keepintouch/crm_sync_*.log` |

## Git Workflow
- Single branch: `main`
- Push to GitHub → Railway auto-deploys
- No PR process currently (solo developer)
- GitHub repo: `Matty-1337/keepintouch-crm`
