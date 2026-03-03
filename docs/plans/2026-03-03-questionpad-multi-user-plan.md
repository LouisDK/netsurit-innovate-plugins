# QuestionPad Multi-User Sessions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-session MCP tools with batch-oriented tools that support multiple participants per session, and redesign the browser UI as a tabbed "session hub" where one human can participate in multiple sessions.

**Architecture:** Add `label` field to Session type. Rewrite SessionStore methods for batch create/get/close. Replace all 5 MCP tools with 4 new ones. Rewrite app.html as a hub with tab bar, localStorage persistence, per-tab polling, and notification dots.

**Tech Stack:** TypeScript, Express 5, @modelcontextprotocol/sdk ^1.27.1, Zod, Vitest, vanilla JS (no framework)

---

### Task 1: Add `label` field to Session type

**Files:**
- Modify: `questionpad-server/src/types.ts:32-45`

**Step 1: Update the Session interface**

Add the `label` field after `agentId`:

```typescript
export interface Session {
  guid: string;
  agentId: string;
  label: string;
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

**Step 2: Verify TypeScript compiles**

Run: `cd questionpad-server && npx tsc --noEmit`
Expected: Errors in store.ts (missing `label` in createSession) — that's expected, we'll fix it in Task 2.

**Step 3: Commit**

```bash
git add questionpad-server/src/types.ts
git commit -m "feat: add label field to Session interface"
```

---

### Task 2: Rewrite SessionStore for batch operations

**Files:**
- Modify: `questionpad-server/src/store.ts` (full rewrite)
- Modify: `questionpad-server/src/store.test.ts` (full rewrite)

**Step 1: Write the failing tests**

Replace the entire contents of `questionpad-server/src/store.test.ts` with:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from './store.js';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(60);
  });

  describe('createSession', () => {
    it('creates sessions for multiple participants', () => {
      const result = store.createSession({
        title: 'Review',
        participants: [
          { label: 'Alice', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] },
          { label: 'Bob', cards: [{ id: 'q1', type: 'yes-no', title: 'Q' }] },
        ],
      });
      expect(result.agentId).toBeTruthy();
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].label).toBe('Alice');
      expect(result.sessions[1].label).toBe('Bob');
      expect(result.sessions[0].guid).not.toBe(result.sessions[1].guid);
    });

    it('creates a single participant session (batch of 1)', () => {
      const result = store.createSession({
        title: 'Solo',
        participants: [{ label: 'User', cards: [] }],
      });
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].label).toBe('User');
    });

    it('generates agentId when not provided', () => {
      const result = store.createSession({
        title: 'Test',
        participants: [{ label: 'A', cards: [] }],
      });
      expect(result.agentId).toBeTruthy();
    });

    it('reuses agentId when provided', () => {
      const first = store.createSession({
        title: 'A',
        participants: [{ label: 'X', cards: [] }],
      });
      const second = store.createSession({
        agentId: first.agentId,
        title: 'B',
        participants: [{ label: 'Y', cards: [] }],
      });
      expect(second.agentId).toBe(first.agentId);
    });
  });

  describe('getSessions', () => {
    it('returns all sessions for an agent', () => {
      const r = store.createSession({
        title: 'Review',
        participants: [
          { label: 'Alice', cards: [] },
          { label: 'Bob', cards: [] },
        ],
      });
      const sessions = store.getSessions(r.agentId);
      expect(sessions).toHaveLength(2);
    });

    it('filters by guids when provided', () => {
      const r = store.createSession({
        title: 'Review',
        participants: [
          { label: 'Alice', cards: [] },
          { label: 'Bob', cards: [] },
        ],
      });
      const sessions = store.getSessions(r.agentId, [r.sessions[0].guid]);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].label).toBe('Alice');
    });

    it('returns empty for unknown agent', () => {
      expect(store.getSessions('unknown')).toEqual([]);
    });

    it('ignores guids belonging to other agents', () => {
      const a = store.createSession({
        title: 'A',
        participants: [{ label: 'X', cards: [] }],
      });
      const b = store.createSession({
        title: 'B',
        participants: [{ label: 'Y', cards: [] }],
      });
      // Agent A tries to fetch Agent B's session
      const sessions = store.getSessions(a.agentId, [b.sessions[0].guid]);
      expect(sessions).toEqual([]);
    });
  });

  describe('getSessionPublic', () => {
    it('returns session without agentId check', () => {
      const r = store.createSession({
        title: 'T',
        participants: [{ label: 'User', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
      });
      const session = store.getSessionPublic(r.sessions[0].guid);
      expect(session?.label).toBe('User');
      expect(session?.title).toBe('T');
    });

    it('returns null for unknown guid', () => {
      expect(store.getSessionPublic('nope')).toBeNull();
    });
  });

  describe('submitAnswer', () => {
    it('records an answer and transitions to in_progress', () => {
      const r = store.createSession({
        title: 'T',
        participants: [{ label: 'U', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
      });
      const guid = r.sessions[0].guid;
      store.submitAnswer(guid, { cardId: 'q1', value: 'hello' });
      const session = store.getSessionPublic(guid);
      expect(session?.status).toBe('in_progress');
      expect(session?.answers).toHaveLength(1);
      expect(session?.answers[0].value).toBe('hello');
    });

    it('updates an existing answer', () => {
      const r = store.createSession({
        title: 'T',
        participants: [{ label: 'U', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
      });
      const guid = r.sessions[0].guid;
      store.submitAnswer(guid, { cardId: 'q1', value: 'first' });
      store.submitAnswer(guid, { cardId: 'q1', value: 'second' });
      const session = store.getSessionPublic(guid);
      expect(session?.answers).toHaveLength(1);
      expect(session?.answers[0].value).toBe('second');
    });

    it('rejects answers on closed sessions', () => {
      const r = store.createSession({
        title: 'T',
        participants: [{ label: 'U', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
      });
      store.closeSessions(r.agentId);
      const ok = store.submitAnswer(r.sessions[0].guid, { cardId: 'q1', value: 'x' });
      expect(ok).toBe(false);
    });
  });

  describe('submitSession', () => {
    it('marks session as submitted with global comment', () => {
      const r = store.createSession({
        title: 'T',
        participants: [{ label: 'U', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
      });
      const guid = r.sessions[0].guid;
      store.submitAnswer(guid, { cardId: 'q1', value: 'hi' });
      store.submitSession(guid, 'Great form');
      const session = store.getSessionPublic(guid);
      expect(session?.status).toBe('submitted');
      expect(session?.submittedAt).toBeTruthy();
      expect(session?.globalComment).toBe('Great form');
    });
  });

  describe('updateCards', () => {
    it('updates cards and increments cardVersion', () => {
      const r = store.createSession({
        title: 'T',
        participants: [{ label: 'U', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
      });
      const guid = r.sessions[0].guid;
      store.updateCards(r.agentId, guid, [{ id: 'q2', type: 'yes-no', title: 'New Q' }]);
      const session = store.getSessionPublic(guid);
      expect(session?.cards).toHaveLength(1);
      expect(session?.cards[0].id).toBe('q2');
      expect(session?.cardVersion).toBe(1);
    });

    it('preserves answers for cards that still exist after update', () => {
      const r = store.createSession({
        title: 'T',
        participants: [{
          label: 'U',
          cards: [
            { id: 'q1', type: 'free-text', title: 'Q1' },
            { id: 'q2', type: 'yes-no', title: 'Q2' },
          ],
        }],
      });
      const guid = r.sessions[0].guid;
      store.submitAnswer(guid, { cardId: 'q1', value: 'keep me' });
      store.submitAnswer(guid, { cardId: 'q2', value: true });
      store.updateCards(r.agentId, guid, [
        { id: 'q1', type: 'free-text', title: 'Q1 updated' },
        { id: 'q3', type: 'rating', title: 'New Q' },
      ]);
      const session = store.getSessionPublic(guid);
      expect(session?.answers).toHaveLength(1);
      expect(session?.answers[0].cardId).toBe('q1');
    });

    it('rejects updates from wrong agent', () => {
      const r = store.createSession({
        title: 'T',
        participants: [{ label: 'U', cards: [] }],
      });
      const ok = store.updateCards('wrong-agent', r.sessions[0].guid, []);
      expect(ok).toBe(false);
    });
  });

  describe('closeSessions', () => {
    it('closes all sessions when guids omitted', () => {
      const r = store.createSession({
        title: 'Review',
        participants: [
          { label: 'Alice', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] },
          { label: 'Bob', cards: [] },
        ],
      });
      store.submitAnswer(r.sessions[0].guid, { cardId: 'q1', value: 'answer' });
      const results = store.closeSessions(r.agentId);
      expect(results).toHaveLength(2);
      expect(results[0].label).toBe('Alice');
      expect(results[0].finalAnswers).toHaveLength(1);
      expect(results[1].label).toBe('Bob');
      expect(results[1].finalAnswers).toHaveLength(0);
    });

    it('closes specific sessions when guids provided', () => {
      const r = store.createSession({
        title: 'Review',
        participants: [
          { label: 'Alice', cards: [] },
          { label: 'Bob', cards: [] },
        ],
      });
      const results = store.closeSessions(r.agentId, [r.sessions[0].guid]);
      expect(results).toHaveLength(1);
      expect(results[0].label).toBe('Alice');
      // Bob should still be open
      const sessions = store.getSessions(r.agentId);
      const bob = sessions.find(s => s.label === 'Bob');
      expect(bob?.status).not.toBe('closed');
    });

    it('returns empty for unknown agent', () => {
      expect(store.closeSessions('unknown')).toEqual([]);
    });

    it('ignores guids belonging to other agents', () => {
      const a = store.createSession({
        title: 'A',
        participants: [{ label: 'X', cards: [] }],
      });
      const b = store.createSession({
        title: 'B',
        participants: [{ label: 'Y', cards: [] }],
      });
      const results = store.closeSessions(a.agentId, [b.sessions[0].guid]);
      expect(results).toEqual([]);
    });
  });

  describe('purgeExpired', () => {
    it('expires sessions past TTL', () => {
      const shortStore = new SessionStore(0);
      const r = shortStore.createSession({
        title: 'T',
        participants: [{ label: 'U', cards: [] }],
      });
      shortStore.purgeExpired();
      expect(shortStore.getSessionPublic(r.sessions[0].guid)).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd questionpad-server && npx vitest run src/store.test.ts`
