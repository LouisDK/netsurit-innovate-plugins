# Shared Sessions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow multiple people to fill in the same QuestionPad form via a single shared URL, each identifying themselves by name, with the AI agent seeing all individual responses.

**Architecture:** Add a `Respondent` concept inside each `Session`. The browser shows a name prompt before the form. All answers and submission state move from session-level to respondent-level. The MCP response shape changes from flat `answers`/`globalComment` to a `respondents[]` array. The browser API endpoints (`/answers`, `/submit`) gain a `respondentId` parameter, and a new `/join` endpoint creates respondents.

**Tech Stack:** TypeScript, Express, Vitest, Zod, single-file HTML/CSS/JS app

---

### Task 1: Update types.ts — Add Respondent, update Session

**Files:**
- Modify: `questionpad-server/src/types.ts`

**Step 1: Rewrite types.ts**

Replace the contents of `questionpad-server/src/types.ts` with:

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

export type SessionStatus = 'created' | 'in_progress' | 'closed' | 'expired';

export type RespondentStatus = 'in_progress' | 'submitted';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  body?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface Answer {
  cardId: string;
  value: unknown;
  comment?: string;
}

export interface Respondent {
  respondentId: string;
  name: string;
  answers: Answer[];
  globalComment?: string;
  status: RespondentStatus;
  joinedAt: string;
  submittedAt?: string;
}

