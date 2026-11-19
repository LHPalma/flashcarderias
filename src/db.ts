import Dexie, { type EntityTable } from 'dexie';
import { type Grade, type LearningMode, type SrsFields, endOfDay, isDue, newSrsFields, schedule, startOfDay } from './srs';
import type { ParsedCard } from './anki';
import { descendantIds } from './groups';
import { DAY, SNOOZE_DAYS, type BackupFacts, type BackupState } from './backup';

export interface Deck {
  id: number;
  name: string;
  createdAt: number;
  groupId?: number; // sem grupo = fica solto na tela inicial
}

/** Grupo de decks. Pode ficar dentro de outro grupo (parentId). */
export interface Group {
  id: number;
  name: string;
  parentId?: number;
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
  groups: EntityTable<Group, 'id'>;
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
// v2: grupos de decks. Os decks que já existem continuam soltos (sem groupId).
db.version(2).stores({ groups: '++id' });

/* ---------- configurações ---------- */

export type ThemeId = 'amber' | 'sage' | 'blue' | 'wine';

export interface Settings {
  newPerDay: number; // fichas novas por dia, por deck
  dailyGoal: number; // meta de revisões por dia
  theme: ThemeId;
  learningMode: LearningMode; // como uma ficha nova aprende: rápido (um acerto) ou rigoroso (dois passos)
}
export const DEFAULT_SETTINGS: Settings = { newPerDay: 10, dailyGoal: 20, theme: 'amber', learningMode: 'fast' };

export async function getSettings(): Promise<Settings> {
  const row = await db.meta.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.meta.put({ key: 'settings', value: s });
}

/* ---------- decks e cartões ---------- */

export async function createDeck(name: string, groupId?: number): Promise<number> {
  return db.decks.add({ name: name.trim() || 'Novo deck', createdAt: Date.now(), groupId } as Deck);
}

/* ---------- grupos ---------- */

export async function createGroup(name: string, parentId?: number): Promise<number> {
  return db.groups.add({ name: name.trim() || 'Novo grupo', parentId, createdAt: Date.now() } as Group);
}

export async function renameGroup(id: number, name: string): Promise<void> {
  const clean = name.trim();
  if (clean) await db.groups.update(id, { name: clean });
}

export async function moveDeck(deckId: number, groupId?: number): Promise<void> {
  await db.decks.update(deckId, { groupId });
}

/** Move um grupo para dentro de outro (ou para a raiz). Recusa mover para dentro de si mesmo ou de um descendente. */
export async function moveGroup(id: number, parentId?: number): Promise<void> {
  if (parentId !== undefined && descendantIds(await db.groups.toArray(), id).has(parentId)) {
    throw new Error('Não dá para mover um grupo para dentro dele mesmo.');
  }
  await db.groups.update(id, { parentId });
}

/** Apaga só o grupo. Subgrupos e decks dele sobem para o grupo-pai (ou para a raiz). */
export async function deleteGroup(id: number): Promise<void> {
  await db.transaction('rw', db.groups, db.decks, async () => {
    const group = await db.groups.get(id);
    if (!group) return;
    const up = group.parentId;
    await db.groups.filter((g) => g.parentId === id).modify({ parentId: up });
    await db.decks.filter((d) => d.groupId === id).modify({ groupId: up });
    await db.groups.delete(id);
  });
}

/** Garante que o caminho de grupos exista (ex.: ["Livros", "Psicologia"]) e devolve o último. */
export async function ensureGroupPath(path: string[]): Promise<number | undefined> {
  const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR');
  return db.transaction('rw', db.groups, async () => {
    let parent: number | undefined;
    for (const raw of path) {
      const name = raw.trim();
      if (!name) continue;
      const all = await db.groups.toArray();
      const hit = all.find((g) => g.parentId === parent && norm(g.name) === norm(name));
      parent = hit ? hit.id : await createGroup(name, parent);
    }
    return parent;
  });
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

/**
 * Importa um deck inteiro de uma vez: cria os grupos do caminho, o deck e todas as fichas numa só
 * transação. Ou entra tudo, ou nada. Antes, o deck aparecia primeiro e as fichas depois: se o app
 * fosse fechado no meio de um arquivo grande, sobrava um deck vazio.
 * `path` é o caminho completo ("Livros", "Psicologia", "Meu Livro"): os grupos e, por último, o deck.
 */
export async function importDeck(path: string[], parsed: ParsedCard[]): Promise<{ deckId: number; groupId?: number; added: number }> {
  if (path.length === 0) throw new Error('O deck precisa de um nome.');
  return db.transaction('rw', db.groups, db.decks, db.cards, async () => {
    const groupId = await ensureGroupPath(path.slice(0, -1));
    const deckId = await createDeck(path[path.length - 1], groupId);
    const added = await addCards(deckId, parsed);
    return { deckId, groupId, added };
  });
}

/* ---------- fila de estudo ---------- */

/** Quantos cartões novos já foram iniciados hoje (para respeitar o limite diário). */
export async function newStudiedToday(now: number, deckId?: number): Promise<number> {
  const logs = await db.reviews.where('ts').aboveOrEqual(startOfDay(now)).toArray();
  return logs.filter((l) => l.wasNew && (deckId === undefined || l.deckId === deckId)).length;
}

/**
 * IDs na ordem de estudo: aprendizado vencido, revisões do dia, depois cartões novos.
 * `deckIds` limita a esses decks (um deck, um grupo inteiro); indefinido = todos.
 * O limite de fichas novas por dia vale para cada deck, igual ao que a tela inicial mostra.
 */
export async function buildQueue(deckIds: number[] | undefined, now: number): Promise<number[]> {
  const all =
    deckIds === undefined
      ? await db.cards.toArray()
      : (await Promise.all(deckIds.map((id) => db.cards.where('deckId').equals(id).toArray()))).flat();
  const settings = await getSettings();
  const learning = all.filter((c) => c.state === 'learning' && isDue(c, now)).sort((a, b) => a.due - b.due);
  const reviews = all.filter((c) => c.state === 'review' && isDue(c, now)).sort((a, b) => a.due - b.due);

  const startedToday = new Map<number, number>();
  const logs = await db.reviews.where('ts').aboveOrEqual(startOfDay(now)).toArray();
  for (const l of logs) if (l.wasNew) startedToday.set(l.deckId, (startedToday.get(l.deckId) ?? 0) + 1);

  const freshByDeck = new Map<number, Card[]>();
  for (const c of all.filter((c) => c.state === 'new').sort((a, b) => a.id - b.id)) {
    freshByDeck.set(c.deckId, [...(freshByDeck.get(c.deckId) ?? []), c]);
  }
  const fresh = [...freshByDeck]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([deckId, list]) => list.slice(0, Math.max(0, settings.newPerDay - (startedToday.get(deckId) ?? 0))));

  return [...learning, ...reviews, ...fresh].map((c) => c.id);
}

/** Registra a resposta, atualiza o agendamento e devolve o cartão atualizado. */
export async function gradeCard(cardId: number, grade: Grade, now: number): Promise<Card> {
  const { learningMode } = await getSettings();
  return db.transaction('rw', db.cards, db.reviews, async () => {
    const card = await db.cards.get(cardId);
    if (!card) throw new Error('Cartão não encontrado');
    const next = { ...card, ...schedule(card, grade, now, learningMode) };
    await db.cards.put(next);
    await db.reviews.add({ cardId, deckId: card.deckId, ts: now, grade, wasNew: card.state === 'new' } as ReviewLog);
    return next;
  });
}

/* ---------- contagens para a tela inicial ---------- */

export interface DeckCounts {
  total: number;
  fresh: number; // novos disponíveis hoje (respeitando o limite)
  learning: number; // em aprendizado e já no prazo
  review: number;
  waiting: number; // em aprendizado, mas esperando o prazo (por exemplo, errou há 30 s)
  nextDue?: number; // quando volta a primeira das que estão esperando
}

export function countCards(cards: Card[], newBudget: number, now: number): DeckCounts {
  let learning = 0;
  let review = 0;
  let fresh = 0;
  let waiting = 0;
  let nextDue: number | undefined;
  for (const c of cards) {
    if (c.state === 'new') fresh++;
    else if (c.state === 'learning') {
      if (c.due <= now) learning++;
      else {
        waiting++;
        nextDue = nextDue === undefined ? c.due : Math.min(nextDue, c.due);
      }
    } else if (c.state === 'review' && c.due <= endOfDay(now)) review++;
  }
  return { total: cards.length, fresh: Math.min(fresh, Math.max(0, newBudget)), learning, review, waiting, nextDue };
}

/* ---------- lembrete de backup ---------- */

export async function getBackupState(): Promise<BackupState> {
  return ((await db.meta.get('backup'))?.value as BackupState | undefined) ?? {};
}

/** Registra que um backup acabou de ser feito (ou restaurado: nesse caso os dados são iguais ao arquivo). */
export async function markBackup(now = Date.now()): Promise<void> {
  await db.meta.put({ key: 'backup', value: { lastAt: now } satisfies BackupState });
}

/** "Depois": não lembrar por alguns dias. */
export async function snoozeBackup(now = Date.now()): Promise<void> {
  const state = await getBackupState();
  await db.meta.put({ key: 'backup', value: { ...state, snoozeUntil: now + SNOOZE_DAYS * DAY } satisfies BackupState });
}

export async function getBackupFacts(state: BackupState): Promise<BackupFacts> {
  const first = await db.reviews.orderBy('ts').first();
  const since = state.lastAt === undefined ? 0 : await db.reviews.where('ts').above(state.lastAt).count();
  return { firstReviewAt: first?.ts, reviewsSinceLast: since };
}

/* ---------- backup ---------- */

export interface Backup {
  version: 1 | 2; // 2 = com grupos de decks; backups da versão 1 continuam sendo aceitos
  exportedAt: number;
  groups?: Group[];
  decks: Deck[];
  cards: Card[];
  reviews: ReviewLog[];
  settings: Settings;
}

export async function exportBackup(): Promise<Backup> {
  return {
    version: 2,
    exportedAt: Date.now(),
    groups: await db.groups.toArray(),
    decks: await db.decks.toArray(),
    cards: await db.cards.toArray(),
    reviews: await db.reviews.toArray(),
    settings: await getSettings(),
  };
}

export async function importBackup(b: Backup): Promise<void> {
  if ((b?.version !== 1 && b?.version !== 2) || !Array.isArray(b.decks) || !Array.isArray(b.cards)) {
    throw new Error('Arquivo de backup inválido.');
  }
  await db.transaction('rw', [db.groups, db.decks, db.cards, db.reviews, db.meta], async () => {
    await Promise.all([db.groups.clear(), db.decks.clear(), db.cards.clear(), db.reviews.clear()]);
    await db.groups.bulkAdd(b.groups ?? []);
    await db.decks.bulkAdd(b.decks);
    await db.cards.bulkAdd(b.cards);
    await db.reviews.bulkAdd(b.reviews ?? []);
    await saveSettings({ ...DEFAULT_SETTINGS, ...b.settings });
  });
}
