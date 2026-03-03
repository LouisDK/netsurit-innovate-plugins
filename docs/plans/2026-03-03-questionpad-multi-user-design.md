# QuestionPad Multi-User Sessions — Design Document

**Date:** 2026-03-03
**Status:** Approved
**Builds on:** [QuestionPad Server Design (2026-03-02)](./2026-03-02-questionpad-server-design.md)

## Overview

Extend the QuestionPad server to support multi-user scenarios where a single AI agent creates sessions for multiple participants in one tool call, and fetches all their answers in one tool call. Additionally, redesign the browser UI as a "session hub" where a human can participate in multiple sessions (potentially from different agents) in a single browser page with tabs.

**Key scenarios:**
1. An AI agent facilitating a meeting creates personalized question sets for 5 participants in one call, gets 5 URLs back, polls all answers in one call.
2. Two different agents each run their own workshops on the same server instance — fully isolated via `agentId`.
3. A single human participates in sessions from multiple agents simultaneously, viewing them as tabs in one browser page.

## Revised MCP Tool Surface

Replace the 5 existing tools with 4 batch-oriented tools. A single participant is a `participants` array of length 1.

### create_session

Create a session with one or more participants, each getting their own cards.

**Input:**
```json
{
  "agentId": "a-7f3b",
  "title": "Design Review",
  "participants": [
    { "label": "Alice", "cards": [{ "id": "q1", "type": "rating", "title": "...", "min": 1, "max": 5 }] },
    { "label": "Bob",   "cards": [{ "id": "q1", "type": "yes-no", "title": "..." }] }
  ]
}
```

**Output:**
```json
{
  "agentId": "a-7f3b",
  "sessions": [
    { "label": "Alice", "guid": "s-9a2c", "url": "https://app.example.com/session/s-9a2c" },
    { "label": "Bob",   "guid": "s-3f1d", "url": "https://app.example.com/session/s-3f1d" }
  ]
}
```

If `agentId` is omitted, one is generated and returned. Each participant gets a separate GUID and URL.

### get_sessions

Poll answers for all sessions or a filtered subset. Omit `guids` to get all.

**Input:**
```json
{ "agentId": "a-7f3b", "guids": ["s-9a2c"] }
```

**Output:**
```json
[
  {
    "guid": "s-9a2c",
    "label": "Alice",
    "title": "Design Review",
    "status": "submitted",
    "cards": [...],
    "answers": [{ "cardId": "q1", "value": { "rating": 4 }, "comment": "Good" }],
    "globalComment": "Overall looks great",
    "submittedAt": "2026-03-03T14:30:00.000Z"
  }
]
```

### update_session

Update cards on a specific session. Stays single-session since different participants have different cards.

**Input:**
```json
{ "agentId": "a-7f3b", "guid": "s-9a2c", "cards": [...] }
```

**Output:**
```json
{ "success": true }
```

### close_sessions

Close sessions and get final answers. Omit `guids` to close all.

**Input:**
```json
{ "agentId": "a-7f3b", "guids": ["s-9a2c", "s-3f1d"] }
```

**Output:**
```json
[
  { "guid": "s-9a2c", "label": "Alice", "finalAnswers": [...], "globalComment": "...", "submittedAt": "..." },
  { "guid": "s-3f1d", "label": "Bob",   "finalAnswers": [...], "globalComment": "...", "submittedAt": "..." }
]
```

## Data Model Changes

The `Session` interface gains one field:

```typescript
export interface Session {
  guid: string;
  agentId: string;
  label: string;        // NEW — participant identifier ("Alice", "Bob")
  title: string;
  cards: Card[];
  answers: Answer[];
  status: SessionStatus;
  globalComment?: string;
  createdAt: number;
  lastActivityAt: number;
  submittedAt?: string;
  cardVersion: number;
}
```

### Store changes

- `createSession` accepts `label` in its input
- `getAllSessions` accepts an optional `guids` filter array
- `closeSession` (singular) replaced by `closeSessions(agentId, guids?)` — closes multiple sessions, returns results for each
- `getSession` (singular by agentId+guid) removed — replaced by `getSessions` with optional guid filter