export interface Session {
  guid: string;
  agentId: string;
  label: string;
  title: string;
  description?: string;
  cards: Card[];
  respondents: Respondent[];
  status: SessionStatus;
  createdAt: number;
  lastActivityAt: number;
  cardVersion: number;
}
```

Key changes:
- `SessionStatus` removes `'submitted'` (now per-respondent)
- New `RespondentStatus` type: `'in_progress' | 'submitted'`
- New `Respondent` interface with `respondentId`, `name`, `answers`, `globalComment`, `status`, `joinedAt`, `submittedAt`
- `Session` replaces `answers: Answer[]`, `globalComment`, `submittedAt` with `respondents: Respondent[]`

**Step 2: Verify the project still compiles (it won't — store.ts and other files reference old fields)**

Run: `cd questionpad-server && npx tsc --noEmit 2>&1 | head -20`
Expected: Compilation errors in store.ts, mcp.ts, server.ts referencing old `answers`, `globalComment`, `submittedAt`, `submitted` status

This is expected — we fix these in the next tasks.

**Step 3: Commit**

```bash
git add questionpad-server/src/types.ts
git commit -m "refactor(types): add Respondent, move answers from Session to Respondent"
```

---

### Task 2: Rewrite store.ts — Respondent-based operations

**Files:**
- Modify: `questionpad-server/src/store.ts`

**Step 1: Rewrite store.ts**

Replace the contents of `questionpad-server/src/store.ts` with:

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { Card, Answer, Session, Respondent } from './types.js';

interface Participant {
  label: string;
  cards: Card[];
}

interface CreateSessionInput {
  agentId?: string;
  title: string;
  description?: string;
  participants: Participant[];
}

interface CreateSessionResult {
  agentId: string;
  sessions: Array<{ label: string; guid: string }>;
}

interface JoinResult {
  respondentId: string;
  answers: Answer[];
}

interface CloseSessionResult {
  guid: string;
  label: string;
  respondents: Array<{
    name: string;
    answers: Answer[];
    globalComment?: string;
    submittedAt?: string;
  }>;
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
        description: input.description,
        cards: participant.cards,
        respondents: [],
        status: 'created',
        createdAt: now,
        lastActivityAt: now,
        cardVersion: 0,
      });

      sessions.push({ label: participant.label, guid });
    }

    return { agentId, sessions };
  }

  joinSession(guid: string, name: string): JoinResult | null {
    const session = this.sessions.get(guid);
    if (!session || session.status === 'closed' || session.status === 'expired') return null;

    // If a respondent with this name already exists, return them (resubmit)
    const existing = session.respondents.find(r => r.name === name);
    if (existing) {
      this.touch(guid);
      return { respondentId: existing.respondentId, answers: existing.answers };
    }

    const respondent: Respondent = {
      respondentId: uuidv4(),
      name,
      answers: [],
      status: 'in_progress',
      joinedAt: new Date().toISOString(),
    };
    session.respondents.push(respondent);

    if (session.status === 'created') {
      session.status = 'in_progress';
    }
    this.touch(guid);
    return { respondentId: respondent.respondentId, answers: [] };
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

  getSessionPublic(guid: string): Session | null {
    const session = this.sessions.get(guid);
    if (!session) return null;
    this.touch(guid);
    return session;
  }

  submitAnswer(guid: string, respondentId: string, answer: Answer): boolean {
    const session = this.sessions.get(guid);
    if (!session || session.status === 'closed' || session.status === 'expired') return false;

    const respondent = session.respondents.find(r => r.respondentId === respondentId);
    if (!respondent || respondent.status === 'submitted') return false;

    const existing = respondent.answers.findIndex(a => a.cardId === answer.cardId);
    if (existing >= 0) {
      respondent.answers[existing] = answer;
    } else {
      respondent.answers.push(answer);
    }

    this.touch(guid);
    return true;
  }

  submitRespondent(guid: string, respondentId: string, globalComment?: string): boolean {
    const session = this.sessions.get(guid);
    if (!session || session.status === 'closed' || session.status === 'expired') return false;

    const respondent = session.respondents.find(r => r.respondentId === respondentId);
    if (!respondent || respondent.status === 'submitted') return false;

    respondent.status = 'submitted';
    respondent.submittedAt = new Date().toISOString();
    respondent.globalComment = globalComment;
    this.touch(guid);
    return true;
  }

  updateCards(agentId: string, guid: string, cards: Card[]): boolean {
    const session = this.sessions.get(guid);
    if (!session || session.agentId !== agentId) return false;
    if (session.status === 'closed' || session.status === 'expired') return false;

    const newCardIds = new Set(cards.map(c => c.id));
    for (const respondent of session.respondents) {
      respondent.answers = respondent.answers.filter(a => newCardIds.has(a.cardId));
    }
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
        respondents: session.respondents.map(r => ({
          name: r.name,
          answers: r.answers,
          globalComment: r.globalComment,
          submittedAt: r.submittedAt,
        })),
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

Key changes from previous store.ts:
- `createSession` now initializes `respondents: []` instead of `answers: []`
- **New method:** `joinSession(guid, name)` — creates a `Respondent` or returns existing one with matching name
- `submitAnswer(guid, respondentId, answer)` — now takes `respondentId`, finds the respondent, stores answer on them
- `submitSession` renamed to `submitRespondent(guid, respondentId, globalComment)` — marks one respondent as submitted
- `updateCards` — filters answers on each respondent (not on session-level `answers`)
- `closeSessions` — returns `respondents[]` per session instead of flat `finalAnswers`/`globalComment`/`submittedAt`

**Step 2: Verify types compile**

Run: `cd questionpad-server && npx tsc --noEmit 2>&1 | head -20`
Expected: Errors only in mcp.ts, server.ts, and test files (not types.ts or store.ts)

**Step 3: Commit**

```bash
git add questionpad-server/src/store.ts
git commit -m "refactor(store): respondent-based operations with join, per-respondent answers"
```

---

### Task 3: Rewrite store.test.ts

**Files:**
- Modify: `questionpad-server/src/store.test.ts`

**Step 1: Rewrite store.test.ts**

Replace the contents of `questionpad-server/src/store.test.ts` with:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from './store.js';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(60);
  });

  // --- createSession ---

  it('creates sessions for multiple participants', () => {
    const result = store.createSession({
      title: 'Review',
      participants: [
        { label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Name?' }] },
        { label: 'Tech', cards: [{ id: 'q1', type: 'yes-no', title: 'OK?' }] },
      ],
    });
    expect(result.agentId).toBeTruthy();
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].label).toBe('Sales');
    expect(result.sessions[1].label).toBe('Tech');
    expect(result.sessions[0].guid).not.toBe(result.sessions[1].guid);
  });

  it('creates a single-participant session', () => {
    const result = store.createSession({
      title: 'Solo',
      participants: [{ label: 'Solo', cards: [] }],
    });
    expect(result.sessions).toHaveLength(1);
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

  it('initializes session with empty respondents', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [] }],
    });
    const session = store.getSessionPublic(result.sessions[0].guid);
    expect(session?.respondents).toEqual([]);
    expect(session?.status).toBe('created');
  });

  // --- joinSession ---

  it('creates a respondent when joining', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Team', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice');
    expect(join).not.toBeNull();
    expect(join!.respondentId).toBeTruthy();
    expect(join!.answers).toEqual([]);

    const session = store.getSessionPublic(guid);
    expect(session?.respondents).toHaveLength(1);
    expect(session?.respondents[0].name).toBe('Alice');
    expect(session?.status).toBe('in_progress');
  });

  it('returns existing respondent when same name joins again', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Team', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const first = store.joinSession(guid, 'Alice')!;

    // Alice answers a question
    store.submitAnswer(guid, first.respondentId, { cardId: 'q1', value: 'hello' });

    // Alice joins again (e.g. page refresh with same name)
    const second = store.joinSession(guid, 'Alice')!;
    expect(second.respondentId).toBe(first.respondentId);
    expect(second.answers).toHaveLength(1);
    expect(second.answers[0].value).toBe('hello');
  });

  it('allows multiple people to join the same session', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Team', cards: [] }],
    });
    const guid = result.sessions[0].guid;
    store.joinSession(guid, 'Alice');
    store.joinSession(guid, 'Bob');
    store.joinSession(guid, 'Carol');

    const session = store.getSessionPublic(guid);
    expect(session?.respondents).toHaveLength(3);
    expect(session?.respondents.map(r => r.name)).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('rejects join on closed session', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [] }],
    });
    const guid = result.sessions[0].guid;
    store.closeSessions(result.agentId);
    expect(store.joinSession(guid, 'Alice')).toBeNull();
  });

  it('rejects join on nonexistent session', () => {
    expect(store.joinSession('nonexistent', 'Alice')).toBeNull();
  });

  // --- getSessions ---

  it('returns all sessions for an agent', () => {
    const result = store.createSession({
      title: 'Test',
      participants: [
        { label: 'A', cards: [] },
        { label: 'B', cards: [] },
      ],
    });
    const sessions = store.getSessions(result.agentId);
    expect(sessions).toHaveLength(2);
  });

  it('returns filtered sessions by guids', () => {
    const result = store.createSession({
      title: 'Test',
      participants: [
        { label: 'A', cards: [] },
        { label: 'B', cards: [] },
      ],
    });
    const sessions = store.getSessions(result.agentId, [result.sessions[0].guid]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].label).toBe('A');
  });

  it('returns empty array for unknown agent', () => {
    expect(store.getSessions('unknown-agent')).toEqual([]);
  });

  it('ignores guids belonging to other agents', () => {
    const agent1 = store.createSession({
      title: 'A1',
      participants: [{ label: 'X', cards: [] }],
    });
    const agent2 = store.createSession({
      title: 'A2',
      participants: [{ label: 'Y', cards: [] }],
    });
    const sessions = store.getSessions(agent1.agentId, [agent2.sessions[0].guid]);
    expect(sessions).toEqual([]);
  });

  // --- getSessionPublic ---

  it('returns session without agentId check', () => {
    const result = store.createSession({
      title: 'Test',
      participants: [{ label: 'Public', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const session = store.getSessionPublic(result.sessions[0].guid);
    expect(session).not.toBeNull();
    expect(session!.label).toBe('Public');
  });

  it('returns null for unknown guid', () => {
    expect(store.getSessionPublic('nonexistent')).toBeNull();
  });

  // --- submitAnswer ---

  it('records answer on the correct respondent', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Team', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'hello' });

    const session = store.getSessionPublic(guid);
    expect(session?.respondents[0].answers).toHaveLength(1);
    expect(session?.respondents[0].answers[0].value).toBe('hello');
  });

  it('updates an existing answer on a respondent', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'first' });
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'second' });

    const session = store.getSessionPublic(guid);
    expect(session?.respondents[0].answers).toHaveLength(1);
    expect(session?.respondents[0].answers[0].value).toBe('second');
  });

  it('isolates answers between respondents', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Team', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const alice = store.joinSession(guid, 'Alice')!;
    const bob = store.joinSession(guid, 'Bob')!;
    store.submitAnswer(guid, alice.respondentId, { cardId: 'q1', value: 'alice-answer' });
    store.submitAnswer(guid, bob.respondentId, { cardId: 'q1', value: 'bob-answer' });

    const session = store.getSessionPublic(guid);
    expect(session?.respondents).toHaveLength(2);
    expect(session?.respondents[0].answers[0].value).toBe('alice-answer');
    expect(session?.respondents[1].answers[0].value).toBe('bob-answer');
  });

  it('rejects answer on closed session', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.closeSessions(result.agentId);
    expect(store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'nope' })).toBe(false);
  });

  it('rejects answer with unknown respondentId', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    expect(store.submitAnswer(guid, 'fake-id', { cardId: 'q1', value: 'nope' })).toBe(false);
  });

  it('rejects answer on submitted respondent', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'hi' });
    store.submitRespondent(guid, join.respondentId);
    expect(store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'change' })).toBe(false);
  });

  // --- submitRespondent ---

  it('marks respondent as submitted with global comment', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'hi' });
    store.submitRespondent(guid, join.respondentId, 'Great form');

    const session = store.getSessionPublic(guid);
    const respondent = session?.respondents[0];
    expect(respondent?.status).toBe('submitted');
    expect(respondent?.submittedAt).toBeTruthy();
    expect(respondent?.globalComment).toBe('Great form');
  });

  it('rejects submit on unknown respondent', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [] }],
    });
    const guid = result.sessions[0].guid;
    expect(store.submitRespondent(guid, 'fake-id')).toBe(false);
  });

  // --- updateCards ---

  it('updates cards and increments cardVersion', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    store.updateCards(result.agentId, guid, [{ id: 'q2', type: 'yes-no', title: 'New Q' }]);
    const session = store.getSessionPublic(guid);
    expect(session?.cards).toHaveLength(1);
    expect(session?.cards[0].id).toBe('q2');
    expect(session?.cardVersion).toBe(1);
  });

  it('preserves respondent answers for cards that still exist after update', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{
        label: 'A',
        cards: [
          { id: 'q1', type: 'free-text', title: 'Q1' },
          { id: 'q2', type: 'yes-no', title: 'Q2' },
        ],
      }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'keep me' });
    store.submitAnswer(guid, join.respondentId, { cardId: 'q2', value: true });
    store.updateCards(result.agentId, guid, [
      { id: 'q1', type: 'free-text', title: 'Q1 updated' },
      { id: 'q3', type: 'rating', title: 'New Q' },
    ]);
    const session = store.getSessionPublic(guid);
    const respondent = session?.respondents[0];
    expect(respondent?.answers).toHaveLength(1);
    expect(respondent?.answers[0].cardId).toBe('q1');
    expect(respondent?.answers[0].value).toBe('keep me');
  });

  it('rejects updateCards with wrong agentId', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    expect(store.updateCards('wrong-agent', guid, [])).toBe(false);
  });

  // --- closeSessions ---

  it('closes all sessions and returns respondents', () => {
    const result = store.createSession({
      title: 'Test',
      participants: [
        { label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] },
        { label: 'Tech', cards: [] },
      ],
    });
    const salesGuid = result.sessions[0].guid;
    const alice = store.joinSession(salesGuid, 'Alice')!;
    store.submitAnswer(salesGuid, alice.respondentId, { cardId: 'q1', value: 'great' });
    store.submitRespondent(salesGuid, alice.respondentId, 'Overall good');

    const closed = store.closeSessions(result.agentId);
    expect(closed).toHaveLength(2);

    const salesClosed = closed.find(c => c.label === 'Sales')!;
    expect(salesClosed.respondents).toHaveLength(1);
    expect(salesClosed.respondents[0].name).toBe('Alice');
    expect(salesClosed.respondents[0].answers[0].value).toBe('great');
    expect(salesClosed.respondents[0].globalComment).toBe('Overall good');

    const techClosed = closed.find(c => c.label === 'Tech')!;
    expect(techClosed.respondents).toEqual([]);
  });

  it('closes a subset of sessions', () => {
    const result = store.createSession({
      title: 'Test',
      participants: [
        { label: 'A', cards: [] },
        { label: 'B', cards: [] },
        { label: 'C', cards: [] },
      ],
    });
    const closed = store.closeSessions(result.agentId, [result.sessions[0].guid, result.sessions[2].guid]);
    expect(closed).toHaveLength(2);
    expect(closed.map(c => c.label).sort()).toEqual(['A', 'C']);

    const bSession = store.getSessionPublic(result.sessions[1].guid);
    expect(bSession?.status).toBe('created');
  });

  it('returns empty array for unknown agent', () => {
    expect(store.closeSessions('unknown-agent')).toEqual([]);
  });

  it('ignores guids belonging to other agents', () => {
    const agent1 = store.createSession({
      title: 'A1',
      participants: [{ label: 'X', cards: [] }],
    });
    const agent2 = store.createSession({
      title: 'A2',
      participants: [{ label: 'Y', cards: [] }],
    });
    const closed = store.closeSessions(agent1.agentId, [agent2.sessions[0].guid]);
    expect(closed).toEqual([]);
  });

  // --- purgeExpired ---

  it('expires sessions past TTL', () => {
    const shortStore = new SessionStore(0);
    const result = shortStore.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [] }],
    });
    shortStore.purgeExpired();
    expect(shortStore.getSessionPublic(result.sessions[0].guid)).toBeNull();
  });
});
```

