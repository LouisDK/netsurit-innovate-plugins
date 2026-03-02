# QuestionPad

A Claude Code plugin that collects structured user feedback through an interactive browser-based UI with typed feedback cards.

## Overview

QuestionPad provides a pre-built, self-contained HTML application that renders typed feedback cards — approve/reject decisions, multiple-choice questions, ratings, sliders, free-text inputs, and more. Agents compose a JSON request describing the cards to display, open the app via Playwright MCP, inject the data, and read back the structured responses.

No HTML generation is required. The agent only produces and consumes JSON.

## Use Cases

- **Plan/proposal review** — approve or reject phases of an implementation plan
- **Code review sign-off** — present diffs with approve/reject and quality ratings
- **Multi-question surveys** — collect multiple structured answers in a single form
- **Configuration decisions** — choose deployment targets, toggle features, set thresholds
- **Design review** — rate aspects of a design and provide targeted feedback

## Architecture

```
Orchestrating Agent
  │
  ├─ Creates request JSON (card definitions)
  │
  └─ Spawns feedback-collector agent
       │
       ├─ Serves app.html via local HTTP server (port 18923)
       ├─ Opens browser via Playwright MCP
       ├─ Injects request data into the app
       ├─ Polls localStorage for submission
       ├─ Reads structured response JSON
       └─ Returns formatted markdown summary
```

**Data flow:** Agent writes request JSON → App renders interactive cards → User answers and submits → App stores response in localStorage → Agent reads response → Agent returns summary.

## Card Types

Eight card types are supported:

| Type | Purpose | User Interaction | Answer Shape |
|------|---------|-----------------|--------------|
| `multiple-choice` | Pick one from a list | Radio buttons | `{ choice: string }` |
| `multi-select` | Pick several from a list | Checkboxes | `{ choices: string[] }` |
| `yes-no` | Boolean toggle | Toggle switch | `{ value: boolean }` |
| `approve-reject` | Go/no-go decision | Approve/Reject buttons | `{ status: "approved" \| "rejected" }` |
| `free-text` | Open-ended response | Textarea | `{ text: string }` |
| `rating` | Numeric rating | Numbered buttons | `{ rating: number }` |
| `slider` | Single value on a scale | Range slider | `{ value: number }` |
| `range-slider` | Numeric range (low–high) | Dual-thumb slider | `{ value: [number, number] }` |

### Type-Specific Configuration

**multiple-choice / multi-select:**
- `options: string[]` — array of choices

**yes-no:**
- `default: boolean` — initial toggle position (optional)

**free-text:**
- `placeholder: string` — textarea placeholder (optional)

**rating:**
- `min: number` (default: 1), `max: number` (default: 5)

**slider:**
- `min: number` (default: 0), `max: number` (default: 100), `step: number` (default: 1), `default: number`

**range-slider:**
- `min: number` (default: 0), `max: number` (default: 100), `step: number` (default: 1), `defaultMin: number`, `defaultMax: number`

## Request Format

```json
{
  "id": "review-api-design-001",
  "title": "API Design Review",
  "cards": [
    {
      "id": "approach",
      "type": "approve-reject",
      "title": "Overall approach",
      "body": "The service exposes a REST API with versioned endpoints.",
      "required": true
    },
    {
      "id": "clarity",
      "type": "rating",
      "title": "Documentation clarity",
      "min": 1,
      "max": 10,
      "required": true
    },
    {
      "id": "auth-method",
      "type": "multiple-choice",
      "title": "Preferred auth method",
      "options": ["API key", "OAuth 2.0", "JWT bearer"],
      "required": false
    },
    {
      "id": "notes",
      "type": "free-text",
      "title": "Additional notes",
      "placeholder": "Anything else to mention..."
    }
  ]
}
```

### Card Base Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique identifier within the request |
| `type` | string | yes | One of the eight type names |
| `title` | string | yes | Heading displayed on the card |
| `body` | string | no | Markdown content rendered above the control |
| `required` | boolean | no | If true, must answer before submitting (default: false) |

The `body` field supports a subset of Markdown: headings, bold, italic, inline code, fenced code blocks, ordered/unordered lists, and blockquotes.

## Response Format

After submission, the app stores a response object in localStorage:

```json
{
  "id": "review-api-design-001",
  "submittedAt": "2026-03-01T14:30:00.000Z",
  "answers": [
    {
      "cardId": "approach",
      "status": "approved",
      "comment": ""
    },
    {
      "cardId": "clarity",
      "rating": 8,
      "comment": "Could use more examples."
    },
    {
      "cardId": "auth-method",
      "choice": "OAuth 2.0",
      "comment": ""
    },
    {
      "cardId": "notes",
      "text": "Consider adding WebSocket support.",
      "comment": ""
    }
  ],
  "globalComment": "Looks good overall."
}
```

Each answer entry contains `cardId`, an optional `comment`, and the type-specific answer fields. Skipped optional cards appear with only `cardId` and `comment`.

## UI Features

- **Progress tracking** — visual progress bar with "X of Y answered" counter
- **Collapsible cards** — click headers to collapse; answer summaries shown when collapsed
- **Auto-collapse** — instant-answer types (multiple-choice, approve-reject, yes-no, rating) collapse automatically after answering
- **Per-card comments** — optional comment field on each card
- **Global comment** — footer textarea for overall feedback
- **Markdown rendering** — card bodies render headings, code blocks, lists, and more
- **Optional questions** — cards with `required: false` show a "Skip" link
- **Submission validation** — submit button disabled until all required cards are answered
- **Dark theme** — professional navy/blue color scheme, responsive layout

## Plugin Structure

```
plugins/questionpad/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata (name, version, description)
├── agents/
│   └── feedback-collector.md # Agent definition with 10-step workflow
├── assets/
│   └── app.html              # Pre-built interactive UI (~1400 lines, vanilla JS)
└── skills/
    └── questionpad/
        └── SKILL.md          # Data format reference for agents
```

## How It Works

The `feedback-collector` agent follows a 10-step workflow:

1. **Analyze input** — parse requirements and map to card types
2. **Create directory** — `mkdir -p .questionpad`
3. **Write request JSON** — `.questionpad/request-{timestamp}.json`
4. **Start HTTP server** — `python3 -m http.server 18923` (Playwright blocks `file://` URLs)
5. **Navigate to app** — `browser_navigate` to `http://localhost:18923/assets/app.html`
6. **Inject data** — `browser_evaluate` to set `window.REQUEST_DATA` and call `window.loadRequestData()`
7. **Poll for submission** — check `localStorage.getItem('questionpad-submitted')` every 5–10 seconds
8. **Read response** — parse `localStorage.getItem('questionpad-response')`
9. **Save response** — write `.questionpad/response-{timestamp}.json`
10. **Return summary** — close browser and return formatted markdown

### Fallback (No Playwright)

If Playwright MCP is unavailable, the agent falls back to a manual workflow:
1. Write the request JSON file as usual
2. Tell the user to open `app.html` in their browser
3. User injects data via console: `window.REQUEST_DATA = {...}; window.loadRequestData();`
4. User pastes the response JSON back after submitting

## Dependencies

**Runtime (agent-side):**
- Playwright MCP — browser automation
- Python 3 — local HTTP server (`python3 -m http.server`)
- File system tools — Read, Write, Bash

**App (browser-side):**
- None — pure vanilla JavaScript, no frameworks, no build step
- Requires a modern browser with ES6 and localStorage support

## Version

0.1.0

---

**Author:** Louis de Klerk from Netsurit
