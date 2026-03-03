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

    // Check for existing respondent with exact same name
    const existing = session.respondents.find(r => r.name === name);
    if (existing) {
      this.touch(guid);
      return { respondentId: existing.respondentId, answers: existing.answers };
    }

    // Create new respondent
    const respondent: Respondent = {
      respondentId: uuidv4(),
      name,
      answers: [],
      status: 'in_progress',
      joinedAt: new Date().toISOString(),
    };
    session.respondents.push(respondent);

    // Transition from created to in_progress on first join
    if (session.status === 'created') {
      session.status = 'in_progress';
    }

    this.touch(guid);
    return { respondentId: respondent.respondentId, answers: respondent.answers };
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
    if (!respondent) return false;
    if (respondent.status === 'submitted') return false;

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

    // Filter answers on each respondent
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