**Step 2: Run the tests**

Run: `cd questionpad-server && npx vitest run src/store.test.ts 2>&1 | tail -20`
Expected: All tests pass (compilation errors in other files are OK — we haven't updated them yet)

**Step 3: Commit**

```bash
git add questionpad-server/src/store.test.ts
git commit -m "test(store): rewrite tests for respondent-based operations"
```

---

### Task 4: Update mcp.ts — Respondent-aware tool responses

**Files:**
- Modify: `questionpad-server/src/mcp.ts`

**Step 1: Update mcp.ts**

Changes needed:

1. Update server description to mention shared sessions
2. Update `ParticipantSchema` label description to clarify it can represent a group
3. Update `get_sessions` handler to return `respondents[]` instead of flat `answers`/`globalComment`/`submittedAt`
4. Update `get_sessions` description to explain respondents
5. Update `close_sessions` handler — response already comes from store in the right shape
6. Update `close_sessions` description to mention respondents
7. Bump version to `0.3.0`

In `mcp.ts`, make these specific changes:

**a)** Change version to `0.3.0`:
```typescript
version: '0.3.0',
```

**b)** Update server description — replace the Workflow section:
```typescript
description:
  'Collect structured feedback from humans via interactive web forms. ' +
  'Use QuestionPad when you need to ask people questions and get their answers — ' +
  'for example, gathering meeting feedback, running polls, or collecting approvals.\n\n' +
  'Workflow:\n' +
  '1. Call create_session with a title and one or more participants, each with their own question cards.\n' +
  '2. Share the returned URL(s) with participants — multiple people can open the same URL.\n' +
  '3. Each person enters their name and fills in the form independently.\n' +
  '4. Poll with get_sessions to check respondents and their answers.\n' +
  '5. When done, call close_sessions to lock the sessions and retrieve final answers.\n\n' +
  'The agentId returned by create_session is your ownership token — save it and pass it to all subsequent calls. ' +
  'It ensures your sessions are isolated from other agents using the same server.',
```