## Browser API Changes

The `GET /api/sessions/:guid` response now includes `label`:

```json
{
  "label": "Alice",
  "title": "Design Review",
  "cards": [...],
  "answers": [...],
  "status": "in_progress",
  "cardVersion": 3
}
```

## Session Hub (Browser UI)

### Architecture

The browser app becomes a "hub" — a tabbed interface where each tab is one session. All sessions render in the same page; switching tabs swaps the visible form.

### Entry Points

| URL | Behavior |
|---|---|
| `/hub` | Empty hub. User pastes a GUID to start. |
| `/session/:guid` | Hub with that session pre-loaded as the first tab. |

Both serve the same `app.html`. The JS detects the URL pattern and bootstraps accordingly.

### Adding Sessions

An input field in the header bar lets the user paste a GUID or full URL (e.g. `https://app.example.com/session/s-9a2c`). The hub:
1. Extracts the GUID
2. Validates it via `GET /api/sessions/:guid`
3. On success: adds a new tab, starts polling
4. On failure: shows toast ("Session not found")
5. Duplicate GUIDs are rejected with a toast

### Tab Bar

Horizontal tabs above the form content. Each tab shows:
- Session title + participant label (e.g. "Design Review — Alice")
- Status indicator (pulsing dot for updates, checkmark for submitted)

Only one tab is active at a time. The form below shows the active session's cards.

### Notifications

Each session polls independently (every 5 seconds, as today). When a **non-active** tab's `cardVersion` changes:
- A pulsing red/gold dot appears on that tab
- The tab background briefly glows gold (CSS animation)
- The dot clears when the user clicks the tab

### localStorage Persistence

The list of GUIDs is saved to `localStorage` under a key like `questionpad-hub-sessions`. On page load:
1. Restore all saved GUIDs
2. Validate each via API call
3. Remove any that return 404 (expired/closed)
4. Render tabs for surviving sessions

### Polling Strategy

- All tabs poll independently on their 5-second interval
- Only the active tab renders form updates immediately
- Background tabs accumulate `cardVersion` changes and show the notification dot
- When the user switches to a background tab, any pending updates are applied

### Keyboard Navigation

- Within a form: Tab key navigates cards (unchanged)
- Between session tabs: Ctrl+1/2/3/... shortcuts
- Adding a session: Ctrl+N or clicking the input field

## Agent Isolation (Unchanged)

Two agents sharing the same server instance are fully isolated via `agentId`. Agent A cannot see or modify Agent B's sessions. The hub doesn't break this — a human might have tabs from different agents, but each tab's API calls only use the public GUID (no `agentId` needed for browser-facing routes).

## Migration / Breaking Changes

This is a clean break from the v1 tool surface:

| Old Tool | New Tool | Change |
|---|---|---|
| `create_session(title, cards)` | `create_session(title, participants[])` | Cards moved into participants array |
| `get_session_status(agentId, guid)` | `get_sessions(agentId, guids?)` | Merged with get_all_sessions, optional filter |
| `get_all_sessions(agentId)` | `get_sessions(agentId)` | Same behavior when guids omitted |
| `update_session(agentId, guid, cards)` | `update_session(agentId, guid, cards)` | Unchanged |
| `close_session(agentId, guid)` | `close_sessions(agentId, guids?)` | Batch, optional filter |

## Routes (Updated)

| Route | Caller | Purpose |
|---|---|---|
| `POST /mcp` | AI Agent (MCP client) | All MCP tool calls |
| `GET /hub` | User browser | Serves app.html (empty hub) |
| `GET /session/:guid` | User browser | Serves app.html (hub with pre-loaded session) |
| `GET /api/sessions/:guid` | Browser JS | Fetch cards, answers, label for one session |
| `POST /api/sessions/:guid/answers` | Browser JS | Submit a single card answer |
| `POST /api/sessions/:guid/submit` | Browser JS | Mark session as submitted |
