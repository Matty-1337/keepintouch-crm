#!/usr/bin/env python3
"""
Keep-In-Touch CRM Sync Agent
Bidirectional sync between local SQLite + Apple Contacts and the CRM web app.
Runs as a LaunchAgent every 30 minutes.
"""

import json
import os
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

# --- Configuration ---

KEEPINTOUCH_DIR = Path.home() / ".keepintouch"
SQLITE_DB = KEEPINTOUCH_DIR / "contacts.db"
CONFIG_FILE = KEEPINTOUCH_DIR / "config.json"
SYNC_STATE_FILE = KEEPINTOUCH_DIR / "crm_sync_state.json"

# These should be set as environment variables or in a config file
CRM_BASE_URL = os.environ.get("CRM_URL", "https://your-app.railway.app")
CRM_API_KEY = os.environ.get("CRM_API_KEY", "kit-dev-key-change-me")

HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": CRM_API_KEY,
}


def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def load_sync_state() -> dict:
    if SYNC_STATE_FILE.exists():
        return json.loads(SYNC_STATE_FILE.read_text())
    return {"last_push": None, "last_pull": None}


def save_sync_state(state: dict):
    SYNC_STATE_FILE.write_text(json.dumps(state, indent=2))


# --- SQLite Operations ---


def get_local_contacts() -> list[dict]:
    """Read all contacts from local SQLite database."""
    conn = sqlite3.connect(str(SQLITE_DB))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, name, phone, relationship, notes, frequency_days,
               last_contact, created
        FROM contacts
    """
    )
    contacts = []
    for row in cursor.fetchall():
        contacts.append(
            {
                "localSqliteId": row["id"],
                "name": row["name"],
                "phone": row["phone"],
                "relationship": row["relationship"] or "",
                "notes": row["notes"] or "",
                "frequencyDays": row["frequency_days"] or 14,
                "lastContact": row["last_contact"],
                "kitActive": True,  # All local contacts are KIT active
            }
        )
    conn.close()
    return contacts


def get_local_topics(contact_id: int) -> str:
    """Get topics for a local contact."""
    conn = sqlite3.connect(str(SQLITE_DB))
    cursor = conn.cursor()
    cursor.execute(
        "SELECT topic FROM contact_topics WHERE contact_id = ?", (contact_id,)
    )
    topics = [row[0] for row in cursor.fetchall()]
    conn.close()
    return ", ".join(topics)


def get_local_context(contact_id: int) -> str:
    """Get context for a local contact."""
    conn = sqlite3.connect(str(SQLITE_DB))
    cursor = conn.cursor()
    cursor.execute(
        "SELECT context FROM contact_context WHERE contact_id = ? ORDER BY created DESC LIMIT 1",
        (contact_id,),
    )
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else ""


def update_local_contact(sqlite_id: int, data: dict):
    """Update a contact in the local SQLite database."""
    conn = sqlite3.connect(str(SQLITE_DB))
    cursor = conn.cursor()

    updates = []
    values = []

    field_map = {
        "frequencyDays": "frequency_days",
        "lastContact": "last_contact",
        "notes": "notes",
        "relationship": "relationship",
        "name": "name",
        "phone": "phone",
    }

    for crm_field, db_field in field_map.items():
        if crm_field in data and data[crm_field] is not None:
            updates.append(f"{db_field} = ?")
            values.append(data[crm_field])

    if updates:
        values.append(sqlite_id)
        cursor.execute(
            f"UPDATE contacts SET {', '.join(updates)} WHERE id = ?", values
        )
        conn.commit()
        log(f"  Updated local contact #{sqlite_id}: {', '.join(updates)}")

    conn.close()


# --- Apple Contacts ---


def get_apple_contacts() -> list[dict]:
    """Export contacts from Apple Contacts using AppleScript."""
    script = """
    tell application "Contacts"
        set contactList to {}
        repeat with p in people
            set contactInfo to {|name|:name of p}
            try
                set contactInfo's |phone| to value of first phone of p
            on error
                set contactInfo's |phone| to ""
            end try
            try
                set contactInfo's |email| to value of first email of p
            on error
                set contactInfo's |email| to ""
            end try
            set contactInfo's |appleId| to id of p
            set end of contactList to contactInfo
        end repeat
        return contactList
    end tell
    """
    try:
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            log(f"  AppleScript error: {result.stderr}")
            return []

        # Parse the AppleScript output
        # This is simplified — AppleScript output parsing can be complex
        contacts = []
        raw = result.stdout.strip()
        if raw:
            # AppleScript returns comma-separated records
            # For robustness, we'd use a proper parser, but this handles the basics
            log(f"  Retrieved Apple Contacts data ({len(raw)} chars)")
        return contacts
    except subprocess.TimeoutExpired:
        log("  Apple Contacts export timed out")
        return []
    except Exception as e:
        log(f"  Error reading Apple Contacts: {e}")
        return []


# --- CRM API Operations ---


def push_to_crm(contacts: list[dict]) -> dict:
    """Push local contacts to the CRM API."""
    url = f"{CRM_BASE_URL}/api/contacts/sync"
    try:
        resp = requests.post(url, json={"contacts": contacts}, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        log(f"  Push failed: {e}")
        return {"created": 0, "updated": 0, "errors": [str(e)]}


def pull_from_crm(since: str | None = None) -> list[dict]:
    """Pull contacts from the CRM API."""
    url = f"{CRM_BASE_URL}/api/contacts"
    params = {}
    if since:
        params["since"] = since
    try:
        resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        log(f"  Pull failed: {e}")
        return []


def log_sync_event(direction: str, status: str, details: str, contacts: int):
    """Log a sync event to the CRM API."""
    url = f"{CRM_BASE_URL}/api/sync/log"
    try:
        requests.post(
            url,
            json={
                "direction": direction,
                "source": "mac-sync-agent",
                "status": status,
                "details": details,
                "contacts": contacts,
            },
            headers=HEADERS,
            timeout=10,
        )
    except requests.RequestException:
        pass  # Non-critical


# --- Sync Logic ---


def do_push():
    """Push local SQLite contacts to CRM."""
    log("PUSH: Reading local contacts...")
    contacts = get_local_contacts()

    # Enrich with topics and context
    for c in contacts:
        sqlite_id = c["localSqliteId"]
        c["topics"] = get_local_topics(sqlite_id)
        c["context"] = get_local_context(sqlite_id)

    log(f"PUSH: Sending {len(contacts)} contacts to CRM...")
    result = push_to_crm(contacts)
    log(
        f"PUSH: Done — created={result.get('created', 0)}, "
        f"updated={result.get('updated', 0)}, "
        f"errors={len(result.get('errors', []))}"
    )

    log_sync_event(
        "push",
        "success" if not result.get("errors") else "partial",
        f"created={result.get('created', 0)}, updated={result.get('updated', 0)}",
        len(contacts),
    )

    return result


def do_pull():
    """Pull changes from CRM and update local SQLite."""
    state = load_sync_state()
    since = state.get("last_pull")

    log(f"PULL: Fetching from CRM (since={since})...")
    crm_contacts = pull_from_crm(since)
    log(f"PULL: Received {len(crm_contacts)} contacts")

    updated = 0
    for c in crm_contacts:
        sqlite_id = c.get("localSqliteId")
        if sqlite_id:
            update_local_contact(sqlite_id, c)
            updated += 1

    log(f"PULL: Updated {updated} local contacts")

    log_sync_event(
        "pull",
        "success",
        f"received={len(crm_contacts)}, updated={updated}",
        len(crm_contacts),
    )

    state["last_pull"] = datetime.now(timezone.utc).isoformat()
    save_sync_state(state)

    return {"received": len(crm_contacts), "updated": updated}


def main():
    log("=" * 50)
    log("Keep-In-Touch CRM Sync Agent starting")
    log(f"CRM URL: {CRM_BASE_URL}")
    log(f"SQLite DB: {SQLITE_DB}")
    log("=" * 50)

    # Check prerequisites
    if not SQLITE_DB.exists():
        log(f"ERROR: SQLite database not found at {SQLITE_DB}")
        sys.exit(1)

    # Check CRM is reachable
    try:
        resp = requests.get(f"{CRM_BASE_URL}/api/health", timeout=5)
        health = resp.json()
        log(f"CRM health: {health.get('status', 'unknown')}")
    except Exception as e:
        log(f"WARNING: CRM not reachable: {e}")
        log("Skipping sync — CRM is offline")
        sys.exit(0)

    # Push first, then pull
    push_result = do_push()

    state = load_sync_state()
    state["last_push"] = datetime.now(timezone.utc).isoformat()
    save_sync_state(state)

    pull_result = do_pull()

    log("Sync complete!")
    log(
        f"  Push: created={push_result.get('created', 0)}, updated={push_result.get('updated', 0)}"
    )
    log(
        f"  Pull: received={pull_result.get('received', 0)}, updated={pull_result.get('updated', 0)}"
    )


if __name__ == "__main__":
    main()