**c)** Update `ParticipantSchema` label description:
```typescript
label: z.string().describe(
  'Label for this participant group (e.g. "Sales Team", "Engineers", "Alice"). ' +
  'Multiple people can open the same session URL — each enters their name on arrival. ' +
  'The label is shown in the browser UI and returned with responses.'
),
```

**d)** Update `get_sessions` handler — replace the `sessions.map` with:
```typescript
const result = sessions.map(s => ({
  guid: s.guid,
  label: s.label,
  title: s.title,
  status: s.status,
  cards: s.cards,
  respondents: s.respondents.map(r => ({
    name: r.name,
    status: r.status,
    answers: r.answers,
    globalComment: r.globalComment,
    submittedAt: r.submittedAt,
  })),
}));
```

**e)** Update `get_sessions` description:
```typescript
description:
  'Poll for responses. Returns the current status and respondents for your sessions.\n\n' +
  'Pass guids to check specific sessions, or omit to get all sessions for your agentId.\n\n' +
  'Session status lifecycle: "created" → "in_progress" (someone joined) → "closed" (you called close_sessions) or "expired" (timed out).\n\n' +
  'Each session contains a respondents array. Each respondent has a name, status ("in_progress" or "submitted"), ' +
  'answers (cardId + value + optional comment), and an optional globalComment.',
```

