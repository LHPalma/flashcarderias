import Dexie, { type EntityTable } from 'dexie';
import { type Grade, type SrsFields, endOfDay, isDue, newSrsFields, schedule, startOfDay } from './srs';
import type { ParsedCard } from './anki';

export interface Deck {
  id: number;
  name: string;
  createdAt: number;
}

export interface Card extends SrsFields {
  id: number;
  deckId: number;
  front: string;
  back: string;
  tags: string[];
  createdAt: number;
}

export interface ReviewLog {
  id: number;
  cardId: number;
  deckId: number;
  ts: number;
  grade: Grade;
  wasNew: boolean;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export const db = new Dexie('flashcards') as Dexie & {
  decks: EntityTable<Deck, 'id'>;
  cards: EntityTable<Card, 'id'>;
  reviews: EntityTable<ReviewLog, 'id'>;
  meta: EntityTable<MetaRow, 'key'>;
};

db.version(1).stores({
  decks: '++id',
  cards: '++id, deckId, due, [deckId+state]',
  reviews: '++id, deckId, ts',
  meta: 'key',
});

/* ---------- configurações ---------- */

export type ThemeId = 'amber' | 'sage' | 'blue' | 'wine';

export interface Settings {
  newPerDay: number; // fichas novas por dia, por deck
  dailyGoal: number; // meta de revisões por dia
  theme: ThemeId;
}
export const DEFAULT_SETTINGS: Settings = { newPerDay: 10, dailyGoal: 20, theme: 'amber' };

export async function getSettings(): Promise<Settings> {
  const row = await db.meta.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.meta.put({ key: 'settings', value: s });
}

/* ---------- decks e cartões ---------- */

export async function createDeck(name: string): Promise<number> {
  return db.decks.add({ name: name.trim() || 'Novo deck', createdAt: Date.now() } as Deck);
}

export async function deleteDeck(id: number): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.reviews, async () => {
    await db.cards.where('deckId').equals(id).delete();
    await db.reviews.where('deckId').equals(id).delete();
    await db.decks.delete(id);
  });
}

export async function addCards(deckId: number, parsed: ParsedCard[]): Promise<number> {
  const existing = new Set((await db.cards.where('deckId').equals(deckId).toArray()).map((c) => c.front));
  const now = Date.now();
  const rows = [];
  for (const p of parsed) {
    if (existing.has(p.front)) continue;
    existing.add(p.front);
    rows.push({ ...p, deckId, createdAt: now, ...newSrsFields(now) } as Card);
  }
  await db.cards.bulkAdd(rows);
  return rows.length;
}

/* ---------- fila de estudo ---------- */

/** Quantos cartões novos já foram iniciados hoje (para respeitar o limite diário). */
export async function newStudiedToday(now: number, deckId?: number): Promise<number> {
  const logs = await db.reviews.where('ts').aboveOrEqual(startOfDay(now)).toArray();
  return logs.filter((l) => l.wasNew && (deckId === undefined || l.deckId === deckId)).length;
}

/** IDs na ordem de estudo: aprendizado vencido, revisões do dia, depois cartões novos até o limite. */
export async function buildQueue(deckId: number | undefined, now: number): Promise<number[]> {
  const all = deckId === undefined ? await db.cards.toArray() : await db.cards.where('deckId').equals(deckId).toArray();
  const settings = await getSettings();
  const learning = all.filter((c) => c.state === 'learning' && isDue(c, now)).sort((a, b) => a.due - b.due);
  const reviews = all.filter((c) => c.state === 'review' && isDue(c, now)).sort((a, b) => a.due - b.due);
  const budget = Math.max(0, settings.newPerDay - (await newStudiedToday(now, deckId)));
  const fresh = all.filter((c) => c.state === 'new').sort((a, b) => a.id - b.id).slice(0, budget);
  return [...learning, ...reviews, ...fresh].map((c) => c.id);
}

/** Registra a resposta, atualiza o agendamento e devolve o cartão atualizado. */
export async function gradeCard(cardId: number, grade: Grade, now: number): Promise<Card> {
  return db.transaction('rw', db.cards, db.reviews, async () => {
    const card = await db.cards.get(cardId);
    if (!card) throw new Error('Cartão não encontrado');
    const next = { ...card, ...schedule(card, grade, now) };
    await db.cards.put(next);
    await db.reviews.add({ cardId, deckId: card.deckId, ts: now, grade, wasNew: card.state === 'new' } as ReviewLog);
    return next;
  });
}

/* ---------- contagens para a tela inicial ---------- */

export interface DeckCounts {
  total: number;
  fresh: number; // novos disponíveis hoje (respeitando o limite)
  learning: number;
  review: number;
}

export function countCards(cards: Card[], newBudget: number, now: number): DeckCounts {
  let learning = 0;
  let review = 0;
  let fresh = 0;
  for (const c of cards) {
    if (c.state === 'new') fresh++;
    else if (c.state === 'learning' && c.due <= now) learning++;
    else if (c.state === 'review' && c.due <= endOfDay(now)) review++;
  }
  return { total: cards.length, fresh: Math.min(fresh, Math.max(0, newBudget)), learning, review };
}

/* ---------- backup ---------- */

export interface Backup {
  version: 1;
  exportedAt: number;
  decks: Deck[];
  cards: Card[];
  reviews: ReviewLog[];
  settings: Settings;
}

export async function exportBackup(): Promise<Backup> {
  return {
    version: 1,
    exportedAt: Date.now(),
    decks: await db.decks.toArray(),
    cards: await db.cards.toArray(),
    reviews: await db.reviews.toArray(),
    settings: await getSettings(),
  };
}

export async function importBackup(b: Backup): Promise<void> {
  if (b?.version !== 1 || !Array.isArray(b.decks) || !Array.isArray(b.cards)) throw new Error('Arquivo de backup inválido.');
  await db.transaction('rw', [db.decks, db.cards, db.reviews, db.meta], async () => {
    await Promise.all([db.decks.clear(), db.cards.clear(), db.reviews.clear()]);
    await db.decks.bulkAdd(b.decks);
    await db.cards.bulkAdd(b.cards);
    await db.reviews.bulkAdd(b.reviews ?? []);
    await saveSettings({ ...DEFAULT_SETTINGS, ...b.settings });
  });
}