Expected: All tests FAIL (store API doesn't match yet).

**Step 3: Rewrite the SessionStore**

Replace the entire contents of `questionpad-server/src/store.ts` with:

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { Card, Answer, Session } from './types.js';

interface Participant {
  label: string;
  cards: Card[];
}

interface CreateSessionInput {
  agentId?: string;
  title: string;
  participants: Participant[];
}

interface CreateSessionResult {
  agentId: string;
  sessions: Array<{ label: string; guid: string }>;
}

interface CloseSessionResult {
  guid: string;
  label: string;
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

  createSession(input: CreateSessionInput): CreateSessionResult {
    const agentId = input.agentId || uuidv4();

    if (!this.agents.has(agentId)) {
      this.agents.set(agentId, new Set());
    }
    const agentGuids = this.agents.get(agentId)!;

    const now = Date.now();
    const sessions: Array<{ label: string; guid: string }> = [];

    for (const participant of input.participants) {
      const guid = uuidv4();
      agentGuids.add(guid);

      this.sessions.set(guid, {
        guid,
        agentId,
        label: participant.label,
        title: input.title,
        cards: participant.cards,
        answers: [],
        status: 'created',
        createdAt: now,
        lastActivityAt: now,
        cardVersion: 0,
      });

      sessions.push({ label: participant.label, guid });
    }

    return { agentId, sessions };
  }

  getSessions(agentId: string, guids?: string[]): Session[] {
    const agentGuids = this.agents.get(agentId);
    if (!agentGuids) return [];

    const targetGuids = guids
      ? guids.filter(g => agentGuids.has(g))
      : [...agentGuids];

    const result: Session[] = [];
    for (const guid of targetGuids) {
      const session = this.sessions.get(guid);
      if (session) {
        this.touch(guid);
        result.push(session);
      }
    }
    return result;
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

  closeSessions(agentId: string, guids?: string[]): CloseSessionResult[] {
    const agentGuids = this.agents.get(agentId);
    if (!agentGuids) return [];

    const targetGuids = guids
      ? guids.filter(g => agentGuids.has(g))
      : [...agentGuids];

    const results: CloseSessionResult[] = [];
    for (const guid of targetGuids) {
      const session = this.sessions.get(guid);
      if (!session) continue;

      session.status = 'closed';
      this.touch(guid);
      results.push({
        guid,
        label: session.label,
        finalAnswers: session.answers,
        globalComment: session.globalComment,
        submittedAt: session.submittedAt,
      });
    }
    return results;
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [guid, session] of this.sessions) {
      if (now - session.lastActivityAt >= this.ttlMs) {
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

**Step 4: Run tests to verify they pass**

Run: `cd questionpad-server && npx vitest run src/store.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add questionpad-server/src/store.ts questionpad-server/src/store.test.ts
git commit -m "feat: rewrite SessionStore for batch multi-participant operations"
```

---

### Task 3: Rewrite MCP tool definitions

**Files:**
- Modify: `questionpad-server/src/mcp.ts` (full rewrite)

**Step 1: Replace mcp.ts with the new 4-tool surface**

Replace the entire contents of `questionpad-server/src/mcp.ts` with:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SessionStore } from './store.js';

const CardSchema = z.object({
  id: z.string(),
  type: z.enum([
    'multiple-choice',
    'multi-select',
    'yes-no',
    'approve-reject',
    'free-text',
    'rating',
    'slider',
    'range-slider',
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

const ParticipantSchema = z.object({
  label: z.string(),
  cards: z.array(CardSchema),
});

function text(obj: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(obj) }];
}

export function createMcpServer(store: SessionStore, baseUrl: string): McpServer {
  const server = new McpServer({
    name: 'questionpad-server',
    version: '0.2.0',
  });

  // 1. create_session — batch: one or more participants
  server.registerTool(
    'create_session',
    {
      description:
        'Create a QuestionPad session with one or more participants. Each participant gets their own URL with their own set of question cards.',
      inputSchema: {
        agentId: z.string().optional(),
        title: z.string(),
        participants: z.array(ParticipantSchema).min(1),
      },
    },
    (args) => {
      const result = store.createSession({
        agentId: args.agentId,
        title: args.title,
        participants: args.participants,
      });
      return {
        content: text({
          agentId: result.agentId,
          sessions: result.sessions.map((s) => ({
            label: s.label,
            guid: s.guid,
            url: `${baseUrl}/session/${s.guid}`,
          })),
        }),
      };
    },
  );

  // 2. get_sessions — batch: all or filtered by guids
  server.registerTool(
    'get_sessions',
    {
      description:
        'Get status and answers for sessions. Omit guids to get all sessions for this agent, or pass specific guids to filter.',
      inputSchema: {
        agentId: z.string(),
        guids: z.array(z.string()).optional(),
      },
    },
    (args) => {
      const sessions = store.getSessions(args.agentId, args.guids);
      const result = sessions.map((s) => ({
        guid: s.guid,
        label: s.label,
        title: s.title,
        status: s.status,
        cards: s.cards,
        answers: s.answers,
        globalComment: s.globalComment,
        submittedAt: s.submittedAt,
      }));
      return { content: text(result) };
    },
  );

  // 3. update_session — single session (different participants have different cards)
  server.registerTool(
    'update_session',
    {
      description: 'Update the cards of an existing session.',
      inputSchema: {
        agentId: z.string(),
        guid: z.string(),
        cards: z.array(CardSchema),
      },
    },
    (args) => {
      const ok = store.updateCards(args.agentId, args.guid, args.cards);
      if (!ok) {
        return {
          isError: true,
          content: text({ error: 'Session not found or cannot be updated' }),
        };
      }
      return { content: text({ success: true }) };
    },
  );

  // 4. close_sessions — batch: all or filtered by guids
  server.registerTool(
    'close_sessions',
    {
      description:
        'Close sessions and retrieve final answers. Omit guids to close all sessions for this agent, or pass specific guids.',
      inputSchema: {
        agentId: z.string(),
        guids: z.array(z.string()).optional(),
      },
    },
    (args) => {
      const results = store.closeSessions(args.agentId, args.guids);
      if (results.length === 0) {
        return {
          isError: true,
          content: text({ error: 'No sessions found' }),
        };
      }
      return { content: text(results) };
    },
  );

  return server;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd questionpad-server && npx tsc --noEmit`
Expected: PASS (no errors).

**Step 3: Commit**

```bash
git add questionpad-server/src/mcp.ts
git commit -m "feat: replace MCP tools with batch-oriented create/get/update/close"
```

---

### Task 4: Update server routes (add /hub, include label in API response)

**Files:**
- Modify: `questionpad-server/src/server.ts:42-67`

**Step 1: Add /hub route and update API response to include label**

In `questionpad-server/src/server.ts`, make these changes:

1. Add `GET /hub` route that serves app.html (no session validation needed):

```typescript
// GET /hub — serve the hub page (no session pre-loaded)
app.get('/hub', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'app.html');
  res.sendFile(htmlPath);
});
```

2. Change `GET /session/:guid` to serve app.html **without** the 404 check (the hub JS will validate the GUID via the API):

```typescript
// GET /session/:guid — serve the hub page with pre-loaded session
app.get('/session/:guid', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'app.html');
  res.sendFile(htmlPath);
});
```

3. Add `label` to the `GET /api/sessions/:guid` response:

```typescript
res.json({
  label: session.label,
  title: session.title,
  cards: session.cards,
  answers: session.answers,
  status: session.status,
  cardVersion: session.cardVersion,
});
```

**Step 2: Verify TypeScript compiles**

Run: `cd questionpad-server && npx tsc --noEmit`
Expected: PASS.

**Step 3: Commit**

```bash
git add questionpad-server/src/server.ts
git commit -m "feat: add /hub route, include label in API response"
```

---

### Task 5: Update integration test for batch API

**Files:**
- Modify: `questionpad-server/src/integration.test.ts` (full rewrite)

**Step 1: Rewrite the integration test**

Replace the entire contents of `questionpad-server/src/integration.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import { SessionStore } from './store.js';

describe('Multi-user integration flow', () => {
  const store = new SessionStore(60);

  it('agent creates batch session, users answer, agent polls and closes', () => {
    // Agent creates a session for Alice and Bob with different questions
    const result = store.createSession({
      title: 'Design Review',
      participants: [
        {
          label: 'Alice',
          cards: [
            { id: 'q1', type: 'approve-reject', title: 'Approve the design?' },
            { id: 'q2', type: 'free-text', title: 'Comments?' },
          ],
        },
        {
          label: 'Bob',
          cards: [
            { id: 'q1', type: 'rating', title: 'Rate the design', min: 1, max: 5 },
          ],
        },
      ],
    });

    expect(result.sessions).toHaveLength(2);
    const aliceGuid = result.sessions[0].guid;
    const bobGuid = result.sessions[1].guid;

    // A different agent creates a session (should be isolated)
    const other = store.createSession({
      title: "Other Agent's Session",
      participants: [{ label: 'Eve', cards: [] }],
    });

    // Alice answers q1
    store.submitAnswer(aliceGuid, { cardId: 'q1', value: 'approved' });

    // Agent polls all sessions — should see 2 (not Eve's)
    const agentSessions = store.getSessions(result.agentId);
    expect(agentSessions).toHaveLength(2);

    // Agent polls just Alice
    const aliceSessions = store.getSessions(result.agentId, [aliceGuid]);
    expect(aliceSessions).toHaveLength(1);
    expect(aliceSessions[0].status).toBe('in_progress');
    expect(aliceSessions[0].label).toBe('Alice');

    // Agent cannot see the other agent's session
    const cross = store.getSessions(result.agentId, [other.sessions[0].guid]);
    expect(cross).toEqual([]);

    // Agent updates Alice's form (adds a follow-up question)
    store.updateCards(result.agentId, aliceGuid, [
      { id: 'q1', type: 'approve-reject', title: 'Approve the design?' },
      { id: 'q2', type: 'free-text', title: 'Comments?' },
      { id: 'q3', type: 'yes-no', title: 'Should we proceed to implementation?' },
    ]);

    // Alice's q1 answer is preserved
    const aliceUpdated = store.getSessionPublic(aliceGuid);
    expect(aliceUpdated?.cards).toHaveLength(3);
    expect(aliceUpdated?.answers).toHaveLength(1);
    expect(aliceUpdated?.answers[0].cardId).toBe('q1');

    // Alice answers remaining questions and submits
    store.submitAnswer(aliceGuid, { cardId: 'q2', value: 'Looks great' });
    store.submitAnswer(aliceGuid, { cardId: 'q3', value: true });
    store.submitSession(aliceGuid, 'Ready to go');

    // Bob rates and submits
    store.submitAnswer(bobGuid, { cardId: 'q1', value: 4 });
    store.submitSession(bobGuid);

    // Agent batch-closes both sessions
    const closed = store.closeSessions(result.agentId);
    expect(closed).toHaveLength(2);

    const aliceFinal = closed.find(c => c.label === 'Alice')!;
    expect(aliceFinal.finalAnswers).toHaveLength(3);
    expect(aliceFinal.globalComment).toBe('Ready to go');

    const bobFinal = closed.find(c => c.label === 'Bob')!;
    expect(bobFinal.finalAnswers).toHaveLength(1);
    expect(bobFinal.finalAnswers[0].value).toBe(4);
  });

  it('agent closes a subset of sessions', () => {
    const r = store.createSession({
      title: 'Workshop',
      participants: [
        { label: 'Charlie', cards: [] },
        { label: 'Diana', cards: [] },
        { label: 'Eve', cards: [] },
      ],
    });

    // Close only Charlie and Diana
    const closed = store.closeSessions(r.agentId, [r.sessions[0].guid, r.sessions[1].guid]);
    expect(closed).toHaveLength(2);

    // Eve should still be open
    const remaining = store.getSessions(r.agentId);
    const eve = remaining.find(s => s.label === 'Eve');
    expect(eve?.status).toBe('created');
  });
});
```

**Step 2: Run all tests**

Run: `cd questionpad-server && npx vitest run`
Expected: All tests PASS.

**Step 3: Commit**

```bash
git add questionpad-server/src/integration.test.ts
git commit -m "test: rewrite integration tests for multi-user batch API"
```

---

### Task 6: Rewrite app.html as a session hub

This is the largest task. The browser app becomes a tabbed hub where each tab is a session.

**Files:**
- Modify: `questionpad-server/public/app.html`

**Overview of changes:**
The existing app.html has all the card-building functions (buildRating, buildSlider, buildYesNo, etc.) and keyboard navigation that we want to keep. The changes are structural:

1. **New HTML structure:** Add a tab bar and "add session" input above the existing form content
2. **Multi-session state:** Instead of one global `guid`, `requestData`, `answers`, etc., maintain a `sessions` Map keyed by GUID, each with its own state
3. **Tab switching:** Clicking a tab saves the current tab's state and renders the new tab's form
4. **Independent polling:** Each session has its own poll interval
5. **Notifications:** Background tabs show a pulsing dot when cardVersion changes
6. **localStorage:** Save/restore GUID list across page loads

**Step 1: Add CSS for tab bar and notifications**

Add these styles after the existing `.card.active` rule (around line 130):

```css
/* Tab bar */
.tab-bar {
  display: flex;
  gap: 4px;
  max-width: 800px;
  margin: 10px auto 0;
  overflow-x: auto;
  padding-bottom: 2px;
}

.tab-bar:empty { display: none; }

.tab {
  position: relative;
  padding: 8px 16px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}

.tab:hover { color: var(--text); }

.tab.active {
  background: var(--bg);
  color: var(--text);
  border-color: var(--card-hover);
  font-weight: 600;
}

.tab .tab-dot {
  display: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d4a017;
  position: absolute;
  top: 4px;
  right: 4px;
  animation: pulse-dot 1.2s ease-in-out infinite;
}

.tab.has-update .tab-dot { display: block; }

.tab.has-update {
  animation: glow-tab 1.5s ease-out;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

@keyframes glow-tab {
  0% { box-shadow: 0 0 12px rgba(212, 160, 23, 0.5); }
  100% { box-shadow: none; }
}

/* Add session input */
.add-session-bar {
  max-width: 800px;
  margin: 8px auto 0;
  display: flex;
  gap: 8px;
}

.add-session-bar input {
  flex: 1;
  padding: 6px 12px;
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.85rem;
  outline: none;
}

.add-session-bar input:focus { border-color: var(--progress); }

.add-session-bar input::placeholder { color: var(--muted); }

.add-session-bar button {
  padding: 6px 14px;
  background: var(--progress);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
}

.add-session-bar button:hover { background: var(--submit-hover); }

/* Participant label */
.participant-label {
  color: var(--muted);
  font-size: 0.9rem;
  max-width: 800px;
  margin: 4px auto 0;
}
```

**Step 2: Update HTML structure**

Replace the body content (between `<body>` and `<script>`) with:

```html
<div id="app-waiting" class="waiting">Loading...</div>
<div id="app-root" style="display:none;">
  <div class="header">
    <div class="header-top">
      <h1 id="req-title"></h1>
      <span class="progress-count" id="progress-count"></span>
    </div>
    <div class="tab-bar" id="tab-bar"></div>
    <div class="add-session-bar" id="add-session-bar">
      <input type="text" id="add-session-input" placeholder="Paste a session GUID or URL to join another session...">
      <button id="add-session-btn">Add</button>
    </div>
    <div class="participant-label" id="participant-label"></div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-fill" id="progress-bar"></div>
    </div>
  </div>
  <div class="main">
    <div class="cards" id="cards-container"></div>
  </div>
  <div class="footer">
    <div class="footer-inner">
      <textarea class="global-comment" id="global-comment" placeholder="Overall feedback (optional)..." rows="2"></textarea>
      <button class="btn-submit" id="btn-submit" disabled>Submit All Feedback</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>
```

**Step 3: Rewrite the JavaScript**

This is the core change. The JavaScript needs to be restructured around a `sessions` Map where each entry holds the full state for one session tab. The existing card-building and keyboard navigation functions remain unchanged — they operate on whichever session is currently active.

Key structural changes to the `<script>` block:

1. **Replace single-session globals** with a sessions Map:

```javascript
// --- Multi-session hub state ---
var sessions = {};       // guid -> { requestData, answers, comments, statuses, submitted, currentCardVersion, activeCardId, pollInterval, hasUpdate }
var activeGuid = null;   // currently visible session
var STORAGE_KEY = 'questionpad-hub-sessions';
```

2. **Extract GUID from URL** — detect `/session/:guid` or `/hub`:

```javascript
var pathGuid = null;
var pathMatch = window.location.pathname.match(/\/session\/([^/]+)/);
if (pathMatch) pathGuid = pathMatch[1];
```

3. **addSession(guid)** function — validates via API, creates session state, starts polling, adds tab:

```javascript
async function addSession(guid) {
  if (sessions[guid]) {
    showToast('Session already added');
    return;
  }
  var res = await fetch('/api/sessions/' + guid);
  if (!res.ok) {
    showToast('Session not found');
    return;
  }
  var data = await res.json();
  sessions[guid] = {
    requestData: { title: data.title, cards: data.cards, label: data.label },
    answers: {},
    comments: {},
    statuses: {},
    submitted: data.status === 'submitted' || data.status === 'closed',
    currentCardVersion: data.cardVersion,
    activeCardId: null,
    hasUpdate: false,
    pollInterval: null,
  };
  // Restore answers from server
  (data.answers || []).forEach(function(a) {
    sessions[guid].answers[a.cardId] = a.value;
    if (a.comment) sessions[guid].comments[a.cardId] = a.comment;
    sessions[guid].statuses[a.cardId] = 'answered';
  });
  // Initialize unanswered statuses
  data.cards.forEach(function(card) {
    if (!sessions[guid].statuses[card.id]) {
      sessions[guid].statuses[card.id] = 'unanswered';
      sessions[guid].comments[card.id] = '';
    }
  });
  saveGuids();
  renderTabs();
  startPolling(guid);
  switchTab(guid);
}
```

4. **switchTab(guid)** — saves current active session state, renders the new session's form:

```javascript
function switchTab(guid) {
  if (!sessions[guid]) return;
  sessions[guid].hasUpdate = false;
  activeGuid = guid;
  renderTabs();
  renderActiveSession();
}
```

5. **renderActiveSession()** — the existing `render()` function, but operating on `sessions[activeGuid]` state instead of globals. The card-building functions (`buildRating`, `buildSlider`, etc.) stay exactly the same — they just need to read/write from the active session's state.

6. **startPolling(guid)** — independent poll per session:

```javascript
function startPolling(guid) {
  if (sessions[guid].pollInterval) return;
  sessions[guid].pollInterval = setInterval(async function() {
    var s = sessions[guid];
    if (!s || s.submitted) return;
    var res = await fetch('/api/sessions/' + guid);
    if (!res.ok) {
      // Session expired/deleted — remove it
      removeSession(guid);
      return;
    }
    var data = await res.json();
    if (data.status === 'closed' || data.status === 'expired') {
      clearInterval(s.pollInterval);
      if (guid === activeGuid) showSessionEnded();
      return;
    }
    if (data.cardVersion !== s.currentCardVersion) {
      s.currentCardVersion = data.cardVersion;
      s.requestData = { title: data.title, cards: data.cards, label: data.label };
      // Restore answers from server
      var pendingAnswers = data.answers || [];
      if (guid === activeGuid) {
        // Re-render the active form
        renderActiveSession(pendingAnswers);
        showToast('Form updated by facilitator');
      } else {
        // Background tab — mark as having update
        s.hasUpdate = true;
        renderTabs();
      }
    }
  }, 5000);
}
```

7. **renderTabs()** — builds the tab bar:

```javascript
function renderTabs() {
  var bar = document.getElementById('tab-bar');
  bar.innerHTML = '';
  var guids = Object.keys(sessions);
  // Only show tab bar if more than one session
  if (guids.length <= 1) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  guids.forEach(function(guid, idx) {
    var s = sessions[guid];
    var tab = document.createElement('div');
    tab.className = 'tab' + (guid === activeGuid ? ' active' : '') + (s.hasUpdate ? ' has-update' : '');
    var label = s.requestData.label ? s.requestData.title + ' — ' + s.requestData.label : s.requestData.title;
    tab.textContent = label;
    var dot = document.createElement('span');
    dot.className = 'tab-dot';
    tab.appendChild(dot);
    tab.addEventListener('click', function() { switchTab(guid); });
    bar.appendChild(tab);
  });
}
```

8. **localStorage persistence:**

```javascript
function saveGuids() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.keys(sessions)));
}

function loadGuids() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}
```

9. **Bootstrap on page load:**

```javascript
async function init() {
  // Load saved sessions from localStorage
  var savedGuids = loadGuids();
  // Add the URL guid first if present
  if (pathGuid && savedGuids.indexOf(pathGuid) < 0) {
    savedGuids.unshift(pathGuid);
  }
  if (savedGuids.length === 0) {
    // Show hub with just the add-session input
    document.getElementById('app-waiting').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    return;
  }
  // Try to add each saved guid
  for (var i = 0; i < savedGuids.length; i++) {
    await addSession(savedGuids[i]);
  }
  if (Object.keys(sessions).length === 0) {
    document.getElementById('app-waiting').style.display = 'none';
    document.getElementById('app-root').style.display = '';
  }
}