**f)** Update `close_sessions` description:
```typescript
description:
  'Close sessions and retrieve the final answers. Closed sessions are locked — ' +
  'participants can no longer submit or change answers, and the form shows a "Session Ended" message.\n\n' +
  'Pass guids to close specific sessions, or omit to close all sessions for your agentId. ' +
  'Returns each closed session with its label and a respondents array containing each person\'s name, answers, and globalComment.',
```

**Step 2: Verify compilation**

Run: `cd questionpad-server && npx tsc --noEmit 2>&1 | head -20`
Expected: Errors only in server.ts and integration.test.ts (not mcp.ts)

**Step 3: Commit**

```bash
git add questionpad-server/src/mcp.ts
git commit -m "feat(mcp): update tool responses for respondent-based model"
```

---

### Task 5: Update server.ts — Add /join endpoint, update /answers and /submit

**Files:**
- Modify: `questionpad-server/src/server.ts`

**Step 1: Update server.ts**

Make these changes:

**a)** Update `GET /api/sessions/:guid` — remove `answers` from response (answers are now per-respondent, returned via join):
```typescript
app.get('/api/sessions/:guid', (req, res) => {
  const session = store.getSessionPublic(req.params.guid);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({
    label: session.label,
    title: session.title,
    description: session.description,
    cards: session.cards,
    status: session.status,
    cardVersion: session.cardVersion,
  });
});
```

**b)** Add new `POST /api/sessions/:guid/join` endpoint (add this BEFORE the `/answers` route):
```typescript
// POST /api/sessions/:guid/join — join a session as a respondent
app.post('/api/sessions/:guid/join', (req, res) => {
  const { name } = req.body as { name: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const result = store.joinSession(req.params.guid, name.trim());
  if (!result) {
    res.status(404).json({ error: 'Session not found or already closed' });
    return;
  }
  res.json(result);
});
```

**c)** Update `POST /api/sessions/:guid/answers` — add `respondentId`:
```typescript
app.post('/api/sessions/:guid/answers', (req, res) => {
  const { respondentId, cardId, value, comment } = req.body as {
    respondentId: string;
    cardId: string;
    value: unknown;
    comment?: string;
  };
  const ok = store.submitAnswer(req.params.guid, respondentId, { cardId, value, comment });
  if (!ok) {
    res.status(404).json({ error: 'Session/respondent not found or already closed' });
    return;
  }
  res.json({ success: true });
});
```

**d)** Update `POST /api/sessions/:guid/submit` — add `respondentId`, call `submitRespondent`:
```typescript
app.post('/api/sessions/:guid/submit', (req, res) => {
  const { respondentId, globalComment } = req.body as { respondentId: string; globalComment?: string };
  const ok = store.submitRespondent(req.params.guid, respondentId, globalComment);
  if (!ok) {
    res.status(404).json({ error: 'Session/respondent not found or already closed' });
    return;
  }
  res.json({ success: true });
});
```

**Step 2: Verify compilation**

Run: `cd questionpad-server && npx tsc --noEmit 2>&1 | head -20`
Expected: Errors only in integration.test.ts (we fix that next)

**Step 3: Commit**

```bash
git add questionpad-server/src/server.ts
git commit -m "feat(server): add /join endpoint, update /answers and /submit for respondentId"
```

---

### Task 6: Rewrite integration.test.ts

**Files:**
- Modify: `questionpad-server/src/integration.test.ts`

**Step 1: Rewrite integration.test.ts**

Replace the contents with:

