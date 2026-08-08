import type { Content } from './types';

export interface ActivePlaySession {
  sessionKey: string;
  content: Content[];
  startTime: number;
  currentIndex: number;
  answers: (number | null)[];
  hintsShown: boolean[];
  optionOrders: Record<number, number[]>;
  // For other activity types
  score?: number;
  matchedPairs?: string[];
  leftItems?: string[];
  rightItems?: string[];
  known?: number;
  selectedAnswer?: number | null;
  showResult?: boolean;
  correctQuestionIds?: string[];
}

const STORAGE_KEY = 'active_play_session';

export function getActivePlaySession(sessionKey?: string): ActivePlaySession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: ActivePlaySession = JSON.parse(raw);
    if (sessionKey && session.sessionKey !== sessionKey) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveActivePlaySession(session: ActivePlaySession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Error saving play session:', e);
  }
}

export function updateActivePlaySession(patch: Partial<ActivePlaySession>): void {
  try {
    const current = getActivePlaySession();
    if (current) {
      const updated = { ...current, ...patch };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Error updating play session:', e);
  }
}

export function clearActivePlaySession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing play session:', e);
  }
}