init();
```

10. **Add session input handler:**

```javascript
document.getElementById('add-session-btn').addEventListener('click', function() {
  var input = document.getElementById('add-session-input');
  var val = input.value.trim();
  // Extract GUID from URL or raw GUID
  var match = val.match(/\/session\/([^/?#]+)/);
  var guid = match ? match[1] : val;
  if (!guid) return;
  input.value = '';
  addSession(guid);
});

document.getElementById('add-session-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    document.getElementById('add-session-btn').click();
  }
});
```

11. **Keyboard shortcut for tab switching** (Ctrl+1/2/3):

```javascript
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
    var idx = parseInt(e.key) - 1;
    var guids = Object.keys(sessions);
    if (idx < guids.length) {
      e.preventDefault();
      switchTab(guids[idx]);
    }
  }
});
```

12. **Show participant label** when rendering a session:

In the `renderActiveSession` function, after setting the title:

```javascript
var labelEl = document.getElementById('participant-label');
var s = sessions[activeGuid];
if (s.requestData.label) {
  labelEl.textContent = 'Participant: ' + s.requestData.label;
  labelEl.style.display = '';
} else {
  labelEl.style.display = 'none';
}
```

**Important:** The card-building functions (`buildRating`, `buildSlider`, `buildYesNo`, `buildMultipleChoice`, `buildApproveReject`, `buildFreeText`, `buildMultiSelect`, `buildRangeSlider`) and the keyboard navigation code remain exactly the same. They operate on the module-level `answers`, `comments`, `statuses`, `submitted`, `activeCardId` variables. The `switchTab` function needs to save these from the outgoing session and restore them from the incoming session:

```javascript
function switchTab(guid) {
  // Save current session state
  if (activeGuid && sessions[activeGuid]) {
    sessions[activeGuid].answers = answers;
    sessions[activeGuid].comments = comments;
    sessions[activeGuid].statuses = statuses;
    sessions[activeGuid].submitted = submitted;
    sessions[activeGuid].activeCardId = activeCardId;
  }
  // Restore new session state to globals
  var s = sessions[guid];
  s.hasUpdate = false;
  activeGuid = guid;
  answers = s.answers;
  comments = s.comments;
  statuses = s.statuses;
  submitted = s.submitted;
  activeCardId = null;  // will be set by render
  requestData = s.requestData;
  currentCardVersion = s.currentCardVersion;
  renderTabs();
  render();
}
```

**Step 4: Verify the app works**

Run: `cd questionpad-server && PORT=3456 npx tsx src/server.ts`

Test: Create a multi-participant session via curl:

```bash
curl -s http://localhost:3456/mcp -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

