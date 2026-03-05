---
name: railway-deployment
description: >
  Use this skill for ANY deployment, infrastructure, or production operations work
  on the Keep-In-Touch CRM: Railway deployment, environment variable configuration,
  NIXPACKS build issues, production database management, migrate deploy, monitoring,
  scaling, build failures, or production debugging. Trigger on: deploy, Railway,
  production, environment variable, build, NIXPACKS, railway.json, migrate deploy,
  production database, Railway logs, scaling, domain, SSL, production error.
---

# Railway Deployment Skill

You are working on the deployment infrastructure for the Keep-In-Touch CRM,
which runs on Railway with PostgreSQL.

## Production Stack

| Component | Service |
|-----------|---------|
| Web app | Next.js 14 (standalone output) |
| Database | Railway PostgreSQL |
| Builder | NIXPACKS |
| Domain | Railway-provided (*.up.railway.app) |

## Configuration

### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npx prisma migrate deploy && npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Key points:
- `prisma migrate deploy` runs on every deploy — safe for production (only applies pending migrations)
- `npm start` runs `next start` (from package.json scripts)
- Restarts on failure up to 10 times
- NIXPACKS auto-detects Node.js and installs dependencies

### next.config.js
```javascript
const nextConfig = { output: 'standalone' }
```
Standalone output reduces deployment size by excluding unnecessary files.

### Build Process
```
npm install
  → postinstall: prisma generate (creates Prisma Client)
  → prisma generate && next build (build script)
```

## Environment Variables

### Required on Railway

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?schema=public` | PostgreSQL connection (auto-set by Railway PostgreSQL plugin) |
| `API_KEY` | `kit-prod-secret-key-here` | API authentication for sync agent and external calls |
| `NEXT_PUBLIC_APP_URL` | `https://keepintouch-crm-production.up.railway.app` | Base URL for same-origin auth validation |

### Local Development

| Variable | Value | File |
|----------|-------|------|
| `DATABASE_URL` | `file:./dev.db` | `.env.local` |
| `API_KEY` | `kit-dev-key-change-me` | `.env.local` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `.env.local` |

## Deployment Checklist

### First Deploy
1. Create Railway project
2. Add PostgreSQL plugin (auto-sets DATABASE_URL)
3. Set `API_KEY` environment variable (generate a strong key)
4. Set `NEXT_PUBLIC_APP_URL` to the Railway-provided domain
5. Connect GitHub repo for auto-deploys
6. Deploy — NIXPACKS handles the rest
7. Verify: `curl https://your-app.railway.app/api/health`
8. Seed database: Run `npx prisma db seed` via Railway CLI or console

### Subsequent Deploys
1. Push to GitHub main branch
2. Railway auto-deploys
3. `prisma migrate deploy` runs any new migrations
4. `next start` serves the app

### Adding a Migration
1. Make schema changes in `prisma/schema.prisma`
2. Run locally: `npx prisma migrate dev --name description`
3. Commit the migration files in `prisma/migrations/`
4. Push to GitHub → Railway deploys → `prisma migrate deploy` applies it

## Common Operations

### Check Production Health
```bash
curl https://your-app.railway.app/api/health
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

### View Railway Logs
```bash
railway logs
# Or use Railway dashboard
```

### Run Commands in Production
```bash
railway run npx prisma studio  # Open Prisma Studio against prod DB
railway run npx prisma db seed # Seed production database
```

### Database Backup
```bash
# Via Railway CLI
railway connect postgres
# Then use pg_dump
```

## Troubleshooting

### Build Fails
1. Check `prisma generate` runs before `next build` (ensured by build script)
2. Verify all env vars are set on Railway
3. Check for TypeScript errors: `npx tsc --noEmit`

### Migration Fails on Deploy
1. Check migration SQL is valid for PostgreSQL (not SQLite-specific)
2. Ensure migration files are committed
3. Check Railway logs for specific error

### App Crashes on Start
1. Check `DATABASE_URL` is set and valid
2. Check Railway PostgreSQL service is running
3. Check restart count (max 10 retries)
4. Check logs for unhandled errors

### Sync Agent Can't Reach CRM
1. Verify `CRM_URL` in LaunchAgent plist matches Railway URL
2. Verify `CRM_API_KEY` matches Railway's `API_KEY` env var
3. Test: `curl -H "X-API-Key: YOUR_KEY" https://your-app.railway.app/api/health`

## Security Notes
- `API_KEY` should be a strong, unique secret in production
- `NEXT_PUBLIC_APP_URL` is used for same-origin validation — must match actual domain
- Database credentials are managed by Railway (auto-injected via plugin)
- No secrets should be committed to the repo (`.env.local` is gitignored)
