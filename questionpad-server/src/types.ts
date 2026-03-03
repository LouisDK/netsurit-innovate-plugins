export type CardType =
  | 'multiple-choice'
  | 'multi-select'
  | 'yes-no'
  | 'approve-reject'
  | 'free-text'
  | 'rating'
  | 'slider'
  | 'range-slider';

export type SessionStatus = 'created' | 'in_progress' | 'closed' | 'expired';

export type RespondentStatus = 'in_progress' | 'submitted';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  body?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface Answer {
  cardId: string;
  value: unknown;
  comment?: string;
}

export interface Respondent {
  respondentId: string;
  name: string;
  answers: Answer[];
  globalComment?: string;
  status: RespondentStatus;
  joinedAt: string;
  submittedAt?: string;
}

export interface Session {
  guid: string;
  agentId: string;
  label: string;
  title: string;
  description?: string;
  cards: Card[];
  respondents: Respondent[];
  status: SessionStatus;
  createdAt: number;
  lastActivityAt: number;
  cardVersion: number;
}
