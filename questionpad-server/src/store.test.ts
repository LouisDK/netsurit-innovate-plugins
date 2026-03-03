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

  it('initializes sessions with empty respondents', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'A', cards: [] }],
    });
    const session = store.getSessionPublic(result.sessions[0].guid);
    expect(session?.respondents).toEqual([]);
  });

  // --- joinSession ---

  it('creates a respondent on join', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice');
    expect(join).not.toBeNull();
    expect(join!.respondentId).toBeTruthy();
    expect(join!.answers).toEqual([]);
  });

  it('returns existing respondent on same name (with answers)', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const first = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, first.respondentId, { cardId: 'q1', value: 'hello' });
    const second = store.joinSession(guid, 'Alice')!;
    expect(second.respondentId).toBe(first.respondentId);
    expect(second.answers).toHaveLength(1);
    expect(second.answers[0].value).toBe('hello');
  });

  it('allows multiple people to join the same session', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [] }],
    });
    const guid = result.sessions[0].guid;
    const alice = store.joinSession(guid, 'Alice')!;
    const bob = store.joinSession(guid, 'Bob')!;
    expect(alice.respondentId).not.toBe(bob.respondentId);
    const session = store.getSessionPublic(guid)!;
    expect(session.respondents).toHaveLength(2);
  });

  it('rejects join on closed session', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [] }],
    });
    const guid = result.sessions[0].guid;
    store.closeSessions(result.agentId);
    expect(store.joinSession(guid, 'Alice')).toBeNull();
  });

  it('rejects join on nonexistent guid', () => {
    expect(store.joinSession('nonexistent', 'Alice')).toBeNull();
  });

  it('transitions session from created to in_progress on first join', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [] }],
    });
    const guid = result.sessions[0].guid;
    expect(store.getSessionPublic(guid)!.status).toBe('created');
    store.joinSession(guid, 'Alice');
    expect(store.getSessionPublic(guid)!.status).toBe('in_progress');
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

  it('ignores guids belonging to other agents (cross-agent isolation)', () => {
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

  it('records answer on correct respondent', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    const ok = store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'hello' });
    expect(ok).toBe(true);
    const session = store.getSessionPublic(guid)!;
    const respondent = session.respondents.find(r => r.respondentId === join.respondentId)!;
    expect(respondent.answers).toHaveLength(1);
    expect(respondent.answers[0].value).toBe('hello');
  });

  it('updates existing answer on same cardId', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'first' });
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'second' });
    const session = store.getSessionPublic(guid)!;
    const respondent = session.respondents.find(r => r.respondentId === join.respondentId)!;
    expect(respondent.answers).toHaveLength(1);
    expect(respondent.answers[0].value).toBe('second');
  });

  it('isolates answers between respondents', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const alice = store.joinSession(guid, 'Alice')!;
    const bob = store.joinSession(guid, 'Bob')!;
    store.submitAnswer(guid, alice.respondentId, { cardId: 'q1', value: 'alice-answer' });
    store.submitAnswer(guid, bob.respondentId, { cardId: 'q1', value: 'bob-answer' });
    const session = store.getSessionPublic(guid)!;
    const aliceR = session.respondents.find(r => r.name === 'Alice')!;
    const bobR = session.respondents.find(r => r.name === 'Bob')!;
    expect(aliceR.answers[0].value).toBe('alice-answer');
    expect(bobR.answers[0].value).toBe('bob-answer');
  });

  it('rejects answer on closed session', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.closeSessions(result.agentId);
    expect(store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'nope' })).toBe(false);
  });

  it('rejects answer with unknown respondentId', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    store.joinSession(guid, 'Alice');
    expect(store.submitAnswer(guid, 'unknown-respondent', { cardId: 'q1', value: 'nope' })).toBe(false);
  });

  it('rejects answer on submitted respondent', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'hello' });
    store.submitRespondent(guid, join.respondentId);
    expect(store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'nope' })).toBe(false);
  });

  // --- submitRespondent ---

  it('marks respondent as submitted with comment', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    const join = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, join.respondentId, { cardId: 'q1', value: 'hi' });
    const ok = store.submitRespondent(guid, join.respondentId, 'Great form');
    expect(ok).toBe(true);
    const session = store.getSessionPublic(guid)!;
    const respondent = session.respondents.find(r => r.respondentId === join.respondentId)!;
    expect(respondent.status).toBe('submitted');
    expect(respondent.submittedAt).toBeTruthy();
    expect(respondent.globalComment).toBe('Great form');
  });

  it('rejects submitRespondent with unknown respondentId', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [] }],
    });
    const guid = result.sessions[0].guid;
    expect(store.submitRespondent(guid, 'unknown-respondent')).toBe(false);
  });

  // --- updateCards ---

  it('updates cards and increments cardVersion', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    store.updateCards(result.agentId, guid, [{ id: 'q2', type: 'yes-no', title: 'New Q' }]);
    const session = store.getSessionPublic(guid)!;
    expect(session.cards).toHaveLength(1);
    expect(session.cards[0].id).toBe('q2');
    expect(session.cardVersion).toBe(1);
  });

  it('preserves respondent answers for remaining cards', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{
        label: 'Sales',
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
    const session = store.getSessionPublic(guid)!;
    const respondent = session.respondents.find(r => r.respondentId === join.respondentId)!;
    expect(respondent.answers).toHaveLength(1);
    expect(respondent.answers[0].cardId).toBe('q1');
    expect(respondent.answers[0].value).toBe('keep me');
  });

  it('rejects updateCards with wrong agentId', () => {
    const result = store.createSession({
      title: 'T',
      participants: [{ label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] }],
    });
    const guid = result.sessions[0].guid;
    expect(store.updateCards('wrong-agent', guid, [])).toBe(false);
  });

  // --- closeSessions ---

  it('closes all sessions with respondents', () => {
    const result = store.createSession({
      title: 'Test',
      participants: [
        { label: 'Sales', cards: [{ id: 'q1', type: 'free-text', title: 'Q' }] },
        { label: 'Tech', cards: [] },
      ],
    });
    const salesGuid = result.sessions[0].guid;
    const alice = store.joinSession(salesGuid, 'Alice')!;
    store.submitAnswer(salesGuid, alice.respondentId, { cardId: 'q1', value: 'hi' });
    store.submitRespondent(salesGuid, alice.respondentId, 'Done');

    const closed = store.closeSessions(result.agentId);
    expect(closed).toHaveLength(2);
    const salesClosed = closed.find(c => c.label === 'Sales')!;
    expect(salesClosed.respondents).toHaveLength(1);
    expect(salesClosed.respondents[0].name).toBe('Alice');
    expect(salesClosed.respondents[0].answers).toHaveLength(1);
    expect(salesClosed.respondents[0].globalComment).toBe('Done');
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

    // B should still be open
    const bSession = store.getSessionPublic(result.sessions[1].guid);
    expect(bSession?.status).toBe('created');
  });

  it('returns empty array for unknown agent', () => {
    expect(store.closeSessions('unknown-agent')).toEqual([]);
  });

  it('ignores guids belonging to other agents (cross-agent isolation)', () => {
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
