# QuestionPad Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a containerized Node.js/Express server that exposes an MCP interface for AI agents to create interactive question sessions and a web UI for humans to answer them.

**Architecture:** Single Express app serving MCP tools via streamable HTTP (`POST /mcp`), a web UI (`GET /session/:guid`), and REST endpoints for browser-server communication. In-memory session store with TTL expiry. Agent isolation via `agentId` tokens.

**Tech Stack:** Node.js, Express, TypeScript, `@modelcontextprotocol/server`, `@modelcontextprotocol/express`, `@modelcontextprotocol/node`, Zod, Docker.

**Design doc:** `docs/plans/2026-03-02-questionpad-server-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `questionpad-server/package.json`
- Create: `questionpad-server/tsconfig.json`

**Step 1: Create project directory and package.json**

```bash
mkdir -p questionpad-server
```

```json
{
  "name": "questionpad-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^2.0.0",
    "@modelcontextprotocol/express": "^0.1.0",
    "@modelcontextprotocol/node": "^0.1.0",
    "express": "^5.1.0",
    "zod": "^3.25.0",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

**Step 3: Install dependencies**

Run: `cd questionpad-server && npm install`

**Step 4: Commit**

```bash
git add questionpad-server/package.json questionpad-server/tsconfig.json questionpad-server/package-lock.json
git commit -m "chore(questionpad-server): scaffold project with dependencies"
```

---

### Task 2: Types

**Files:**
- Create: `questionpad-server/src/types.ts`

**Step 1: Write types**

```typescript
export type CardType =
  | 'multiple-choice'
  | 'multi-select'
  | 'yes-no'
  | 'approve-reject'
  | 'free-text'
  | 'rating'
  | 'slider'
  | 'range-slider';

export type SessionStatus = 'created' | 'in_progress' | 'submitted' | 'closed' | 'expired';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  body?: string;
  required?: boolean;
  options?: string[];        // for multiple-choice, multi-select
  min?: number;              // for rating, slider, range-slider
  max?: number;              // for rating, slider, range-slider
  step?: number;             // for slider, range-slider
  placeholder?: string;      // for free-text
}

export interface Answer {
  cardId: string;
  value: unknown;            // type depends on card type
  comment?: string;
}

export interface Session {
  guid: string;
  agentId: string;
  title: string;
  cards: Card[];
  answers: Answer[];
  status: SessionStatus;
  globalComment?: string;
  createdAt: number;
  lastActivityAt: number;
  submittedAt?: string;
  /** Incremented each time cards are updated, so browser can detect changes */
  cardVersion: number;
}
```

**Step 2: Commit**

```bash
git add questionpad-server/src/types.ts
git commit -m "feat(questionpad-server): add type definitions"
```

---

### Task 3: Session Store

**Files:**
- Create: `questionpad-server/src/store.ts`
- Create: `questionpad-server/src/store.test.ts`

**Step 1: Write failing test**

```typescript
// store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from './store.js';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(60); // 60 min TTL
  });

  it('creates a session and returns guid + agentId', () => {
    const result = store.createSession({
      title: 'Test',
      cards: [{ id: 'q1', type: 'free-text', title: 'Name?' }],
    });
    expect(result.guid).toBeTruthy();
    expect(result.agentId).toBeTruthy();
  });

  it('reuses agentId when provided', () => {
    const first = store.createSession({ title: 'A', cards: [] });
    const second = store.createSession({ agentId: first.agentId, title: 'B', cards: [] });
    expect(second.agentId).toBe(first.agentId);
  });

  it('gets session status', () => {
    const { guid, agentId } = store.createSession({ title: 'Test', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] });
    const session = store.getSession(agentId, guid);
    expect(session?.status).toBe('created');
    expect(session?.answers).toEqual([]);
  });

  it('rejects access with wrong agentId', () => {
    const { guid } = store.createSession({ title: 'Test', cards: [] });
    expect(store.getSession('wrong-agent', guid)).toBeNull();
  });

  it('records an answer and transitions to in_progress', () => {
    const { guid, agentId } = store.createSession({ title: 'T', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] });
    store.submitAnswer(guid, { cardId: 'q1', value: 'hello' });
    const session = store.getSession(agentId, guid);
    expect(session?.status).toBe('in_progress');
    expect(session?.answers).toHaveLength(1);
    expect(session?.answers[0].value).toBe('hello');
  });

  it('updates an existing answer', () => {
    const { guid, agentId } = store.createSession({ title: 'T', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] });
    store.submitAnswer(guid, { cardId: 'q1', value: 'first' });
    store.submitAnswer(guid, { cardId: 'q1', value: 'second' });
    const session = store.getSession(agentId, guid);
    expect(session?.answers).toHaveLength(1);
    expect(session?.answers[0].value).toBe('second');
  });

  it('marks session as submitted', () => {
    const { guid, agentId } = store.createSession({ title: 'T', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] });
    store.submitAnswer(guid, { cardId: 'q1', value: 'hi' });
    store.submitSession(guid, 'Great form');
    const session = store.getSession(agentId, guid);
    expect(session?.status).toBe('submitted');
    expect(session?.submittedAt).toBeTruthy();
    expect(session?.globalComment).toBe('Great form');
  });

  it('updates cards and increments cardVersion', () => {
    const { guid, agentId } = store.createSession({ title: 'T', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] });
    store.updateCards(agentId, guid, [{ id: 'q2', type: 'yes-no', title: 'New Q' }]);
    const session = store.getSession(agentId, guid);
    expect(session?.cards).toHaveLength(1);
    expect(session?.cards[0].id).toBe('q2');
    expect(session?.cardVersion).toBe(1);
  });

  it('preserves answers for cards that still exist after update', () => {
    const { guid, agentId } = store.createSession({
      title: 'T',
      cards: [
        { id: 'q1', type: 'free-text', title: 'Q1' },
        { id: 'q2', type: 'yes-no', title: 'Q2' },
      ],
    });
    store.submitAnswer(guid, { cardId: 'q1', value: 'keep me' });
    store.submitAnswer(guid, { cardId: 'q2', value: true });
    store.updateCards(agentId, guid, [
      { id: 'q1', type: 'free-text', title: 'Q1 updated' },
      { id: 'q3', type: 'rating', title: 'New Q' },
    ]);
    const session = store.getSession(agentId, guid);
    expect(session?.answers).toHaveLength(1);
    expect(session?.answers[0].cardId).toBe('q1');
    expect(session?.answers[0].value).toBe('keep me');
  });

  it('closes a session and returns final data', () => {
    const { guid, agentId } = store.createSession({ title: 'T', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] });
    store.submitAnswer(guid, { cardId: 'q1', value: 'answer' });
    const result = store.closeSession(agentId, guid);
    expect(result?.finalAnswers).toHaveLength(1);
    const session = store.getSession(agentId, guid);
    expect(session?.status).toBe('closed');
  });

  it('gets all sessions for an agent', () => {
    const first = store.createSession({ title: 'A', cards: [] });
    store.createSession({ agentId: first.agentId, title: 'B', cards: [] });
    store.createSession({ title: 'C', cards: [] }); // different agent
    const sessions = store.getAllSessions(first.agentId);
    expect(sessions).toHaveLength(2);
  });

  it('expires sessions past TTL', () => {
    const shortStore = new SessionStore(0); // 0 min TTL = immediate expiry
    const { guid, agentId } = shortStore.createSession({ title: 'T', cards: [] });
    shortStore.purgeExpired();
    expect(shortStore.getSession(agentId, guid)).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd questionpad-server && npx vitest run src/store.test.ts`
Expected: FAIL (module not found)

**Step 3: Install vitest as dev dependency**

Run: `npm install -D vitest`

**Step 4: Write the store implementation**

```typescript
// store.ts
import { v4 as uuidv4 } from 'uuid';
import type { Card, Answer, Session, SessionStatus } from './types.js';

interface CreateSessionInput {
  agentId?: string;
  title: string;
  cards: Card[];
}

interface CloseSessionResult {
  finalAnswers: Answer[];
  globalComment?: string;
  submittedAt?: string;
}

export class SessionStore {
  private sessions = new Map<string, Session>();
  private agents = new Map<string, Set<string>>();
  private ttlMs: number;

  constructor(ttlMinutes: number) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  createSession(input: CreateSessionInput): { guid: string; agentId: string } {
    const guid = uuidv4();
    const agentId = input.agentId || uuidv4();

    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, new Set());
    }
    this.agents.get(agentId)!.add(guid);

    const now = Date.now();
    this.sessions.set(guid, {
      guid,
      agentId,
      title: input.title,
      cards: input.cards,
      answers: [],
      status: 'created',
      createdAt: now,
      lastActivityAt: now,
      cardVersion: 0,
    });

    return { guid, agentId };
  }

  getSession(agentId: string, guid: string): Session | null {
    const session = this.sessions.get(guid);
    if (!session || session.agentId !== agentId) return null;
    this.touch(guid);
    return session;
  }

  /** Browser-facing: no agentId check (browser knows the guid from the URL) */
  getSessionPublic(guid: string): Session | null {
    const session = this.sessions.get(guid);
    if (!session) return null;
    this.touch(guid);
    return session;
  }

  submitAnswer(guid: string, answer: Answer): boolean {
    const session = this.sessions.get(guid);
    if (!session || session.status === 'closed' || session.status === 'expired') return false;

    const existing = session.answers.findIndex(a => a.cardId === answer.cardId);
    if (existing >= 0) {
      session.answers[existing] = answer;
    } else {
      session.answers.push(answer);
    }

    if (session.status === 'created') {
      session.status = 'in_progress';
    }
    this.touch(guid);
    return true;
  }

  submitSession(guid: string, globalComment?: string): boolean {
    const session = this.sessions.get(guid);
    if (!session || session.status === 'closed' || session.status === 'expired') return false;

    session.status = 'submitted';
    session.submittedAt = new Date().toISOString();
    session.globalComment = globalComment;
    this.touch(guid);
    return true;
  }

  updateCards(agentId: string, guid: string, cards: Card[]): boolean {
    const session = this.sessions.get(guid);
    if (!session || session.agentId !== agentId) return false;
    if (session.status === 'closed' || session.status === 'expired') return false;

    const newCardIds = new Set(cards.map(c => c.id));
    session.answers = session.answers.filter(a => newCardIds.has(a.cardId));
    session.cards = cards;
    session.cardVersion++;
    this.touch(guid);
    return true;
  }

  closeSession(agentId: string, guid: string): CloseSessionResult | null {
    const session = this.sessions.get(guid);
    if (!session || session.agentId !== agentId) return null;

    session.status = 'closed';
    this.touch(guid);
    return {
      finalAnswers: session.answers,
      globalComment: session.globalComment,
      submittedAt: session.submittedAt,
    };
  }

  getAllSessions(agentId: string): Session[] {
    const guids = this.agents.get(agentId);
    if (!guids) return [];
    const result: Session[] = [];
    for (const guid of guids) {
      const session = this.sessions.get(guid);
      if (session) {
        this.touch(guid);
        result.push(session);
      }
    }
    return result;
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [guid, session] of this.sessions) {
      if (now - session.lastActivityAt > this.ttlMs) {
        this.sessions.delete(guid);
        const agentGuids = this.agents.get(session.agentId);
        if (agentGuids) {
          agentGuids.delete(guid);
          if (agentGuids.size === 0) this.agents.delete(session.agentId);
        }
      }
    }
  }

  private touch(guid: string): void {
    const session = this.sessions.get(guid);
    if (session) session.lastActivityAt = Date.now();
  }
}
```

**Step 5: Run tests to verify they pass**

Run: `cd questionpad-server && npx vitest run src/store.test.ts`
Expected: All 12 tests PASS

**Step 6: Commit**

```bash
git add questionpad-server/src/store.ts questionpad-server/src/store.test.ts
git commit -m "feat(questionpad-server): add in-memory session store with tests"
```

---

### Task 4: MCP Tool Definitions

**Files:**
- Create: `questionpad-server/src/mcp.ts`

**Step 1: Write the MCP server factory**

This registers all 5 MCP tools. The store is injected so the same instance is shared with Express routes.

```typescript
// mcp.ts
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import type { SessionStore } from './store.js';

const CardSchema = z.object({
  id: z.string(),
  type: z.enum([
    'multiple-choice', 'multi-select', 'yes-no', 'approve-reject',
    'free-text', 'rating', 'slider', 'range-slider',
  ]),
  title: z.string(),
  body: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  placeholder: z.string().optional(),
});

export function createMcpServer(store: SessionStore, baseUrl: string): McpServer {
  const server = new McpServer({
    name: 'questionpad',
    version: '0.1.0',
  });

  server.registerTool('create_session', {
    description: 'Create a new interactive question session. Returns a URL to share with the user.',
    inputSchema: z.object({
      agentId: z.string().optional().describe('Your agent ID. Omit on first call to get one generated.'),
      title: z.string().describe('Title shown at the top of the question form'),
      cards: z.array(CardSchema).describe('The question cards to display'),
    }),
  }, async ({ agentId, title, cards }) => {
    const result = store.createSession({ agentId, title, cards });
    const url = `${baseUrl}/session/${result.guid}`;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ guid: result.guid, url, agentId: result.agentId }),
      }],
    };
  });

  server.registerTool('get_session_status', {
    description: 'Poll the current state of a session. Returns status, cards, and any answers received so far.',
    inputSchema: z.object({
      agentId: z.string().describe('Your agent ID'),
      guid: z.string().describe('The session GUID'),
    }),
  }, async ({ agentId, guid }) => {
    const session = store.getSession(agentId, guid);
    if (!session) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Session not found or access denied' }) }], isError: true };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: session.status,
          title: session.title,
          cards: session.cards,
          answers: session.answers,
          submittedAt: session.submittedAt ?? null,
          globalComment: session.globalComment ?? null,
        }),
      }],
    };
  });

  server.registerTool('get_all_sessions', {
    description: 'Get the status and answers for all sessions belonging to this agent.',
    inputSchema: z.object({
      agentId: z.string().describe('Your agent ID'),
    }),
  }, async ({ agentId }) => {
    const sessions = store.getAllSessions(agentId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          sessions: sessions.map(s => ({
            guid: s.guid,
            title: s.title,
            status: s.status,
            answers: s.answers,
            submittedAt: s.submittedAt ?? null,
            globalComment: s.globalComment ?? null,
          })),
        }),
      }],
    };
  });

  server.registerTool('update_session', {
    description: 'Replace the card set on a live session. Existing answers for cards with matching IDs are preserved.',
    inputSchema: z.object({
      agentId: z.string().describe('Your agent ID'),
      guid: z.string().describe('The session GUID'),
      cards: z.array(CardSchema).describe('The new card set'),
    }),
  }, async ({ agentId, guid, cards }) => {
    const ok = store.updateCards(agentId, guid, cards);
    if (!ok) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Session not found, access denied, or session is closed' }) }], isError: true };
    }
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
  });

  server.registerTool('close_session', {
    description: 'End a session and retrieve final answers. The user will see a "session ended" message.',
    inputSchema: z.object({
      agentId: z.string().describe('Your agent ID'),
      guid: z.string().describe('The session GUID'),
    }),
  }, async ({ agentId, guid }) => {
    const result = store.closeSession(agentId, guid);
    if (!result) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Session not found or access denied' }) }], isError: true };
    }
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result),
      }],
    };
  });

  return server;
}
```

**Step 2: Commit**

```bash
git add questionpad-server/src/mcp.ts
git commit -m "feat(questionpad-server): add MCP tool definitions"
```

---

### Task 5: Express Server & REST Routes

**Files:**
- Create: `questionpad-server/src/server.ts`

**Step 1: Write the Express server**

```typescript
// server.ts
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionStore } from './store.js';
import { createMcpServer } from './mcp.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const TTL_MINUTES = parseInt(process.env.TTL_MINUTES || '60', 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const store = new SessionStore(TTL_MINUTES);

// Purge expired sessions every minute
setInterval(() => store.purgeExpired(), 60_000);

const app = createMcpExpressApp();

// Parse JSON bodies for API routes
app.use(express.json());

// --- MCP endpoint (stateless) ---
app.post('/mcp', async (req: Request, res: Response) => {
  const server = createMcpServer(store, BASE_URL);
  try {
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error('MCP error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// --- Serve app.html for session URLs ---
app.get('/session/:guid', (req: Request, res: Response) => {
  const session = store.getSessionPublic(req.params.guid);
  if (!session) {
    res.status(404).send('Session not found or expired');
    return;
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'app.html'));
});

// --- Browser REST API ---
app.get('/api/sessions/:guid', (req: Request, res: Response) => {
  const session = store.getSessionPublic(req.params.guid);
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired' });
    return;
  }
  res.json({
    title: session.title,
    cards: session.cards,
    answers: session.answers,
    status: session.status,
    cardVersion: session.cardVersion,
  });
});

app.post('/api/sessions/:guid/answers', (req: Request, res: Response) => {
  const { cardId, value, comment } = req.body;
  if (!cardId) {
    res.status(400).json({ error: 'cardId is required' });
    return;
  }
  const ok = store.submitAnswer(req.params.guid, { cardId, value, comment });
  if (!ok) {
    res.status(404).json({ error: 'Session not found, expired, or closed' });
    return;
  }
  res.json({ success: true });
});

app.post('/api/sessions/:guid/submit', (req: Request, res: Response) => {
  const { globalComment } = req.body || {};
  const ok = store.submitSession(req.params.guid, globalComment);
  if (!ok) {
    res.status(404).json({ error: 'Session not found, expired, or closed' });
    return;
  }
  res.json({ success: true });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`QuestionPad Server listening on port ${PORT}`);
  console.log(`MCP endpoint: ${BASE_URL}/mcp`);
  console.log(`Session URLs: ${BASE_URL}/session/<guid>`);
});
```

**Step 2: Verify it compiles**

Run: `cd questionpad-server && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add questionpad-server/src/server.ts
git commit -m "feat(questionpad-server): add Express server with MCP and REST routes"
```

---

### Task 6: Adapt app.html for Server Mode

**Files:**
- Copy: `plugins/questionpad/assets/app.html` → `questionpad-server/public/app.html`
- Modify: `questionpad-server/public/app.html`

The existing app.html uses `window.REQUEST_DATA` for injection and `localStorage` for response. We need to replace these with fetch-based API calls.

**Step 1: Copy the existing file**

```bash
mkdir -p questionpad-server/public
cp plugins/questionpad/assets/app.html questionpad-server/public/app.html
```

**Step 2: Replace the data loading and submission logic**

Find the IIFE at the bottom of the file (the `<script>` block starting around line 619). Replace the data loading, answer tracking, and submission sections with server-backed equivalents. The changes are:

1. **Extract GUID from URL:** `const guid = window.location.pathname.split('/session/')[1];`

2. **Fetch initial data from server instead of `window.REQUEST_DATA`:**
   ```javascript
   async function fetchSessionData() {
     const res = await fetch('/api/sessions/' + guid);
     if (!res.ok) { /* show error state */ return null; }
     return res.json();
   }
   ```

3. **Post each answer when a card is completed** (in the existing `setAnswer` or equivalent function):
   ```javascript
   function sendAnswer(cardId, value, comment) {
     fetch('/api/sessions/' + guid + '/answers', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ cardId, value, comment }),
     });
   }
   ```

4. **Poll for form changes every 5 seconds:**
   ```javascript
   let currentCardVersion = null;
   setInterval(async () => {
     const data = await fetchSessionData();
     if (!data) return;
     if (data.status === 'closed' || data.status === 'expired') {
       showSessionEnded();
       return;
     }
     if (data.cardVersion !== currentCardVersion) {
       currentCardVersion = data.cardVersion;
       requestData.cards = data.cards;
       // re-render preserving existing answers
       render();
       showToast('Form updated by facilitator');
     }
   }, 5000);
   ```

5. **Replace localStorage submission with POST:**
   ```javascript
   async function doSubmit() {
     submitted = true;
     const globalComment = document.getElementById('global-comment').value || '';
     await fetch('/api/sessions/' + guid + '/submit', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ globalComment }),
     });
     // show submitted overlay (existing code)
   }
   ```

6. **Remove all `localStorage` references** and `window.REQUEST_DATA` / `window.loadRequestData`.

7. **Add a toast notification element** for form update notifications — a simple fixed-position div that appears briefly.

8. **Add a session-ended overlay** similar to the submitted overlay but with "Session ended" message.

9. **Init on load:** Instead of checking `window.REQUEST_DATA`, immediately call `fetchSessionData()` and `render()`.

**Step 3: Verify the app loads**

Run: `cd questionpad-server && npx tsx src/server.ts`
Then open `http://localhost:3000/session/nonexistent` — should show 404.
Create a session via curl, then verify the form loads.

**Step 4: Commit**

```bash
git add questionpad-server/public/app.html
git commit -m "feat(questionpad-server): adapt app.html for server-backed operation"
```

---

### Task 7: Integration Test

**Files:**
- Create: `questionpad-server/src/integration.test.ts`

**Step 1: Write integration test**

This tests the full flow: create session via MCP-like store calls, submit answers via REST, poll for results.

```typescript
// integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SessionStore } from './store.js';

describe('Full flow integration', () => {
  const store = new SessionStore(60);

  it('agent creates session, user answers, agent polls, agent updates form, user submits', () => {
    // Agent creates session for Alice
    const alice = store.createSession({
      title: "Alice's Review",
      cards: [
        { id: 'q1', type: 'approve-reject', title: 'Approve the design?' },
        { id: 'q2', type: 'free-text', title: 'Comments?' },
      ],
    });

    // Agent creates session for Bob (same agent)
    const bob = store.createSession({
      agentId: alice.agentId,
      title: "Bob's Review",
      cards: [
        { id: 'q1', type: 'rating', title: 'Rate the design', min: 1, max: 5 },
      ],
    });

    // A different agent creates a session (should be isolated)
    const other = store.createSession({
      title: "Other Agent's Session",
      cards: [],
    });

    // Alice answers q1
    store.submitAnswer(alice.guid, { cardId: 'q1', value: 'approved' });

    // Agent polls all sessions — should see 2, not 3
    const agentSessions = store.getAllSessions(alice.agentId);
    expect(agentSessions).toHaveLength(2);

    // Agent polls Alice specifically
    const aliceStatus = store.getSession(alice.agentId, alice.guid);
    expect(aliceStatus?.status).toBe('in_progress');
    expect(aliceStatus?.answers).toHaveLength(1);

    // Agent cannot see the other agent's session
    expect(store.getSession(alice.agentId, other.guid)).toBeNull();

    // Agent updates Alice's form (adds a follow-up question)
    store.updateCards(alice.agentId, alice.guid, [
      { id: 'q1', type: 'approve-reject', title: 'Approve the design?' },
      { id: 'q2', type: 'free-text', title: 'Comments?' },
      { id: 'q3', type: 'yes-no', title: 'Should we proceed to implementation?' },
    ]);

    // Alice's q1 answer is preserved
    const aliceUpdated = store.getSession(alice.agentId, alice.guid);
    expect(aliceUpdated?.cards).toHaveLength(3);
    expect(aliceUpdated?.answers).toHaveLength(1);
    expect(aliceUpdated?.answers[0].cardId).toBe('q1');

    // Alice answers remaining questions and submits
    store.submitAnswer(alice.guid, { cardId: 'q2', value: 'Looks great' });
    store.submitAnswer(alice.guid, { cardId: 'q3', value: true });
    store.submitSession(alice.guid, 'Ready to go');

    // Bob rates and submits
    store.submitAnswer(bob.guid, { cardId: 'q1', value: 4 });
    store.submitSession(bob.guid);

    // Agent closes both sessions
    const aliceFinal = store.closeSession(alice.agentId, alice.guid);
    expect(aliceFinal?.finalAnswers).toHaveLength(3);
    expect(aliceFinal?.globalComment).toBe('Ready to go');

    const bobFinal = store.closeSession(alice.agentId, bob.guid);
    expect(bobFinal?.finalAnswers).toHaveLength(1);
    expect(bobFinal?.finalAnswers[0].value).toBe(4);
  });
});
```

**Step 2: Run tests**

Run: `cd questionpad-server && npx vitest run`
Expected: All tests pass (store tests + integration test)

**Step 3: Commit**

```bash
git add questionpad-server/src/integration.test.ts
git commit -m "test(questionpad-server): add integration test for multi-session flow"
```

---

### Task 8: Dockerfile

**Files:**
- Create: `questionpad-server/Dockerfile`
- Create: `questionpad-server/.dockerignore`

**Step 1: Write Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ dist/
COPY public/ public/
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**Step 2: Write .dockerignore**

```
node_modules
dist
*.test.ts
```

**Step 3: Build and verify**

Run: `cd questionpad-server && docker build -t questionpad-server .`
Expected: Build succeeds

**Step 4: Quick smoke test**

Run: `docker run --rm -p 3000:3000 -e BASE_URL=http://localhost:3000 questionpad-server`
In another terminal: `curl -s http://localhost:3000/session/test` — should return 404 "Session not found"

**Step 5: Commit**

```bash
git add questionpad-server/Dockerfile questionpad-server/.dockerignore
git commit -m "chore(questionpad-server): add Dockerfile for Azure Container Apps"
```

---

### Task 9: End-to-End Manual Smoke Test

No new files. This is a verification task.

**Step 1: Start the server**

Run: `cd questionpad-server && npx tsx src/server.ts`

**Step 2: Create a session via curl (simulating MCP tool call through the store)**

Since the MCP endpoint expects JSON-RPC, test via a quick script or use the dev server directly. Alternatively, write a small test script:

```bash
# Create a quick test script
cat > /tmp/test-questionpad.ts << 'EOF'
import { SessionStore } from './src/store.js';
const store = new SessionStore(60);
const session = store.createSession({
  title: 'Smoke Test',
  cards: [
    { id: 'q1', type: 'free-text', title: 'What is your name?' },
    { id: 'q2', type: 'rating', title: 'How are you feeling?', min: 1, max: 5 },
  ],
});
console.log(`Session URL: http://localhost:3000/session/${session.guid}`);
console.log(`Agent ID: ${session.agentId}`);
EOF
```

Alternatively, test via curl against the MCP endpoint using the JSON-RPC protocol:

```bash
curl -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_session","arguments":{"title":"Smoke Test","cards":[{"id":"q1","type":"free-text","title":"What is your name?"}]}}}'
```

**Step 3: Open the session URL in a browser, answer the question, verify the answer posts**

**Step 4: Poll the session via curl to see the answer**

**Step 5: Stop the server**

No commit needed — this is a manual verification step.