```typescript
import { describe, it, expect } from 'vitest';
import { SessionStore } from './store.js';

describe('Full flow integration', () => {
  it('shared session: multiple people join, answer, submit, agent polls and closes', () => {
    const store = new SessionStore(60);

    // Agent creates session with Sales and Tech groups
    const batch = store.createSession({
      title: 'Sprint Review',
      participants: [
        {
          label: 'Sales',
          cards: [
            { id: 'q1', type: 'rating', title: 'Rate the sprint', min: 1, max: 5 },
            { id: 'q2', type: 'free-text', title: 'Comments?' },
          ],
        },
        {
          label: 'Tech',
          cards: [
            { id: 'q1', type: 'approve-reject', title: 'Approve the release?' },
          ],
        },
      ],
    });

    expect(batch.sessions).toHaveLength(2);
    const salesGuid = batch.sessions[0].guid;
    const techGuid = batch.sessions[1].guid;

    // Cross-agent isolation
    const other = store.createSession({
      title: "Other Agent's Session",
      participants: [{ label: 'Other', cards: [] }],
    });
    expect(store.getSessions(batch.agentId, [other.sessions[0].guid])).toEqual([]);

    // 3 sales people join
    const alice = store.joinSession(salesGuid, 'Alice')!;
    const bob = store.joinSession(salesGuid, 'Bob')!;
    const carol = store.joinSession(salesGuid, 'Carol')!;

    // 1 tech person joins
    const dave = store.joinSession(techGuid, 'Dave')!;

    // Agent polls — sees 3 respondents on Sales, 1 on Tech
    const polled = store.getSessions(batch.agentId);
    const salesSession = polled.find(s => s.label === 'Sales')!;
    expect(salesSession.respondents).toHaveLength(3);
    expect(salesSession.status).toBe('in_progress');

    // Alice answers and submits
    store.submitAnswer(salesGuid, alice.respondentId, { cardId: 'q1', value: { rating: 5 } });
    store.submitAnswer(salesGuid, alice.respondentId, { cardId: 'q2', value: { text: 'Great!' } });
    store.submitRespondent(salesGuid, alice.respondentId, 'Loved it');

    // Bob only answers q1 (doesn't submit)
    store.submitAnswer(salesGuid, bob.respondentId, { cardId: 'q1', value: { rating: 3 } });

    // Carol hasn't done anything yet

    // Agent polls again — Alice submitted, Bob in_progress, Carol in_progress
    const polled2 = store.getSessions(batch.agentId, [salesGuid]);
    const respondents = polled2[0].respondents;
    expect(respondents.find(r => r.name === 'Alice')!.status).toBe('submitted');
    expect(respondents.find(r => r.name === 'Bob')!.status).toBe('in_progress');
    expect(respondents.find(r => r.name === 'Carol')!.status).toBe('in_progress');

    // Dave approves and submits
    store.submitAnswer(techGuid, dave.respondentId, { cardId: 'q1', value: { status: 'approved' } });
    store.submitRespondent(techGuid, dave.respondentId);

    // Agent updates Sales cards (adds follow-up)
    store.updateCards(batch.agentId, salesGuid, [
      { id: 'q1', type: 'rating', title: 'Rate the sprint', min: 1, max: 5 },
      { id: 'q2', type: 'free-text', title: 'Comments?' },
      { id: 'q3', type: 'yes-no', title: 'Attend next sprint review?' },
    ]);

    // Alice's answers preserved (she already submitted, but card data stays)
    const afterUpdate = store.getSessions(batch.agentId, [salesGuid]);
    expect(afterUpdate[0].cards).toHaveLength(3);
    expect(afterUpdate[0].respondents.find(r => r.name === 'Alice')!.answers).toHaveLength(2);
    expect(afterUpdate[0].respondents.find(r => r.name === 'Bob')!.answers).toHaveLength(1);

    // Agent closes all sessions
    const closed = store.closeSessions(batch.agentId);
    expect(closed).toHaveLength(2);

    const salesClosed = closed.find(c => c.label === 'Sales')!;
    expect(salesClosed.respondents).toHaveLength(3);
    expect(salesClosed.respondents.find(r => r.name === 'Alice')!.globalComment).toBe('Loved it');

    const techClosed = closed.find(c => c.label === 'Tech')!;
    expect(techClosed.respondents).toHaveLength(1);
    expect(techClosed.respondents[0].name).toBe('Dave');
  });

  it('resubmit: same name returns existing respondent with answers', () => {
    const store = new SessionStore(60);
    const batch = store.createSession({
      title: 'Test',
      participants: [
        { label: 'Team', cards: [{ id: 'q1', type: 'free-text', title: 'Feedback?' }] },
      ],
    });
    const guid = batch.sessions[0].guid;

    // Alice joins and answers
    const first = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, first.respondentId, { cardId: 'q1', value: { text: 'good' } });

    // Alice "rejoins" (page refresh) — gets same respondent with answers
    const second = store.joinSession(guid, 'Alice')!;
    expect(second.respondentId).toBe(first.respondentId);
    expect(second.answers).toHaveLength(1);

    // Only one respondent in the session
    const session = store.getSessionPublic(guid);
    expect(session?.respondents).toHaveLength(1);
  });
});
```

**Step 2: Run all tests**

Run: `cd questionpad-server && npx tsc && npx vitest run 2>&1 | tail -15`
Expected: All tests pass, compilation succeeds

**Step 3: Commit**

```bash
git add questionpad-server/src/integration.test.ts
git commit -m "test(integration): rewrite for shared sessions with respondents"
```

---

### Task 7: Update app.html — Name prompt, respondentId in API calls

**Files:**
- Modify: `questionpad-server/public/app.html`

This is the largest task. The browser app needs these changes:

**a) Add name prompt UI**

Add HTML for a join screen (shown before the form). Place it right after `<div id="app-waiting">`:

```html
<div id="app-join" style="display:none;">
  <div class="join-screen">
    <h1 id="join-title"></h1>
    <div id="join-description" class="session-description"></div>
    <div class="join-form">
      <label for="join-name">Enter your name to join</label>
      <input type="text" id="join-name" placeholder="Your name..." autofocus>
      <button id="join-btn" class="btn-submit">Join</button>
    </div>
  </div>
</div>
```

**b) Add CSS for join screen**

```css
.join-screen {
  max-width: 500px;
  margin: 80px auto;
  padding: 0 20px;
  text-align: center;
}
.join-screen h1 {
  font-size: 1.5rem;
  margin-bottom: 16px;
}
.join-screen .session-description {
  text-align: left;
  margin-bottom: 24px;
}
.join-form {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 24px;
}
.join-form label {
  display: block;
  color: var(--muted);
  margin-bottom: 12px;
  font-size: 0.9rem;
}
.join-form input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 1rem;
  margin-bottom: 12px;
}
.join-form input:focus {
  outline: none;
  border-color: var(--progress);
}
```

