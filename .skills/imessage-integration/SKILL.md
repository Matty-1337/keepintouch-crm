---
name: imessage-integration
description: >
  Use this skill for ANY work involving iMessage integration, the two-repo architecture,
  reading chat.db, the local Mac environment, AppleScript/osascript message sending,
  the ~/imessage-keepintouch/ scripts, contact discovery from unknown numbers, the
  boundary between Railway cloud and local Mac operations, or understanding what
  must run locally vs in the cloud. Trigger on: iMessage, chat.db, imessage-keepintouch,
  local scripts, AppleScript, osascript, Mac scripts, two-repo, local sending,
  message sending, chat database, unknown numbers, contact discovery, local
  environment, Mac setup, two repositories.
---

# iMessage Integration Skill

You are working on the iMessage integration layer of the Keep-In-Touch system.
This is a critical architectural boundary — understanding what runs WHERE is essential.

## Two-Repo Architecture

The Keep-In-Touch system spans two repositories with a clear boundary:

### Repository 1: keepintouch-crm (This Repo)
- **Location**: `~/keepintouch-crm/` (Mac), deployed to Railway
- **Purpose**: Web CRM — contact management, dashboard, queue, message tracking
- **Runs on**: Railway (web app + PostgreSQL) + Mac (sync agent only)
- **Cannot**: Read iMessages, send iMessages, access Apple Contacts directly

### Repository 2: imessage-keepintouch
- **Location**: `~/imessage-keepintouch/` (Mac only)
- **Purpose**: iMessage reading, contact discovery, AI message generation, local sending
- **Runs on**: Mac only (requires chat.db access, osascript)
- **Cannot**: Run on Railway, run in the cloud, run on any non-Mac system

### The Boundary

```
┌──────────────────────────────────────────────────────────┐
│ CLOUD (Railway)                                          │
│                                                          │
│  keepintouch-crm                                         │
│  ├── Next.js web app                                     │
│  ├── PostgreSQL database                                 │
│  ├── REST API for contacts/messages/sync                 │
│  └── Dashboard, queue, settings UI                       │
│                                                          │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTPS (sync agent, every 30 min)
┌──────────────────────────┴───────────────────────────────┐
│ LOCAL MAC                                                │
│                                                          │
│  sync-agent/ (in keepintouch-crm repo)                   │
│  ├── crm_sync_agent.py — pushes/pulls contacts           │
│  └── LaunchAgent plist — 30-min cycle                    │
│                                                          │
│  ~/imessage-keepintouch/ (separate repo)                 │
│  ├── keepintouch_unified.py — main orchestrator          │
│  ├── llm_router.py — OpenRouter + Ollama AI routing      │
│  ├── ollama_messages.py — message generation             │
│  ├── identify_unknowns.py — contact discovery            │
│  ├── contact_audit.py — contact quality checking         │
│  ├── enrich_contacts.py — web enrichment pipeline        │
│  ├── strategic_contact_add.py — smart contact adding     │
│  └── imessage_mcp_server.py — MCP server for Claude      │
│                                                          │
│  ~/Library/Messages/chat.db — iMessage database (RO)     │
│  ~/.keepintouch/contacts.db — local contact database     │
│  ~/.keepintouch/config.json — local configuration        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Why This Split Exists

**iMessage chat.db** is a SQLite database at `~/Library/Messages/chat.db` on macOS.
It requires:
1. **Full Disk Access** permission for the reading process
2. **Physical access** to the Mac (can't be read remotely)
3. **Read-only** — never write to chat.db

**iMessage sending** uses AppleScript (`osascript`):
```applescript
tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+15551234567" of targetService
    send "Hey!" to targetBuddy
end tell
```
This requires the Messages app to be running on the Mac.

**These cannot run on Railway.** That's why the system is split.

## chat.db Schema (Key Tables)

The iMessage database has three main tables used by the system:

```sql
-- Messages
SELECT
    m.ROWID, m.text, m.date, m.is_from_me,
    m.handle_id, m.cache_roomnames
FROM message m

-- Handles (phone numbers / email addresses)
SELECT h.ROWID, h.id AS phone_or_email
FROM handle h

