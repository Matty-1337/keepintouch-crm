# Skills Index — Keep-In-Touch CRM

## Skill Inventory

| # | Skill | Category | Priority | Trigger Keywords |
|---|-------|----------|----------|-----------------|
| 1 | `crm-backend` | Backend | P0 | prisma, schema, migration, database, query, API route, endpoint, auth, route.ts |
| 2 | `contact-management` | Contacts | P0 | contact, category, frequency, overdue, queue, snooze, archive, KIT, nextDue |
| 3 | `sync-agent` | Sync | P0 | sync, LaunchAgent, push, pull, plist, crm_sync, 30-minute |
| 4 | `crm-frontend` | Frontend | P1 | component, page, UI, form, Tailwind, Radix, Shadcn, responsive, dark mode |
| 5 | `message-generation` | Messages | P1 | AI message, OpenRouter, Ollama, draft, generate, ghostwrite, LLM |
| 6 | `railway-deployment` | Deploy | P1 | deploy, Railway, production, NIXPACKS, env var, migrate deploy |
| 7 | `imessage-integration` | iMessage | P1 | iMessage, chat.db, two-repo, osascript, local scripts, AppleScript |
| 8 | `dev-workflow` | Workflow | P2 | HANDOFF, commit, setup, onboarding, local dev, clone |

## Dependency Graph

```
crm-backend (P0)
├── contact-management (P0)
│   ├── message-generation (P1)
│   └── imessage-integration (P1)
├── sync-agent (P0)
│   └── imessage-integration (P1)
└── (api routes covered internally)

crm-frontend (P1)         — independent
railway-deployment (P1)    — independent
dev-workflow (P2)           — independent
```

## Directory Structure

```
.skills/
├── SKILLS_INDEX.md              ← this file
├── crm-backend/
│   ├── SKILL.md
│   ├── evals/evals.json
│   └── references/
│       ├── schema.md
│       └── api-endpoints.md
├── contact-management/
│   ├── SKILL.md
│   └── evals/evals.json
├── sync-agent/
│   ├── SKILL.md
│   └── evals/evals.json
├── crm-frontend/
│   ├── SKILL.md
│   └── evals/evals.json
├── message-generation/
│   ├── SKILL.md
│   ├── evals/evals.json
│   └── references/
│       └── ai-providers.md
├── railway-deployment/
│   ├── SKILL.md
│   └── evals/evals.json
├── imessage-integration/
│   ├── SKILL.md
│   └── evals/evals.json
└── dev-workflow/
    ├── SKILL.md
    └── evals/evals.json
```

## Maintenance Notes

- **Adding a skill**: Create folder under `.skills/`, add SKILL.md with frontmatter, update this index
- **Descriptions should be "pushy"**: Err on the side of triggering too often
- **Keep SKILL.md under 500 lines**: Use `references/` for detailed content
- **Category colors**: Defined in BOTH `src/lib/utils.ts` and `tailwind.config.ts` — update both
- **Two repos**: The CRM (this repo) and `~/imessage-keepintouch/` are separate — see `imessage-integration` skill
