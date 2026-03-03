import { v4 as uuidv4 } from 'uuid';
import type { Card, Answer, Session } from './types.js';

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
        description: input.description,
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
