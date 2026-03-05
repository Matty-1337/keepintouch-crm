---
name: sync-agent
description: >
  Use this skill for ANY work involving the sync agent, LaunchAgent configuration,
  push/pull synchronization between the local Mac and the Railway CRM, the local
  SQLite database at ~/.keepintouch/contacts.db, the crm_sync_agent.py script,
  plist configuration, sync logs, sync debugging, or the 30-minute sync cycle.
  Also trigger for: install.sh, launchctl, sync state, crm_sync_state.json,
  Apple Contacts integration via osascript, or any discussion of the local-to-cloud
  data pipeline.
---

# Sync Agent Skill

You are working on the Keep-In-Touch CRM sync agent — a Python script that runs
every 30 minutes via macOS LaunchAgent to synchronize contacts between the local
Mac and the Railway-hosted CRM.

## Architecture

```
Local Mac                          Railway CRM
─────────────────                  ─────────────────
~/.keepintouch/contacts.db         PostgreSQL
  ├── contacts                     ├── Contact
  ├── contact_topics               ├── SecondaryPhone
  └── contact_context              ├── Message
                                   ├── SyncLog
crm_sync_agent.py ──── HTTPS ────► /api/contacts/sync (POST)
  (push then pull)                 /api/contacts (GET)
                                   /api/sync/log (POST)
                                   /api/health (GET)
```

## Files

| File | Location | Purpose |
|------|----------|---------|
| `crm_sync_agent.py` | `sync-agent/` | Main sync script (Python 3) |
| `com.deltakinetics.keepintouch.crmsync.plist` | `sync-agent/` | LaunchAgent config |
| `install.sh` | `sync-agent/` | Installation script |
| `crm_sync_state.json` | `~/.keepintouch/` | Last push/pull timestamps |
| `contacts.db` | `~/.keepintouch/` | Local SQLite database |
| `crm_sync_stdout.log` | `~/.keepintouch/` | Stdout log |
| `crm_sync_stderr.log` | `~/.keepintouch/` | Stderr log |

## Sync Workflow

### 1. Health Check
```python
GET {CRM_URL}/api/health
# If CRM is offline → log warning, exit gracefully
```

### 2. Push (Local → CRM)
```python
# Read all local contacts from SQLite
contacts = get_local_contacts()  # SELECT * FROM contacts

# Enrich with topics and context
for c in contacts:
    c['topics'] = get_local_topics(c['id'])    # SELECT topic FROM contact_topics
    c['context'] = get_local_context(c['id'])  # SELECT context FROM contact_context LIMIT 1

# POST to CRM
POST {CRM_URL}/api/contacts/sync
Body: {"contacts": [...]}
Response: {"created": N, "updated": N, "errors": [...]}
```

### 3. Pull (CRM → Local)
```python
# GET contacts updated since last pull
GET {CRM_URL}/api/contacts?since={last_pull_timestamp}

# Update local SQLite for each contact with a localSqliteId
for contact in pulled_contacts:
    if contact.localSqliteId:
        update_local_contact(contact.localSqliteId, contact)
```

### 4. Log Sync Event
```python
POST {CRM_URL}/api/sync/log
Body: {"direction": "push"/"pull", "source": "mac-sync-agent", "status": "success", ...}
```

## Local SQLite Schema

The sync agent assumes these tables exist in `~/.keepintouch/contacts.db`:

```sql
-- Main contacts table
CREATE TABLE contacts (
    id INTEGER PRIMARY KEY,
    name TEXT,
    phone TEXT,
    relationship TEXT,
    notes TEXT,
    frequency_days INTEGER,
    last_contact TEXT,  -- ISO date string
    created TEXT        -- ISO date string
);

-- Topics (many-to-one with contacts)
CREATE TABLE contact_topics (
    contact_id INTEGER,
    topic TEXT,
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

-- Context (most recent wins)
CREATE TABLE contact_context (
    contact_id INTEGER,
    context TEXT,
    created TEXT,  -- ISO date string, ORDER BY DESC LIMIT 1
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
);
```

**Important**: These tables are NOT managed by Prisma. They are created and maintained
by the scripts in `~/imessage-keepintouch/`. The sync agent only reads from them (push)
and writes back pulled changes (pull).

## LaunchAgent Configuration

Plist: `sync-agent/com.deltakinetics.keepintouch.crmsync.plist`

| Setting | Value |
|---------|-------|
| Label | `com.deltakinetics.keepintouch.crmsync` |
| Program | `/usr/bin/python3` |
| Script | `/Users/apple2/keepintouch-crm/sync-agent/crm_sync_agent.py` |
| Interval | 1800 seconds (30 minutes) |
| RunAtLoad | false |
| Stdout log | `~/.keepintouch/crm_sync_stdout.log` |
| Stderr log | `~/.keepintouch/crm_sync_stderr.log` |

### Environment Variables in Plist
```xml
<key>EnvironmentVariables</key>
<dict>
    <key>CRM_URL</key>
    <string>https://your-app.railway.app</string>  <!-- MUST UPDATE -->
    <key>CRM_API_KEY</key>
    <string>kit-dev-key-change-me</string>          <!-- MUST UPDATE -->
</dict>
```

## Installation

```bash
# Run the install script
cd sync-agent && bash install.sh

# Then manually edit the plist with real values:
nano ~/Library/LaunchAgents/com.deltakinetics.keepintouch.crmsync.plist
# Update CRM_URL and CRM_API_KEY

# Load the agent
launchctl load ~/Library/LaunchAgents/com.deltakinetics.keepintouch.crmsync.plist

# Unload (stop)
launchctl unload ~/Library/LaunchAgents/com.deltakinetics.keepintouch.crmsync.plist

# Check if running
launchctl list | grep keepintouch

# Manual test run
CRM_URL="https://your-app.railway.app" CRM_API_KEY="your-key" python3 sync-agent/crm_sync_agent.py
```

## Debugging Sync Issues

### Check logs
```bash
tail -50 ~/.keepintouch/crm_sync_stdout.log
tail -50 ~/.keepintouch/crm_sync_stderr.log
```

### Check sync state
```bash
cat ~/.keepintouch/crm_sync_state.json
# Shows: {"last_push": "ISO timestamp", "last_pull": "ISO timestamp"}
```

### Check CRM sync log
Visit the Sync page in the CRM UI, or:
```bash
curl -H "X-API-Key: YOUR_KEY" https://your-app.railway.app/api/sync/log
```

### Common Issues
1. **Placeholder credentials**: CRM_URL and CRM_API_KEY in plist are defaults — must be updated
2. **CRM offline**: Agent exits gracefully, retries next 30-min cycle
3. **No conflict resolution**: Push-then-pull means CRM data wins on pull
4. **Apple Contacts timeout**: osascript integration is non-critical, failures are logged but don't block sync
5. **SQLite locked**: If another process is writing to contacts.db, read may fail

## API Authentication
The sync agent authenticates via `X-API-Key` header:
```python
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': CRM_API_KEY
}
```
The CRM validates this in `src/lib/auth.ts` against the `API_KEY` environment variable.

## Dependencies
- **crm-backend**: Uses the `/api/contacts/sync`, `/api/contacts`, `/api/sync/log`, and `/api/health` endpoints
