# API Endpoints Reference

All endpoints require `X-API-Key` header or same-origin request unless noted.

---

## GET /api/health
No auth required. Returns server status.
```json
// Response 200
{ "status": "ok", "timestamp": "2026-03-04T12:00:00.000Z", "version": "1.0.0" }
```

---

## GET /api/contacts
List contacts with optional filters.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `since` | ISO date string | Only contacts updated after this time |
| `search` | string | Case-insensitive name search |
| `category` | string | Filter by category |
| `kitActive` | `"true"` / `"false"` | Filter by KIT status |
| `archived` | `"true"` / `"false"` | Filter by archive status (default: false) |

```json
// Response 200 — array of contacts with secondaryPhones
[
  {
    "id": "clx...",
    "name": "John Smith",
    "phone": "+15551234567",
    "email": "john@example.com",
    "relationship": "friend",
    "category": "Baseball",
    "frequencyDays": 14,
    "lastContact": "2026-02-15T00:00:00.000Z",
    "nextDue": "2026-03-01T00:00:00.000Z",
    "kitActive": true,
    "archived": false,
    "secondaryPhones": [{ "id": "...", "phone": "+15559876543", "label": "work" }]
  }
]
```

---

## POST /api/contacts
Create a new contact.

```json
// Request body
{
  "name": "Jane Doe",           // required
  "phone": "+15551234567",      // required
  "email": "jane@example.com",  // optional
  "relationship": "professional",
  "category": "Professional",
  "notes": "Met at conference",
  "frequencyDays": 30,
  "lastContact": "2026-03-01",
  "kitActive": true,
  "appleContactId": "ABC123",
  "localSqliteId": "42",
  "topics": "AI, startups",
  "context": "Co-founder of...",
  "secondaryPhones": [{ "phone": "+15559876543", "label": "work" }]
}

// Response 201
{ "id": "clx...", "name": "Jane Doe", ... }
```

---

## GET /api/contacts/[id]
Fetch single contact with secondaryPhones and last 20 messages.

```json
// Response 200
{
  "id": "clx...",
  "name": "John Smith",
  "secondaryPhones": [...],
  "messages": [
    { "id": "...", "message": "Hey, how's the season going?", "status": "sent", "sentAt": "..." }
  ]
}
```

---

## PUT /api/contacts/[id]
Update a contact. Auto-recalculates nextDue if lastContact or frequencyDays changes.

```json
// Request body (all fields optional)
{
  "name": "John Smith Jr.",
  "frequencyDays": 7,
  "lastContact": "2026-03-04",
  "kitActive": false,
  "archived": true
}

// Response 200
{ "id": "clx...", "name": "John Smith Jr.", ... }
```

---

## DELETE /api/contacts/[id]
Soft-delete (archives) a contact. Sets `archived: true`.

```json
// Response 200
{ "message": "Contact archived" }
```

---

## POST /api/contacts/sync
Bulk upsert contacts from sync agent. Matches by `localSqliteId` or `phone`.

```json
// Request body
{
  "contacts": [
    {
      "name": "John Smith",
      "phone": "+15551234567",
      "localSqliteId": "42",
      "relationship": "friend",
      "frequencyDays": 14,
      "lastContact": "2026-03-01",
      "kitActive": true,
      "topics": "baseball, coaching",
      "context": "Head coach at State U"
    }
  ]
}

// Response 200
{ "created": 2, "updated": 5, "errors": [] }

// Response with errors
{ "created": 1, "updated": 4, "errors": [{ "index": 3, "message": "Invalid phone" }] }
```

---

## GET /api/contacts/frequencies
List active contacts ordered by nextDue (earliest first).

```json
// Response 200
[
  { "id": "...", "name": "John Smith", "frequencyDays": 14, "lastContact": "...", "nextDue": "...", "notes": "..." }
]
```

---

## GET /api/messages
List messages, optionally filtered by contact.

**Query params:** `contactId` (optional)

```json
// Response 200
[
  {
    "id": "...",
    "contactId": "clx...",
    "message": "Hey, thinking of you!",
    "status": "sent",
    "sentAt": "2026-03-01T15:30:00.000Z",
    "createdAt": "2026-03-01T15:30:00.000Z",
    "contact": { "name": "John Smith" }
  }
]
```

---

## POST /api/messages
Create a message. If `status === "sent"`, auto-updates contact's lastContact and recalculates nextDue.

```json
// Request body
{
  "contactId": "clx...",   // required — must reference existing contact
  "message": "Hey!",       // required
  "status": "sent"         // optional, default "draft"
}

// Response 201
{ "id": "...", "contactId": "clx...", "message": "Hey!", "status": "sent", ... }
```

---

## GET /api/sync/log
List last 50 sync log entries.

```json
// Response 200
[
  {
    "id": "...",
    "direction": "push",
    "source": "mac-sync-agent",
    "status": "success",
    "details": "Pushed 42 contacts",
    "contacts": 42,
    "createdAt": "2026-03-04T12:00:00.000Z"
  }
]
```

---

## POST /api/sync/log
Record a sync event.

```json
// Request body
{
  "direction": "push",           // required: "push" or "pull"
  "source": "mac-sync-agent",    // required
  "status": "success",           // required: "success", "partial", "failed"
  "details": "Pushed 42 contacts",
  "contacts": 42
}

// Response 201
{ "id": "...", ... }
```
