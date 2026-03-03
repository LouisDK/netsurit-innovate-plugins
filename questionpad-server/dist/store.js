import { v4 as uuidv4 } from 'uuid';
export class SessionStore {
    sessions = new Map();
    agents = new Map();
    ttlMs;
    constructor(ttlMinutes) {
        this.ttlMs = ttlMinutes * 60 * 1000;
    }
    createSession(input) {
        const agentId = input.agentId || uuidv4();
        if (!this.agents.has(agentId)) {
            this.agents.set(agentId, new Set());
        }
        const agentGuids = this.agents.get(agentId);
        const now = Date.now();
        const sessions = [];
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
    getSessions(agentId, guids) {
        const agentGuids = this.agents.get(agentId);
        if (!agentGuids)
            return [];
        const targetGuids = guids
            ? guids.filter(g => agentGuids.has(g))
            : [...agentGuids];
        const result = [];
        for (const guid of targetGuids) {
            const session = this.sessions.get(guid);
            if (session) {
                this.touch(guid);
                result.push(session);
            }
        }
        return result;
    }
    getSessionPublic(guid) {
        const session = this.sessions.get(guid);
        if (!session)
            return null;
        this.touch(guid);
        return session;
    }
    submitAnswer(guid, answer) {
        const session = this.sessions.get(guid);
        if (!session || session.status === 'closed' || session.status === 'expired')
            return false;
        const existing = session.answers.findIndex(a => a.cardId === answer.cardId);
        if (existing >= 0) {
            session.answers[existing] = answer;
        }
        else {
            session.answers.push(answer);
        }
        if (session.status === 'created') {
            session.status = 'in_progress';
        }
        this.touch(guid);
        return true;
    }
    submitSession(guid, globalComment) {
        const session = this.sessions.get(guid);
        if (!session || session.status === 'closed' || session.status === 'expired')
            return false;
        session.status = 'submitted';
        session.submittedAt = new Date().toISOString();
        session.globalComment = globalComment;
        this.touch(guid);
        return true;
    }
    updateCards(agentId, guid, cards) {
        const session = this.sessions.get(guid);
        if (!session || session.agentId !== agentId)
            return false;
        if (session.status === 'closed' || session.status === 'expired')
            return false;
        const newCardIds = new Set(cards.map(c => c.id));
        session.answers = session.answers.filter(a => newCardIds.has(a.cardId));
        session.cards = cards;
        session.cardVersion++;
        this.touch(guid);
        return true;
    }
    closeSessions(agentId, guids) {
        const agentGuids = this.agents.get(agentId);
        if (!agentGuids)
            return [];
        const targetGuids = guids
            ? guids.filter(g => agentGuids.has(g))
            : [...agentGuids];
        const results = [];
        for (const guid of targetGuids) {
            const session = this.sessions.get(guid);
            if (!session)
                continue;
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
    purgeExpired() {
        const now = Date.now();
        for (const [guid, session] of this.sessions) {
            if (now - session.lastActivityAt >= this.ttlMs) {
                this.sessions.delete(guid);
                const agentGuids = this.agents.get(session.agentId);
                if (agentGuids) {
                    agentGuids.delete(guid);
                    if (agentGuids.size === 0)
                        this.agents.delete(session.agentId);
                }
            }
        }
    }
    touch(guid) {
        const session = this.sessions.get(guid);
        if (session)
            session.lastActivityAt = Date.now();
    }
}