**c) Add respondentId to module-level state**

At the top of the script, alongside other module-level state:
```javascript
var currentRespondentId = null;  // set after joining
```

**d) Add localStorage helpers for respondent persistence**

```javascript
function saveRespondent(guid, respondentId, name) {
  try {
    localStorage.setItem('questionpad-respondent-' + guid, JSON.stringify({ respondentId: respondentId, name: name }));
  } catch(e) {}
}

function loadRespondent(guid) {
  try {
    var data = JSON.parse(localStorage.getItem('questionpad-respondent-' + guid) || 'null');
    return data;
  } catch(e) { return null; }
}

function clearRespondent(guid) {
  try { localStorage.removeItem('questionpad-respondent-' + guid); } catch(e) {}
}
```

**e) Add join flow**

```javascript
async function joinSession(guid, name) {
  var res = await fetch('/api/sessions/' + guid + '/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function showJoinScreen(guid) {
  var data = await fetchSessionData(guid);
  if (!data) {
    showToast('Session not found');
    return;
  }
  if (data.status === 'closed' || data.status === 'expired') {
    showSessionEnded();
    return;
  }

  document.getElementById('app-waiting').style.display = 'none';
  document.getElementById('app-join').style.display = '';
  document.getElementById('join-title').textContent = data.title || 'Feedback Request';

  var descEl = document.getElementById('join-description');
  if (data.description) {
    var mdBlock = document.createElement('div');
    mdBlock.className = 'md-block';
    mdBlock.innerHTML = renderMarkdown(data.description);
    descEl.innerHTML = '';
    descEl.appendChild(mdBlock);
    descEl.style.display = '';
  } else {
    descEl.style.display = 'none';
  }

  document.getElementById('join-btn').onclick = async function() {
    var name = document.getElementById('join-name').value.trim();
    if (!name) return;
    var result = await joinSession(guid, name);
    if (!result) {
      showToast('Could not join session');
      return;
    }
    currentRespondentId = result.respondentId;
    saveRespondent(guid, result.respondentId, name);

    document.getElementById('app-join').style.display = 'none';
    // Now add this session to the hub and proceed
    await addSessionAfterJoin(guid, result);
  };

  // Enter key submits
  document.getElementById('join-name').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('join-btn').click();
  });
}
```

**f) Modify `addSession()` to handle respondent**

The existing `addSession()` needs to be split. When adding a session from a URL (pathGuid) or the hub input, we first need to check if we have a saved respondent. If not, show the join screen. If yes, proceed directly.

Rename the current `addSession` to `addSessionAfterJoin(guid, joinResult)` which takes the join result (respondentId + answers) and builds the hub session state from it. The new flow:

1. `addSession(guid)` — checks localStorage for saved respondent. If found, validates by calling join API with saved name. If valid, calls `addSessionAfterJoin`. If not, shows join screen.
2. `addSessionAfterJoin(guid, joinResult)` — the actual hub session state creation (most of the current `addSession` code).

The `addSessionAfterJoin` function:
```javascript
async function addSessionAfterJoin(guid, joinResult) {
  if (hubSessions[guid]) {
    // Already added (e.g. switching back after join)
    switchTab(guid);
    return true;
  }
  var data = await fetchSessionData(guid);
  if (!data) {
    showToast('Session not found');
    return false;
  }

  var sessionState = {
    guid: guid,
    requestData: { title: data.title, description: data.description, cards: data.cards, label: data.label },
    respondentId: joinResult.respondentId,
    answers: {},
    comments: {},
    statuses: {},
    submitted: false,
    currentCardVersion: data.cardVersion,
    activeCardId: null,
    hasUpdate: false,
    pollInterval: null,
  };

  // Restore answers from join result
  (joinResult.answers || []).forEach(function(a) {
    sessionState.answers[a.cardId] = a.value;
    if (a.comment) sessionState.comments[a.cardId] = a.comment;
    sessionState.statuses[a.cardId] = 'answered';
  });
  // Initialize unanswered statuses
  data.cards.forEach(function(card) {
    if (!sessionState.statuses[card.id]) {
      sessionState.statuses[card.id] = 'unanswered';
      sessionState.comments[card.id] = '';
    }
  });

  hubSessions[guid] = sessionState;
  saveGuids();
  renderTabs();
  startPolling(guid);
  switchTab(guid);
  return true;
}
```

The new `addSession`:
```javascript
async function addSession(guid) {
  if (hubSessions[guid]) {
    showToast('Session already added');
    return false;
  }

  // Check for saved respondent
  var saved = loadRespondent(guid);
  if (saved) {
    // Validate by re-joining with the same name
    var result = await joinSession(guid, saved.name);
    if (result) {
      currentRespondentId = result.respondentId;
      return addSessionAfterJoin(guid, result);
    }
    // Saved respondent invalid — clear and show join screen
    clearRespondent(guid);
  }

  // No saved respondent — show join screen
  showJoinScreen(guid);
  return false;
}
```

**g) Update `sendAnswer` to include respondentId**