curl -s http://localhost:3456/mcp -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_session","arguments":{"title":"Design Review","participants":[{"label":"Alice","cards":[{"id":"q1","type":"rating","title":"Rate the design","min":1,"max":5}]},{"label":"Bob","cards":[{"id":"q1","type":"yes-no","title":"Approve?"}]}]}}}'
```

Expected: Two GUIDs and URLs returned. Opening each URL shows the hub with that session's form. The participant label is visible.

Test hub: Open `http://localhost:3456/hub`, paste the second session's GUID — a second tab should appear.

**Step 5: Commit**

```bash
git add questionpad-server/public/app.html
git commit -m "feat: rewrite browser app as multi-session hub with tabs and notifications"
```

---

### Task 7: Smoke test the full flow

**Files:** None (manual testing only)

**Step 1: Start the server**

Run: `cd questionpad-server && PORT=3456 npx tsx src/server.ts`

**Step 2: Create a multi-participant session**

```bash
curl -s http://localhost:3456/mcp -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

curl -s http://localhost:3456/mcp -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_session","arguments":{"title":"Design Review","participants":[{"label":"Alice","cards":[{"id":"q1","type":"rating","title":"Rate the design","min":1,"max":5},{"id":"q2","type":"free-text","title":"Comments?"}]},{"label":"Bob","cards":[{"id":"q1","type":"yes-no","title":"Approve?"},{"id":"q2","type":"multiple-choice","title":"Priority?","options":["High","Medium","Low"]}]}]}}}'
```