-- Chat-handle junction (group chats)
SELECT chj.chat_id, chj.handle_id
FROM chat_handle_join chj

-- Chat-message junction
SELECT cmj.chat_id, cmj.message_id
FROM chat_message_join cmj
```

**Date format**: iMessage dates are in Apple's epoch (seconds since 2001-01-01),
stored as nanoseconds. Convert with:
```python
from datetime import datetime, timedelta
APPLE_EPOCH = datetime(2001, 1, 1)
msg_date = APPLE_EPOCH + timedelta(seconds=raw_date / 1e9)
```

## Contact Discovery Pipeline

The `identify_unknowns.py` script identifies contacts from unknown phone numbers:

1. **Extract unknown numbers** from chat.db (numbers not in Apple Contacts)
2. **Analyze message patterns** — frequency, recency, message count, conversation depth
3. **Score confidence** — high-confidence matches identified from ~1,860 unknowns → 236 identified
4. **Generate add scripts** — shell scripts to add identified contacts to Apple Contacts
5. **Output report** — `unknown_numbers_report.txt` with all findings

Scoring criteria:
- Message count and frequency
- Two-way conversation (not just one-directional)
- Recency of last message
- Context clues in message content

## Local Environment

| Detail | Value |
|--------|-------|
| Machine | 2017 MacBook Pro 13" Intel, 16GB RAM |
| OS | macOS Ventura 13.6.7 |
| User | `apple2` |
| chat.db | `~/Library/Messages/chat.db` (read-only) |
| Contacts DB | `~/.keepintouch/contacts.db` |
| Config | `~/.keepintouch/config.json` |
| Sync logs | `~/.keepintouch/crm_sync_*.log` |
| Sync state | `~/.keepintouch/crm_sync_state.json` |
| Python | System Python 3 |
| LaunchAgent | `~/Library/LaunchAgents/com.deltakinetics.keepintouch.crmsync.plist` |

## Key Scripts in ~/imessage-keepintouch/

| Script | Purpose |
|--------|---------|
| `keepintouch_unified.py` | Main orchestrator — runs enrichment, generation, recommendations |
| `llm_router.py` | AI routing: OpenRouter → Ollama fallback, usage logging |
| `ollama_messages.py` | Message generation module |
| `identify_unknowns.py` | Contact discovery from chat.db unknown numbers |
| `identify_unknowns_v2.py` | Improved version with better confidence scoring |
| `contact_audit.py` | Audit contact quality and completeness |
| `enrich_contacts.py` | Web search enrichment for contacts |
| `strategic_contact_add.py` | Smart batch contact adding |
| `imessage_mcp_server.py` | MCP server exposing iMessage to Claude |
| `contact_watchdog.py` | Monitor for contact database changes |
| `daily_run.sh` | Daily automation script |
| `sync_to_nas.sh` | Backup to NAS |

## Common Tasks

### Reading Recent Messages for a Contact
This must be done from `~/imessage-keepintouch/`, not from the CRM:
```python
import sqlite3
conn = sqlite3.connect(os.path.expanduser("~/Library/Messages/chat.db"))
cursor = conn.execute("""
    SELECT m.text, m.date, m.is_from_me
    FROM message m
    JOIN handle h ON m.handle_id = h.ROWID
    WHERE h.id = ?
    ORDER BY m.date DESC LIMIT 20
""", (phone_number,))
```

### Sending an iMessage
Must run on the Mac with Messages app open:
```bash
osascript -e 'tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "+15551234567" of targetService
    send "Hey, how are you?" to targetBuddy
end tell'
```

### The Full Flow
1. CRM generates a draft message (via AI, stored in Message table)
2. Sync agent pulls the draft to local Mac
3. Local script sends via osascript
4. Local script marks as sent (updates local DB)
5. Sync agent pushes updated status back to CRM

**Note**: Steps 2-4 are not yet implemented. Currently, message sending is manual
through the imessage-keepintouch scripts, independent of the CRM.

## Dependencies
- **sync-agent**: The bridge between local Mac and Railway CRM
- **contact-management**: Contact data model and scheduling
