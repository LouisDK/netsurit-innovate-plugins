import { describe, it, expect } from 'vitest';
import { SessionStore } from './store.js';

describe('Full flow integration', () => {
  it('shared session flow: multiple respondents join, answer, submit, agent polls and closes', () => {
    const store = new SessionStore(60);

    // Agent creates shared sessions for Sales and Tech teams
    const batch = store.createSession({
      title: 'Design Review',
      participants: [
        {
          label: 'Sales',
          cards: [
            { id: 'q1', type: 'approve-reject', title: 'Approve the design?' },
            { id: 'q2', type: 'free-text', title: 'Comments?' },
          ],
        },
        {
          label: 'Tech',
          cards: [
            { id: 'q1', type: 'rating', title: 'Rate the design', min: 1, max: 5 },
          ],
        },
      ],
    });

    expect(batch.sessions).toHaveLength(2);
    const salesGuid = batch.sessions[0].guid;
    const techGuid = batch.sessions[1].guid;

    // A different agent creates a session (should be isolated)
    const other = store.createSession({
      title: "Other Agent's Session",
      participants: [{ label: 'Other', cards: [] }],
    });

    // 3 people join the Sales session
    const alice = store.joinSession(salesGuid, 'Alice')!;
    expect(alice).not.toBeNull();
    expect(alice.respondentId).toBeTruthy();

    const bob = store.joinSession(salesGuid, 'Bob')!;
    expect(bob.respondentId).not.toBe(alice.respondentId);

    const carol = store.joinSession(salesGuid, 'Carol')!;
    expect(carol.respondentId).not.toBe(alice.respondentId);
    expect(carol.respondentId).not.toBe(bob.respondentId);

    // 1 person joins Tech
    const dave = store.joinSession(techGuid, 'Dave')!;
    expect(dave).not.toBeNull();

    // Session should be in_progress after join
    expect(store.getSessionPublic(salesGuid)!.status).toBe('in_progress');
    expect(store.getSessionPublic(techGuid)!.status).toBe('in_progress');

    // Alice answers q1
    store.submitAnswer(salesGuid, alice.respondentId, { cardId: 'q1', value: 'approved' });

    // Agent polls all sessions — should see 2, not 3
    const agentSessions = store.getSessions(batch.agentId);
    expect(agentSessions).toHaveLength(2);

    // Agent polls Sales specifically — sees 3 respondents
    const salesFiltered = store.getSessions(batch.agentId, [salesGuid]);
    expect(salesFiltered).toHaveLength(1);
    expect(salesFiltered[0].status).toBe('in_progress');
    expect(salesFiltered[0].respondents).toHaveLength(3);

    // Cross-agent isolation: agent cannot see other agent's sessions
    const crossAgent = store.getSessions(batch.agentId, [other.sessions[0].guid]);
    expect(crossAgent).toEqual([]);

    // Agent updates Sales form (adds a follow-up question)
    store.updateCards(batch.agentId, salesGuid, [
      { id: 'q1', type: 'approve-reject', title: 'Approve the design?' },
      { id: 'q2', type: 'free-text', title: 'Comments?' },
      { id: 'q3', type: 'yes-no', title: 'Should we proceed to implementation?' },
    ]);

    // Alice's q1 answer is preserved, q2 not yet answered so nothing lost
    const salesUpdated = store.getSessions(batch.agentId, [salesGuid]);
    expect(salesUpdated[0].cards).toHaveLength(3);
    const aliceR = salesUpdated[0].respondents.find(r => r.name === 'Alice')!;
    expect(aliceR.answers).toHaveLength(1);
    expect(aliceR.answers[0].cardId).toBe('q1');

    // Alice answers remaining questions and submits
    store.submitAnswer(salesGuid, alice.respondentId, { cardId: 'q2', value: 'Looks great' });
    store.submitAnswer(salesGuid, alice.respondentId, { cardId: 'q3', value: true });
    store.submitRespondent(salesGuid, alice.respondentId, 'Ready to go');

    // Bob answers and submits
    store.submitAnswer(salesGuid, bob.respondentId, { cardId: 'q1', value: 'rejected' });
    store.submitAnswer(salesGuid, bob.respondentId, { cardId: 'q2', value: 'Needs rework' });
    store.submitRespondent(salesGuid, bob.respondentId, 'Not ready');

    // Carol answers but does not submit
    store.submitAnswer(salesGuid, carol.respondentId, { cardId: 'q1', value: 'approved' });

    // Dave rates and submits on Tech
    store.submitAnswer(techGuid, dave.respondentId, { cardId: 'q1', value: 4 });
    store.submitRespondent(techGuid, dave.respondentId);

    // Agent batch-closes all sessions
    const closed = store.closeSessions(batch.agentId);
    expect(closed).toHaveLength(2);

    const salesClosed = closed.find(c => c.label === 'Sales')!;
    expect(salesClosed.respondents).toHaveLength(3);

    const aliceClosed = salesClosed.respondents.find(r => r.name === 'Alice')!;
    expect(aliceClosed.answers).toHaveLength(3);
    expect(aliceClosed.globalComment).toBe('Ready to go');
    expect(aliceClosed.submittedAt).toBeTruthy();

    const bobClosed = salesClosed.respondents.find(r => r.name === 'Bob')!;
    expect(bobClosed.answers).toHaveLength(2);
    expect(bobClosed.globalComment).toBe('Not ready');

    const carolClosed = salesClosed.respondents.find(r => r.name === 'Carol')!;
    expect(carolClosed.answers).toHaveLength(1);
    expect(carolClosed.submittedAt).toBeUndefined();

    const techClosed = closed.find(c => c.label === 'Tech')!;
    expect(techClosed.respondents).toHaveLength(1);
    expect(techClosed.respondents[0].name).toBe('Dave');
    expect(techClosed.respondents[0].answers).toHaveLength(1);
    expect(techClosed.respondents[0].answers[0].value).toBe(4);
  });

  it('resubmit: same name returns existing respondent with their answers, only one respondent in session', () => {
    const store = new SessionStore(60);

    const batch = store.createSession({
      title: 'Quick Poll',
      participants: [
        { label: 'Team', cards: [{ id: 'q1', type: 'free-text', title: 'Feedback?' }] },
      ],
    });
    const guid = batch.sessions[0].guid;

    // Alice joins and answers
    const first = store.joinSession(guid, 'Alice')!;
    store.submitAnswer(guid, first.respondentId, { cardId: 'q1', value: 'first answer' });

    // Alice "rejoins" (same name) — gets back same respondent with answers
    const second = store.joinSession(guid, 'Alice')!;
    expect(second.respondentId).toBe(first.respondentId);
    expect(second.answers).toHaveLength(1);
    expect(second.answers[0].value).toBe('first answer');

    // Only one respondent exists
    const session = store.getSessionPublic(guid)!;
    expect(session.respondents).toHaveLength(1);
    expect(session.respondents[0].name).toBe('Alice');
  });
});
