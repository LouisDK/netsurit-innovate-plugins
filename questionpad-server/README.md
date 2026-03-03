# QuestionPad Server

An MCP server that lets AI agents collect structured feedback from humans via interactive web forms. Agents create sessions with question cards (ratings, yes/no, multiple choice, free text, etc.), share URLs with participants, and poll for answers — all through standard MCP tool calls over HTTP.

## Quick Start

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
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

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

// Create a session
const result = await client.callTool({
  name: 'create_session',
  arguments: {
    title: 'Sprint Retrospective',
    participants: [
      {
        label: 'Alice',
        cards: [
          { id: 'q1', type: 'rating', title: 'How was the sprint?', min: 1, max: 5 },
          { id: 'q2', type: 'free-text', title: 'What could we improve?' },
        ],
      },
      {
        label: 'Bob',
        cards: [
          { id: 'q1', type: 'yes-no', title: 'Should we keep daily standups?' },
        ],
      },
    ],
  },
});
// Returns: { agentId: "...", sessions: [{ label, guid, url }, ...] }
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
Agent                          Server                         Human
  │                              │                              │
  ├─ create_session ────────────►│                              │
  │◄─ { agentId, urls[] } ──────┤                              │
  │                              │                              │
  │  (share URLs with humans)    │                              │
  │                              │◄──── opens /session/:guid ───┤
  │                              │◄──── submits answers ────────┤
  │                              │                              │
  ├─ get_sessions ──────────────►│                              │
  │◄─ { status, answers[] } ────┤                              │
  │                              │                              │
  ├─ close_sessions ────────────►│                              │
  │◄─ { finalAnswers[] } ───────┤         (form locked)        │
```

1. **create_session** — create question cards for one or more participants. Each gets a unique URL.
2. **get_sessions** — poll for answers. Check `status` field: `"submitted"` means the participant is done.
3. **update_session** — optionally replace cards mid-session (e.g. follow-up questions).
4. **close_sessions** — lock sessions and retrieve final answers.

The `agentId` returned by `create_session` is your ownership token. Save it and pass it to all subsequent calls. It isolates your sessions from other agents on the same server.

## Tools

### create_session

Create a feedback session with one or more participants.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | No | Omit on first call (auto-generated). Reuse across calls. |
| `title` | string | Yes | Form title shown to participants. |
| `participants` | array | Yes | One or more `{ label, cards }` objects. |

### get_sessions

Poll for participant answers.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | Yes | Your agent identifier. |
| `guids` | string[] | No | Filter to specific sessions. Omit for all. |

**Status lifecycle:** `created` → `in_progress` → `submitted` → `closed`

### update_session

Replace question cards on a session that hasn't been submitted yet.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | Yes | Your agent identifier. |
| `guid` | string | Yes | Session to update. |
| `cards` | array | Yes | New card set (replaces all existing cards). |

### close_sessions

Close sessions and retrieve final answers.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `agentId` | string | Yes | Your agent identifier. |
| `guids` | string[] | No | Sessions to close. Omit to close all. |

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

All card types accept optional `body` (description below title) and `required` (must answer before submitting).

Each answer also carries an optional `comment` field — the participant can add a note to any card.

## Session Hub

Participants can view multiple sessions in one browser page by visiting `/hub` and pasting session GUIDs or URLs. Sessions appear as tabs with notification dots when cards update in background tabs.

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

## Development

```bash
npm run dev          # start with hot reload (tsx watch)
npx vitest run       # run tests
npx vitest           # run tests in watch mode
```
