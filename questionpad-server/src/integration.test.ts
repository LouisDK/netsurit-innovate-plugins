import { describe, it, expect } from 'vitest';
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