```javascript
function sendAnswer(guid, cardId, value, comment) {
  var session = hubSessions[guid];
  var respondentId = session ? session.respondentId : currentRespondentId;
  fetch('/api/sessions/' + guid + '/answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respondentId: respondentId, cardId: cardId, value: value, comment: comment || '' }),
  });
}
```

**h) Update `doSubmit` to include respondentId**

In the `doSubmit` function, change the fetch body to include `respondentId`:
```javascript
await fetch('/api/sessions/' + activeGuid + '/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    respondentId: hubSessions[activeGuid].respondentId,
    globalComment: document.getElementById('global-comment').value || '',
  }),
});
```

**i) Update `switchTab` to set `currentRespondentId`**

In `switchTab`, after restoring session state, set:
```javascript
currentRespondentId = s.respondentId;
```

**j) Update participant label display**

In `switchTab`, update the label logic — show the respondent's name instead of just the label:
```javascript
var labelEl = document.getElementById('participant-label');
var saved = loadRespondent(guid);
var displayParts = [];
if (s.requestData.label) displayParts.push(s.requestData.label);
if (saved && saved.name) displayParts.push(saved.name);
if (displayParts.length > 0) {
  labelEl.textContent = displayParts.join(' — ');
  labelEl.style.display = '';
} else {
  labelEl.style.display = 'none';
}
```

**k) Update `init()` function**

The init function at the bottom of the script needs to handle the join flow. Change the pathGuid handling:

```javascript
// In init, replace the direct addSession(pathGuid) with:
if (pathGuid) {
  addSession(pathGuid);
}
```

This should already work since `addSession` now handles the join flow. But also update the `loadGuids()` restoration loop — each saved GUID needs its respondent checked:

```javascript
var saved = loadGuids();
for (var i = 0; i < saved.length; i++) {
  var guid = saved[i];
  if (guid === pathGuid) continue; // Already handled above
  var respondent = loadRespondent(guid);
  if (respondent) {
    var result = await joinSession(guid, respondent.name);
    if (result) {
      await addSessionAfterJoin(guid, result);
    } else {
      clearRespondent(guid);
    }
  }
}
```

**l) Remove old `data.answers` references in addSession**

The old `addSession` reads `data.answers` and `data.status === 'submitted'` from the `GET /api/sessions/:guid` response. Since answers are no longer returned there (they come from the join endpoint), and `'submitted'` is no longer a session status, these need to be removed. The new `addSessionAfterJoin` handles this correctly by reading from `joinResult.answers`.

**Step 2: Verify manually**

Run: `cd questionpad-server && PORT=3456 npx tsx src/server.ts`

Then create a test session with curl and open the URL in a browser. You should see:
1. The join screen with title, description, and name input
2. After entering a name, the form appears
3. Refreshing the page skips the join screen (localStorage)
4. Opening the same URL in an incognito window shows the join screen again

**Step 3: Commit**

```bash
git add questionpad-server/public/app.html
git commit -m "feat(ui): add name prompt join screen, respondentId in all API calls"
```

---

### Task 8: Update README.md

**Files:**
- Modify: `questionpad-server/README.md`

**Step 1: Update the README**

Key changes:
- Update the workflow description to mention that multiple people can open the same URL
- Update the `get_sessions` response example to show `respondents[]` instead of flat answers
- Update the `close_sessions` response example
- Update the Card Types table note about `globalComment` being per-respondent
- Add a "Shared Sessions" section explaining the join flow
- Remove any references to `answers` and `globalComment` at session level

**Step 2: Commit**

```bash
git add questionpad-server/README.md
git commit -m "docs: update README for shared sessions with respondents"
```

---

### Task 9: Smoke test the full flow

**Step 1: Start the server**

```bash
cd questionpad-server && PORT=3456 npx tsx src/server.ts
```

**Step 2: Create a shared session**

```bash
curl -s http://localhost:3456/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_session",
      "arguments": {
        "title": "Sprint Retrospective",
        "description": "## Sprint 42\n\nPlease share your feedback on how the sprint went.",
        "participants": [
          {
            "label": "Sales Team",
            "cards": [
              { "id": "q1", "type": "rating", "title": "Rate the sprint", "min": 1, "max": 5 },
              { "id": "q2", "type": "free-text", "title": "What should we improve?" }
            ]
          }
        ]
      }
    }
  }'
```

**Step 3: Test in browser**

1. Open the Sales Team URL — should see join screen
2. Enter "Alice" — should see the form
3. Open the same URL in incognito — should see join screen again
4. Enter "Bob" — should see the same form (empty, fresh for Bob)
5. Fill in and submit as Alice
6. Refresh Alice's page — should skip join, show submitted form (grayed out)
7. Fill in and submit as Bob

**Step 4: Verify agent sees both respondents**

```bash
curl -s http://localhost:3456/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0", "id": 2,
    "method": "tools/call",
    "params": {
      "name": "get_sessions",
      "arguments": { "agentId": "<agentId from step 2>" }
    }
  }'
```

Expected: Response shows `respondents: [{ name: "Alice", status: "submitted", ... }, { name: "Bob", status: "submitted", ... }]`

**Step 5: Close and verify**

Close the session and verify final results include both respondents.

Plan complete and saved to `docs/plans/2026-03-03-questionpad-shared-sessions-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**