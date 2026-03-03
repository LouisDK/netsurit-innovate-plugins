# QuestionPad Server

An MCP server that lets AI agents collect structured feedback from humans via interactive web forms. Agents create sessions with question cards (ratings, yes/no, multiple choice, free text, etc.), share URLs with participants, and poll for answers — all through standard MCP tool calls over HTTP.

Multiple people can open the same session URL, enter their name, and fill in the form independently. The agent sees all individual responses grouped by session.

## Hosted Instance

A public instance is available — no setup required. Just point your AI agent's MCP configuration to:

```
https://questionpad.ashybush-f47448bd.eastus2.azurecontainerapps.io/mcp
```

This works with any MCP client that supports Streamable HTTP transport (Claude Desktop, Claude Code, Cursor, etc.). Add it as a custom MCP server / connector in your agent's settings.

> **Note:** This instance runs on Azure Container Apps and scales to zero when idle. The first request after a period of inactivity takes about 1 minute to wake up. Subsequent requests are fast.

## Quick Start (Local)

```bash
npm install
npm run dev        # starts on http://localhost:3000
```

The server exposes two things:

- **MCP endpoint** at `POST /mcp` — for AI agents to create sessions and fetch answers
- **Web UI** at `/session/:guid` — for humans to fill in their forms

## Connecting an AI Agent

QuestionPad uses **Streamable HTTP transport** (not stdio). Any MCP client that supports HTTP-based servers can connect.

### Claude Desktop / Claude Code

Add to your MCP config (`claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "questionpad": {
      "type": "streamable-http",
      "url": "https://questionpad.ashybush-f47448bd.eastus2.azurecontainerapps.io/mcp"
    }
  }
}
```

For a local instance, replace the URL with `http://localhost:3000/mcp`.

### Generic MCP Client (TypeScript)

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client({ name: 'my-agent', version: '1.0.0' });
await client.connect(
  new StreamableHTTPClientTransport(new URL('http://localhost:3000/mcp'))
);

// List available tools
const { tools } = await client.listTools();

// Create sessions — one URL per label, multiple people can open the same URL
const result = await client.callTool({
  name: 'create_session',
  arguments: {
    title: 'Sprint Retrospective',
    description: 'Please rate the sprint and share your thoughts.',
    participants: [
      {
        label: 'Sales Team',
        cards: [
          { id: 'q1', type: 'rating', title: 'How was the sprint?', min: 1, max: 5 },
          { id: 'q2', type: 'free-text', title: 'What could we improve?' },
        ],
      },
      {
        label: 'Engineering',
        cards: [
          { id: 'q1', type: 'yes-no', title: 'Should we keep daily standups?' },
        ],
      },
    ],
  },
});
// Returns: { agentId: "...", sessions: [{ label, guid, url }, ...] }

// Poll for answers — each session has respondents[]
const sessions = await client.callTool({
  name: 'get_sessions',
  arguments: { agentId: '...' },
});
// Each session contains:
// { guid, label, status, cards, respondents: [
//     { name: "Alice", status: "submitted", answers: [...], globalComment: "..." },
//     { name: "Bob", status: "in_progress", answers: [...] }
// ]}
```

### Any HTTP Client

The MCP endpoint is a standard JSON-RPC 2.0 endpoint. You can call it with `curl` or any HTTP library:

```bash
curl http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_session",
      "arguments": {
        "title": "Quick Poll",
        "participants": [{
          "label": "Team",
          "cards": [{ "id": "q1", "type": "yes-no", "title": "Ship today?" }]
        }]
      }
    }
  }'
```

## Workflow

```
Agent                          Server                         Humans
  │                              │                              │
  ├─ create_session ────────────►│                              │
  │◄─ { agentId, urls[] } ──────┤                              │
  │                              │                              │
  │  (share URLs with humans)    │                              │
  │                              │◄──── opens /session/:guid ───┤
  │                              │◄──── enters name ("Alice") ──┤
  │                              │◄──── fills in & submits ─────┤
  │                              │                              │
  │                              │◄──── opens same URL ─────────┤ (another person)
  │                              │◄──── enters name ("Bob") ────┤
  │                              │◄──── fills in & submits ─────┤
  │                              │                              │
  ├─ get_sessions ──────────────►│                              │
  │◄─ { respondents[] } ────────┤                              │
  │                              │                              │
  ├─ close_sessions ────────────►│                              │
  │◄─ { respondents[] } ────────┤         (forms locked)       │
