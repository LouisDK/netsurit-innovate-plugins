# QuestionPad Server — Design Document

**Date:** 2026-03-02
**Status:** Approved

## Overview

QuestionPad Server is a containerized Node.js/Express application that decouples the existing QuestionPad plugin from Playwright. It exposes an MCP server for AI agents and a web UI for humans, enabling agents to create interactive question sessions, share URLs with users, poll for answers, and dynamically update forms — all without sharing a machine.

**Key scenario:** An AI agent facilitating a meeting creates separate session links for each participant. Each participant answers independently. The agent polls all sessions, reasons over partial answers, and can adapt questions in real time.

## Architecture

```
┌─────────────────────────────────────────────────┐
│            Azure Container App                   │
│                                                  │
│  ┌──────────────┐    ┌───────────────────────┐  │
│  │  MCP Server   │    │   Web Server          │  │
│  │  POST /mcp    │    │   GET /session/:guid  │  │
│  │               │    │   (serves app.html)   │  │
│  │  Tools:       │    │                       │  │
│  │  - create     │    │   /api/sessions/:guid │  │
│  │  - get_status │    │   (browser REST calls)│  │
│  │  - get_all    │    │                       │  │
│  │  - update     │    │                       │  │
│  │  - close      │    │                       │  │
│  └──────┬───────┘    └───────────┬───────────┘  │
│         │                        │               │
│         └────────┐  ┌────────────┘               │
│                  ▼  ▼                            │
│          ┌──────────────┐                        │
│          │ Session Store │                        │
│          │ (in-memory)   │                        │
│          │               │                        │
│          │ agents: Map<agentId, Set<guid>>        │
│          │ sessions: Map<guid, Session>           │
│          └──────────────┘                        │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Target user | Internal first, clean API for external later | Start with Netsurit agents, design for openness |
| Agent connection | MCP server (streamable HTTP) | Fits naturally into Claude Code MCP ecosystem |
| Frontend | Reuse existing app.html | All 8 card types already built and tested |
| Data lifecycle | Ephemeral (in-memory, TTL) | Simple, secure, no database needed |
| Real-time | Polling-based | Agent polls periodically, browser POSTs per card. Simple, no SSE/WebSocket complexity |
| Agent isolation | agentId token | Lightweight bearer token generated on first create_session |
| Backend stack | Node.js + Express + TypeScript | Fast startup, natural MCP SDK fit |

## MCP Tools

### create_session

Creates a new question session.

**Input:**
```json
{
  "agentId": "a-7f3b...",   // optional on first call, required after
  "title": "API Design Review",
  "cards": [
    {
      "id": "approach",
      "type": "approve-reject",
      "title": "Overall approach",
      "body": "Markdown content here",
      "required": true
    }
  ]
}
```

**Output:**
```json
{
  "guid": "s-9a2c...",
  "url": "https://your-app.azurecontainerapps.io/session/s-9a2c...",
  "agentId": "a-7f3b..."
}
```

If `agentId` is omitted, one is generated and returned. The agent must pass it on all subsequent calls.

### get_session_status

Polls the current state of a single session.

**Input:** `{ agentId, guid }`

**Output:**
```json
{
  "status": "in_progress",
  "title": "API Design Review",
  "cards": [...],
  "answers": [
    { "cardId": "approach", "value": "approved", "comment": "Looks good" }
  ],
  "submittedAt": null
}
```

### get_all_sessions

Polls all sessions belonging to this agent.

**Input:** `{ agentId }`

**Output:**
```json
{
  "sessions": [
    { "guid": "s-9a2c...", "title": "Alice's Review", "status": "submitted", "answers": [...] },
    { "guid": "s-3f1d...", "title": "Bob's Review", "status": "in_progress", "answers": [...] }
  ]
}
```

### update_session

Replaces the card set on a live session. Cards with matching IDs retain existing answers. New cards appear unanswered. Removed cards and their answers disappear.

**Input:** `{ agentId, guid, cards[] }`

**Output:** `{ success: true }`

### close_session

Ends a session and returns final answers. The browser shows "session ended" on next poll.

**Input:** `{ agentId, guid }`

**Output:**
```json
{
  "finalAnswers": [
    { "cardId": "approach", "value": "approved", "comment": "Looks good" }
  ],
  "globalComment": "Overall feedback...",
  "submittedAt": "2026-03-02T14:30:00.000Z"
}
```

## Agent Isolation

- `agentId` is required on all calls except the first `create_session`
- An agent can only read/modify sessions it created — mismatched `agentId` returns an error
- `get_all_sessions` returns only sessions belonging to that `agentId`
- No way to enumerate other agents' sessions or GUIDs

## Card Types

Reused from the existing QuestionPad plugin (all 8 types):

1. **multiple-choice** — Radio buttons (pick one)
2. **multi-select** — Checkboxes (pick many)
3. **yes-no** — Toggle switch (boolean)
4. **approve-reject** — Approve/Reject buttons (go/no-go)
5. **free-text** — Textarea (open-ended)
6. **rating** — Star buttons (numeric 1-N)
7. **slider** — Range slider (single value 0-100)
8. **range-slider** — Dual-thumb slider (min-max range)

## Session Lifecycle

```
created → in_progress → submitted → closed
                ↘          ↘         ↘
                 expired    expired   (cleaned up)
```

- **created** — Cards set, no answers yet
- **in_progress** — At least one answer received
- **submitted** — User hit Save, all required cards answered
- **closed** — Agent called close_session
- **expired** — Rolling TTL hit (default 1 hour), data purged

Every interaction (answer posted, agent polls, agent updates) resets the TTL.

## Browser Behavior

The existing app.html is adapted:

- **Data loading:** `GET /api/sessions/:guid` on page load (GUID from URL path)
- **Answer submission:** `POST /api/sessions/:guid/answers` per card as user completes it
- **Final submit:** `POST /api/sessions/:guid/submit` marks session as submitted
- **Form change polling:** Browser polls `GET /api/sessions/:guid` every few seconds. If cards changed (agent called update_session), the form updates — new cards appear, removed cards disappear, existing answers are preserved. A toast notifies the user.
- **Session ended:** If poll returns `expired` or `closed`, form becomes read-only with a message.

## Routes

| Route | Caller | Purpose |
|---|---|---|
| `POST /mcp` | AI Agent (MCP client) | All MCP tool calls |
| `GET /session/:guid` | User browser | Serves app.html |
| `GET /api/sessions/:guid` | Browser JS | Fetch cards & current answers |
| `POST /api/sessions/:guid/answers` | Browser JS | Submit a single card answer |
| `POST /api/sessions/:guid/submit` | Browser JS | Mark session as submitted |

## Deployment

- **Container:** Single Docker container, single replica
- **Platform:** Azure Container Apps
- **Ingress:** External, port 3000
- **Dependencies:** None (no database, Redis, or storage mounts)
- **Environment variables:**
  - `PORT` — Server port (default 3000)
  - `TTL_MINUTES` — Session TTL (default 60)
  - `BASE_URL` — Public URL for generating session links

## Project Structure

```
questionpad-server/
├── Dockerfile
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts          # Express app, routes, session store
│   ├── mcp.ts             # MCP tool definitions & handlers
│   └── types.ts           # Shared types (Session, Card, Answer)
├── public/
│   └── app.html           # Adapted from existing plugin
```

## Container Restart Behavior

Sessions are in-memory, so a restart loses all active sessions. This is acceptable for v1 — sessions are short-lived by nature. The browser shows "Session not found" and the agent gets an error on the next poll. If persistence becomes needed later, the session store can be swapped for Redis without changing the API surface.