**Step 3: Test the hub**

1. Open Alice's URL — verify golden border on first card, participant label shows "Participant: Alice"
2. Copy Bob's GUID
3. Paste into the "Add session" input in Alice's browser tab
4. Verify a second tab appears showing "Design Review — Bob"
5. Answer Alice's questions, switch to Bob's tab
6. Verify Alice's tab shows as answered (collapsed cards, etc.)
7. Go back to Alice — answers should be preserved

**Step 4: Test notifications**

1. While viewing Alice's tab, update Bob's cards via MCP:

```bash
curl -s http://localhost:3456/mcp -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"update_session","arguments":{"agentId":"<AGENT_ID>","guid":"<BOB_GUID>","cards":[{"id":"q1","type":"yes-no","title":"Approve?"},{"id":"q2","type":"multiple-choice","title":"Priority?","options":["High","Medium","Low"]},{"id":"q3","type":"free-text","title":"New follow-up question"}]}}}'
```

2. Verify Bob's tab shows a pulsing gold dot
3. Click Bob's tab — dot clears, new question appears

**Step 5: Test batch fetch and close**

```bash
# Fetch all sessions
curl -s http://localhost:3456/mcp -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_sessions","arguments":{"agentId":"<AGENT_ID>"}}}'

# Close all sessions
curl -s http://localhost:3456/mcp -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"close_sessions","arguments":{"agentId":"<AGENT_ID>"}}}'
```

Verify: Both browsers show "Session Ended" on next poll.

**Step 6: Test localStorage persistence**

1. Refresh the page — both tabs should reappear from localStorage
2. Close a session via MCP — on next refresh, only the surviving session should appear

**Step 7: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: smoke test fixes for multi-user hub"
```

---

Plan complete and saved to `docs/plans/2026-03-03-questionpad-multi-user-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?