```

1. **create_session** — create question cards for one or more participant groups (labels). Each label gets a unique URL that multiple people can open.
2. **get_sessions** — poll for answers. Each session contains `respondents[]` — check each respondent's `status` field (`"submitted"` means they're done).
3. **update_session** — optionally replace cards mid-session (e.g. follow-up questions). Affects all respondents.
4. **close_sessions** — lock sessions and retrieve all respondents' final answers.

The `agentId` returned by `create_session` is your ownership token. Save it and pass it to all subsequent calls. It isolates your sessions from other agents on the same server.

## Tools

### create_session

Create a feedback session with one or more participant groups.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | No | Omit on first call (auto-generated). Reuse across calls. |
| `title` | string | Yes | Form title shown to participants. |
| `description` | string | No | Context shown above the cards. Supports markdown (tables, lists, bold, etc.). |
| `participants` | array | Yes | One or more `{ label, cards }` objects. The `label` is flexible — a role, a team name, a person, or any grouping. Multiple people can open the same session URL. |

### get_sessions

Poll for respondent answers.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | Yes | Your agent identifier. |
| `guids` | string[] | No | Filter to specific sessions. Omit for all. |

**Session status:** `created` → `in_progress` → `closed` / `expired`

- `created` — no one has joined yet
- `in_progress` — at least one person has joined
- `closed` — agent closed the session
- `expired` — session timed out due to inactivity (see `TTL_MINUTES` config)

**Respondent status:** `in_progress` → `submitted`

Each respondent within a session has their own status. Check `respondent.status === "submitted"` to know when someone has finished.

### update_session

Replace question cards on an open session.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | Yes | Your agent identifier. |
| `guid` | string | Yes | Session to update. |
| `cards` | array | Yes | New card set (replaces all existing cards). Affects all respondents. |

### close_sessions

Close sessions and retrieve all respondents' final answers.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | Yes | Your agent identifier. |
| `guids` | string[] | No | Sessions to close. Omit to close all. |

Returns an array of sessions, each with `respondents[]` containing each person's `name`, `answers`, `globalComment`, and `submittedAt`.

## Card Types

| Type | Required Fields | Answer Shape |
|---|---|---|
| `rating` | `min`, `max` | `{ rating: 4 }` |
| `slider` | `min`, `max`, optional `step` | `{ value: 7.5 }` |
| `range-slider` | `min`, `max`, optional `step` | `{ value: [3, 8] }` |
| `yes-no` | — | `{ value: true }` |
| `approve-reject` | — | `{ status: "approved" }` |
| `multiple-choice` | `options` | `{ choice: "Option A" }` |
| `multi-select` | `options` | `{ choices: ["A", "B"] }` |
| `free-text` | optional `placeholder` | `{ text: "..." }` |

All card types accept optional `body` (description below title, supports markdown) and `required` (must answer before submitting).

Each answer also carries an optional `comment` field — the respondent can add a note to any card.

## Session Hub

Participants can view multiple sessions in one browser page by visiting `/hub` and pasting session GUIDs or URLs. Sessions appear as tabs with notification dots when cards update in background tabs.

Each person enters their name when they first open a session. Their identity is stored in the browser so they can refresh the page or return later without re-entering their name. If someone enters the same name again, they get their previous answers back and can update them.

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `BASE_URL` | `http://localhost:$PORT` | Public URL included in session URLs returned to agents |
| `TTL_MINUTES` | `60` | Session expiry time (minutes of inactivity) |

## Deployment

### Docker

```bash
docker build -t questionpad .
docker run -p 3000:3000 -e BASE_URL=https://questionpad.example.com questionpad
```

### Node.js

```bash
npm install
npm run build
BASE_URL=https://questionpad.example.com npm start
```

Set `BASE_URL` to your public URL so that session URLs returned to agents point to the right place.

### Azure Container Apps

Prerequisites: [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) and [Docker](https://docs.docker.com/get-docker/) installed, logged in with `az login`.

```bash
# First time: deploy infrastructure (ACR, Container Apps Environment, Container App)
./infra/deploy.sh infra

# Build Docker image and push to ACR
./infra/deploy.sh build

# Deploy new image to Container App
./infra/deploy.sh deploy

# Or run all steps at once
./infra/deploy.sh all

# Check status
./infra/deploy.sh status
```

Override defaults with environment variables:

| Variable | Default | Description |
|---|---|---|
| `RESOURCE_GROUP` | `rg_inx_workshops_tools` | Azure resource group |
| `LOCATION` | `eastus2` | Azure region |
| `BASE_NAME` | `questionpad` | Base name for all resources |

## Development

```bash
npm run dev          # start with hot reload (tsx watch)
npx vitest run       # run tests
npx vitest           # run tests in watch mode
```
