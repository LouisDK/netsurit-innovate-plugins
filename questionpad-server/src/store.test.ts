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
