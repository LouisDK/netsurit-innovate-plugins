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
    sessions: Array<{
        label: string;
        guid: string;
    }>;
}
interface CloseSessionResult {
    guid: string;
    label: string;
    finalAnswers: Answer[];
    globalComment?: string;
    submittedAt?: string;
}
export declare class SessionStore {
    private sessions;
    private agents;
    private ttlMs;
    constructor(ttlMinutes: number);
    createSession(input: CreateSessionInput): CreateSessionResult;
    getSessions(agentId: string, guids?: string[]): Session[];
    getSessionPublic(guid: string): Session | null;
    submitAnswer(guid: string, answer: Answer): boolean;
    submitSession(guid: string, globalComment?: string): boolean;
    updateCards(agentId: string, guid: string, cards: Card[]): boolean;
    closeSessions(agentId: string, guids?: string[]): CloseSessionResult[];
    purgeExpired(): void;
    private touch;
}
export {};
