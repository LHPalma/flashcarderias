// Quando lembrar de fazer backup. Lógica pura, sem banco, fácil de testar.

export const DAY = 86_400_000;
export const FIRST_REMINDER_DAYS = 7; // quem nunca fez backup é avisado depois de uma semana de estudo
export const REPEAT_REMINDER_DAYS = 14; // depois, a cada duas semanas (se houve estudo novo)
export const SNOOZE_DAYS = 3; // "Depois" silencia o aviso por 3 dias

export interface BackupState {
  lastAt?: number; // quando foi o último backup
  snoozeUntil?: number; // "Depois": não avisar antes disso
}

export interface BackupFacts {
  firstReviewAt?: number; // primeira revisão já feita
  reviewsSinceLast: number; // revisões feitas depois do último backup
}

export type Reminder = { show: false } | { show: true; never: boolean; days: number };

/**
 * O que o backup protege é o progresso de estudo, que não dá para recriar (os decks dá para importar de novo).
 * Por isso só avisa quando já existe estudo, e, depois do primeiro backup, só se houve estudo novo desde então.
 */
export function backupReminder(state: BackupState, facts: BackupFacts, now: number): Reminder {
  if (facts.firstReviewAt === undefined) return { show: false };
  if (state.snoozeUntil !== undefined && state.snoozeUntil > now) return { show: false };

  if (state.lastAt === undefined) {
    const days = Math.floor((now - facts.firstReviewAt) / DAY);
    return days >= FIRST_REMINDER_DAYS ? { show: true, never: true, days } : { show: false };
  }
  const days = Math.floor((now - state.lastAt) / DAY);
  return days >= REPEAT_REMINDER_DAYS && facts.reviewsSinceLast > 0 ? { show: true, never: false, days } : { show: false };
}

/** "nunca", "hoje", "ontem", "há 5 dias". */
export function ago(ts: number | undefined, now: number): string {
  if (ts === undefined) return 'nunca';
  const days = Math.floor((now - ts) / DAY);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}
