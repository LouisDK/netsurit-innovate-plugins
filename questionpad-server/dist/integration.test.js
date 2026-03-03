import { describe, it, expect } from 'vitest';
import { SessionStore } from './store.js';
describe('Full flow integration', () => {
    it('agent creates batch session, users answer, agent polls, updates, users submit, agent batch-closes', () => {
        const store = new SessionStore(60);
        // Agent creates batch session for Alice and Bob
        const batch = store.createSession({
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
        expect(batch.sessions).toHaveLength(2);
        const aliceGuid = batch.sessions[0].guid;
        const bobGuid = batch.sessions[1].guid;
        // A different agent creates a session (should be isolated)
        const other = store.createSession({
            title: "Other Agent's Session",
            participants: [{ label: 'Other', cards: [] }],
        });
        // Alice answers q1
        store.submitAnswer(aliceGuid, { cardId: 'q1', value: 'approved' });
        // Agent polls all sessions — should see 2, not 3
        const agentSessions = store.getSessions(batch.agentId);
        expect(agentSessions).toHaveLength(2);
        // Agent polls Alice specifically
        const aliceFiltered = store.getSessions(batch.agentId, [aliceGuid]);
        expect(aliceFiltered).toHaveLength(1);
        expect(aliceFiltered[0].status).toBe('in_progress');
        expect(aliceFiltered[0].answers).toHaveLength(1);
        // Cross-agent isolation: agent cannot see other agent's sessions
        const crossAgent = store.getSessions(batch.agentId, [other.sessions[0].guid]);
        expect(crossAgent).toEqual([]);
        // Agent updates Alice's form (adds a follow-up question)
        store.updateCards(batch.agentId, aliceGuid, [
            { id: 'q1', type: 'approve-reject', title: 'Approve the design?' },
            { id: 'q2', type: 'free-text', title: 'Comments?' },
            { id: 'q3', type: 'yes-no', title: 'Should we proceed to implementation?' },
        ]);
        // Alice's q1 answer is preserved
        const aliceUpdated = store.getSessions(batch.agentId, [aliceGuid]);
        expect(aliceUpdated[0].cards).toHaveLength(3);
        expect(aliceUpdated[0].answers).toHaveLength(1);
        expect(aliceUpdated[0].answers[0].cardId).toBe('q1');
        // Alice answers remaining questions and submits
        store.submitAnswer(aliceGuid, { cardId: 'q2', value: 'Looks great' });
        store.submitAnswer(aliceGuid, { cardId: 'q3', value: true });
        store.submitSession(aliceGuid, 'Ready to go');
        // Bob rates and submits
        store.submitAnswer(bobGuid, { cardId: 'q1', value: 4 });
        store.submitSession(bobGuid);
        // Agent batch-closes all sessions
        const closed = store.closeSessions(batch.agentId);
        expect(closed).toHaveLength(2);
        const aliceClosed = closed.find(c => c.label === 'Alice');
        expect(aliceClosed.finalAnswers).toHaveLength(3);
        expect(aliceClosed.globalComment).toBe('Ready to go');
        const bobClosed = closed.find(c => c.label === 'Bob');
        expect(bobClosed.finalAnswers).toHaveLength(1);
        expect(bobClosed.finalAnswers[0].value).toBe(4);
    });
    it('agent closes subset of sessions', () => {
        const store = new SessionStore(60);
        const batch = store.createSession({
            title: 'Team Feedback',
            participants: [
                { label: 'Charlie', cards: [{ id: 'q1', type: 'free-text', title: 'Feedback?' }] },
                { label: 'Diana', cards: [{ id: 'q1', type: 'free-text', title: 'Feedback?' }] },
                { label: 'Eve', cards: [{ id: 'q1', type: 'free-text', title: 'Feedback?' }] },
            ],
        });
        const charlieGuid = batch.sessions[0].guid;
        const dianaGuid = batch.sessions[1].guid;
        const eveGuid = batch.sessions[2].guid;
        // Close only Charlie and Diana
        const closed = store.closeSessions(batch.agentId, [charlieGuid, dianaGuid]);
        expect(closed).toHaveLength(2);
        expect(closed.map(c => c.label).sort()).toEqual(['Charlie', 'Diana']);
        // Eve should still be open
        const eveSessions = store.getSessions(batch.agentId, [eveGuid]);
        expect(eveSessions).toHaveLength(1);
        expect(eveSessions[0].status).toBe('created');
    });
});
