# QuestionPad Shared Sessions — Design Document

**Date:** 2026-03-03
**Status:** Approved
**Builds on:** [Multi-User Sessions Design (2026-03-03)](./2026-03-03-questionpad-multi-user-design.md)

## Overview

Allow multiple people to fill in the same form behind a single URL. Each person enters their name on arrival, fills in the cards independently, and the AI agent sees all individual responses grouped by session.

**Key scenario:** An agent facilitating a meeting creates 2 sessions — one labeled "Sales" with sales-oriented questions, one labeled "Technical" with technical questions. The facilitator shares the Sales URL with 5 sales people and the Technical URL with 2 engineers. Each person opens their URL, enters their name, and fills in the form. The agent polls `get_sessions` and sees all 7 individual responses, grouped by label.

The `label` field is flexible — it could represent a role ("Sales"), a person ("Alice"), a team ("Group A"), or anything the facilitator decides. The context of the conversation dictates how it's used.

## Data Model

### New: Respondent

Each session holds an array of respondents. A respondent is created when a human joins a session by entering their name.

```typescript
interface Respondent {
  respondentId: string;      // auto-generated GUID
  name: string;              // entered by the human
  answers: Answer[];
  globalComment?: string;
  status: 'in_progress' | 'submitted';
  joinedAt: string;          // ISO timestamp
  submittedAt?: string;      // ISO timestamp
}
```

### Session Changes

The `Session` interface changes:
- **Remove:** `answers`, `globalComment`, `submittedAt` — these move into `Respondent`
- **Add:** `respondents: Respondent[]`
- **Simplify status:** `'created' | 'in_progress' | 'closed' | 'expired'` — the `'submitted'` status is removed from Session (it's now per-respondent)

```typescript
interface Session {
  guid: string;
  agentId: string;
  label: string;
  title: string;
  description?: string;
  cards: Card[];
  respondents: Respondent[];   // was: answers: Answer[]
  status: 'created' | 'in_progress' | 'closed' | 'expired';
  createdAt: number;
  lastActivityAt: number;
  cardVersion: number;
}
```

## Browser Flow

### Name Prompt

When someone opens `/session/:guid`, the app shows a name prompt before the form:

1. A screen showing the session title, description (if any), and a text input: "Enter your name to join" + a "Join" button
2. On submit, the browser calls `POST /api/sessions/:guid/join` with `{ name: "Alice" }`
3. The server creates a `Respondent` entry and returns `{ respondentId: "r-abc123" }`
4. The browser stores `respondentId` in `localStorage` and renders the form
5. All subsequent answer submissions include the `respondentId`

### Resubmit

If someone enters a name that already exists on the session, the server returns the existing `respondentId` and their previous answers. The browser restores their form state — they can update answers and resubmit.

### Refresh Persistence

The browser stores respondent identity in localStorage:
- **Key:** `questionpad-respondent-{guid}`
- **Value:** `{ respondentId: "r-abc123", name: "Alice" }`

On page load:
1. Check localStorage for a respondent entry for this GUID
2. If found, validate via API (respondent may be gone if session closed/expired)
3. If valid, skip the name prompt, restore form with their answers
4. If invalid, clear localStorage, show name prompt

The existing `questionpad-hub-sessions` key (list of GUIDs for the hub) stays unchanged.

### Hub Integration

Works naturally. Each tab is still one session GUID. The user enters their name once per tab. If someone adds two GUIDs (Sales + Technical), they enter their name for each independently.

## Browser API Changes

| Route | Change |
|---|---|
| `POST /api/sessions/:guid/join` | **New.** Body: `{ name }`. Returns `{ respondentId, answers }`. Creates respondent or returns existing one if name matches. |
| `POST /api/sessions/:guid/answers` | Body now requires `respondentId` alongside `cardId`, `value`, `comment`. |
| `POST /api/sessions/:guid/submit` | Body now requires `respondentId` alongside optional `globalComment`. |
| `GET /api/sessions/:guid` | Unchanged — returns cards, title, description, status, cardVersion. Does not return respondent data (that comes from the join endpoint). |

## MCP Tool Changes

### create_session — No change

The agent creates participants with labels and cards exactly as today. The `label` field description is updated to clarify it can represent a group.

### get_sessions — Response shape change

Instead of flat `answers` and `globalComment` on the session, these move into `respondents[]`:

```json
{
  "guid": "s-9a2c",
  "label": "Sales Team",
  "title": "Sprint Review",
  "status": "in_progress",
  "cards": [...],
  "respondents": [
    {
      "name": "Alice",
      "status": "submitted",
      "answers": [{ "cardId": "q1", "value": { "rating": 4 }, "comment": "Good" }],
      "globalComment": "Great sprint",
      "submittedAt": "2026-03-03T14:30:00Z"
    },
    {
      "name": "Bob",
      "status": "in_progress",
      "answers": [{ "cardId": "q1", "value": { "rating": 3 } }]
    }
  ]
}
```

### update_session — No change

Updates cards for the session, affecting all respondents.

### close_sessions — Response shape change

Returns `respondents[]` per session instead of flat `finalAnswers`:

```json
[
  {
    "guid": "s-9a2c",
    "label": "Sales Team",
    "respondents": [
      { "name": "Alice", "answers": [...], "globalComment": "..." },
      { "name": "Bob", "answers": [...], "globalComment": "..." }
    ]
  }
]
```

## What We're NOT Building

- **No roster/dropdown** — free text name entry only
- **No authentication** — names are trust-based
- **No real-time participant list** — participants don't see each other
- **No participant limit** — any number of people can join
- **No per-respondent card customization** — everyone on the same session gets the same cards (use separate labels for different card sets)
