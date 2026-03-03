export type CardType =
  | 'multiple-choice'
  | 'multi-select'
  | 'yes-no'
  | 'approve-reject'
  | 'free-text'
  | 'rating'
  | 'slider'
  | 'range-slider';

export type SessionStatus = 'created' | 'in_progress' | 'submitted' | 'closed' | 'expired';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  body?: string;
  required?: boolean;
  options?: string[];        // for multiple-choice, multi-select
  min?: number;              // for rating, slider, range-slider
  max?: number;              // for rating, slider, range-slider
  step?: number;             // for slider, range-slider
  placeholder?: string;      // for free-text
}

export interface Answer {
  cardId: string;
  value: unknown;            // type depends on card type
  comment?: string;
}

export interface Session {
  guid: string;
  agentId: string;
  label: string;
  title: string;
  cards: Card[];
  answers: Answer[];
  status: SessionStatus;
  globalComment?: string;
  createdAt: number;
  lastActivityAt: number;
  submittedAt?: string;
  /** Incremented each time cards are updated, so browser can detect changes */
  cardVersion: number;
}
