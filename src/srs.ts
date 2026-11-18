// Repetição espaçada, inspirada no SM-2 / Anki. Funções puras, sem acesso a banco.

export type Grade = 1 | 2 | 3 | 4; // Errei, Difícil, Bom, Fácil
export type CardState = 'new' | 'learning' | 'review';

export interface SrsFields {
  state: CardState;
  ease: number; // fator de facilidade
  interval: number; // dias (cartões em revisão)
  reps: number; // vezes que graduou para revisão
  lapses: number;
  due: number; // timestamp em ms
}

export const MIN = 60_000;
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const GRADES: Grade[] = [1, 2, 3, 4];
export const GRADE_LABEL: Record<Grade, string> = { 1: 'Errei', 2: 'Difícil', 3: 'Bom', 4: 'Fácil' };

const LEARN_AGAIN = 1 * MIN;
const LEARN_HARD = 6 * MIN;
const LAPSE_STEP = 10 * MIN;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(t: number, n: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(t: number): number {
  return addDays(t, 1) - 1;
}

export function newSrsFields(now: number): SrsFields {
  return { state: 'new', ease: DEFAULT_EASE, interval: 0, reps: 0, lapses: 0, due: now };
}

/** Calcula o novo estado do cartão depois de uma resposta. */
export function schedule(c: SrsFields, grade: Grade, now: number): SrsFields {
  if (c.state !== 'review') {
    // Cartão novo ou em (re)aprendizado.
    if (grade === 1) return { ...c, state: 'learning', due: now + LEARN_AGAIN };
    if (grade === 2) return { ...c, state: 'learning', due: now + LEARN_HARD };
    const relearning = c.reps > 0;
    const interval = grade === 3
      ? (relearning ? Math.max(1, c.interval) : 1)
      : (relearning ? Math.max(c.interval + 1, Math.round(c.interval * 1.5)) : 4);
    return { ...c, state: 'review', interval, reps: c.reps + 1, due: addDays(now, interval) };
  }

  // Cartão em revisão.
  if (grade === 1) {
    return {
      ...c,
      state: 'learning',
      ease: Math.max(MIN_EASE, c.ease - 0.2),
      lapses: c.lapses + 1,
      interval: Math.max(1, Math.round(c.interval * 0.5)),
      due: now + LAPSE_STEP,
    };
  }
  let interval: number;
  let ease = c.ease;
  if (grade === 2) {
    interval = Math.max(c.interval + 1, Math.round(c.interval * 1.2));
    ease = Math.max(MIN_EASE, ease - 0.15);
  } else if (grade === 3) {
    interval = Math.max(c.interval + 1, Math.round(c.interval * ease));
  } else {
    interval = Math.max(c.interval + 1, Math.round(c.interval * ease * 1.3));
    ease += 0.15;
  }
  return { ...c, state: 'review', ease, interval, due: addDays(now, interval) };
}

/** Texto curto do intervalo que o botão vai gerar: "1min", "3 d", "2 meses". */
export function formatDue(due: number, now: number): string {
  const diff = due - now;
  if (diff < 60 * MIN) return `${Math.max(1, Math.round(diff / MIN))} min`;
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
  if (days < 1) return `${Math.round(diff / (60 * MIN))} h`;
  if (days < 30) return `${days} d`;
  if (days < 365) {
    const m = Math.round(days / 30);
    return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  }
  const y = Math.round((days / 365) * 10) / 10;
  return `${String(y).replace('.', ',')} ${y === 1 ? 'ano' : 'anos'}`;
}

export function previewLabels(c: SrsFields, now: number): Record<Grade, string> {
  const out = {} as Record<Grade, string>;
  for (const g of GRADES) out[g] = formatDue(schedule(c, g, now).due, now);
  return out;
}

/** O cartão deve aparecer agora? Aprendizado conta por horário; revisão, por dia. */
export function isDue(c: SrsFields, now: number): boolean {
  if (c.state === 'new') return false;
  if (c.state === 'learning') return c.due <= now;
  return c.due <= endOfDay(now);
}
