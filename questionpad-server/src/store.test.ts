import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStore } from './store.js';

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(60); // 60 min TTL
  });

  // --- createSession ---

  it('creates sessions for multiple participants', () => {
    const result = store.createSession({
      title: 'Review',
      participants: [
        { label: 'Alice', cards: [{ id: 'q1', type: 'free-text', title: 'Name?' }] },
        { label: 'Bob', cards: [{ id: 'q1', type: 'yes-no', title: 'OK?' }] },
      ],
    });
    expect(result.agentId).toBeTruthy();
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].label).toBe('Alice');
    expect(result.sessions[1].label).toBe('Bob');
    expect(result.sessions[0].guid).not.toBe(result.sessions[1].guid);
  });

  it('creates a single-participant session (batch of 1)', () => {
    const result = store.createSession({
      title: 'Solo',
      participants: [{ label: 'Solo', cards: [] }],
    });
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].label).toBe('Solo');
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

  it('records answer and transitions status to in_progress', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    store.submitAnswer(guid, { cardId: 'q1', value: 'hello' });
    const session = store.getSessionPublic(guid);
    expect(session?.status).toBe('in_progress');
    expect(session?.answers).toHaveLength(1);
    expect(session?.answers[0].value).toBe('hello');
  });

  it('updates an existing answer', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    store.submitAnswer(guid, { cardId: 'q1', value: 'first' });
    store.submitAnswer(guid, { cardId: 'q1', value: 'second' });
    const session = store.getSessionPublic(guid);
    expect(session?.answers).toHaveLength(1);
    expect(session?.answers[0].value).toBe('second');
  });

  it('rejects answer on closed session', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    store.closeSessions(result.agentId);
    expect(store.submitAnswer(guid, { cardId: 'q1', value: 'nope' })).toBe(false);
  });

  // --- submitSession ---

  it('marks session as submitted with global comment', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    store.submitAnswer(guid, { cardId: 'q1', value: 'hi' });
    store.submitSession(guid, 'Great form');
    const session = store.getSessionPublic(guid);
    expect(session?.status).toBe('submitted');
    expect(session?.submittedAt).toBeTruthy();
    expect(session?.globalComment).toBe('Great form');
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

  it('preserves answers for cards that still exist after update', () => {
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
    store.submitAnswer(guid, { cardId: 'q1', value: 'keep me' });
    store.submitAnswer(guid, { cardId: 'q2', value: true });
    store.updateCards(result.agentId, guid, [
      { id: 'q1', type: 'free-text', title: 'Q1 updated' },
      { id: 'q3', type: 'rating', title: 'New Q' },
    ]);
    const session = store.getSessionPublic(guid);
    expect(session?.answers).toHaveLength(1);
    expect(session?.answers[0].cardId).toBe('q1');
    expect(session?.answers[0].value).toBe('keep me');
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

  it('closes all sessions when guids omitted', () => {
    const result = store.createSession({
      title: 'Test',
      participants: [
        { label: 'A', cards: [] },
        { label: 'B', cards: [] },
      ],
    });
    const closed = store.closeSessions(result.agentId);
    expect(closed).toHaveLength(2);
    expect(closed[0].label).toBe('A');
    expect(closed[1].label).toBe('B');
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

    // B should still be open
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
    const shortStore = new SessionStore(0); // 0 min TTL = immediate expiry
    const result = shortStore.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [] }],
    });
    shortStore.purgeExpired();
    expect(shortStore.getSessionPublic(result.sessions[0].guid)).toBeNull();
  });
});
