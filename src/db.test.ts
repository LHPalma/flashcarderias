import 'fake-indexeddb/auto'; // precisa vir antes do banco
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addCards,
  buildQueue,
  countCards,
  createDeck,
  createGroup,
  db,
  deleteGroup,
  ensureGroupPath,
  exportBackup,
  gradeCard,
  importBackup,
  moveDeck,
  moveGroup,
  saveSettings,
  DEFAULT_SETTINGS,
} from './db';
import { startOfDay } from './srs';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ front: `P${i}`, back: `R${i}`, tags: [] }));

describe('grupos', () => {
  it('ensureGroupPath cria o caminho uma vez e reaproveita (sem diferenciar maiúsculas)', async () => {
    const a = await ensureGroupPath(['Livros', 'Psicologia']);
    const b = await ensureGroupPath(['livros', 'PSICOLOGIA']);
    expect(b).toBe(a);
    expect(await db.groups.count()).toBe(2);
    const psi = await db.groups.get(a!);
    expect(psi?.name).toBe('Psicologia');
    expect((await db.groups.get(psi!.parentId!))?.name).toBe('Livros');
  });

  it('ensureGroupPath vazio não cria nada', async () => {
    expect(await ensureGroupPath([])).toBeUndefined();
    expect(await db.groups.count()).toBe(0);
  });

  it('moveGroup recusa mover para dentro de si mesmo ou de um descendente', async () => {
    const livros = await createGroup('Livros');
    const psi = await createGroup('Psicologia', livros);
    await expect(moveGroup(livros, psi)).rejects.toThrow();
    await expect(moveGroup(livros, livros)).rejects.toThrow();
    await moveGroup(psi, undefined);
    expect((await db.groups.get(psi))?.parentId).toBeUndefined();
  });

  it('deleteGroup sobe decks e subgrupos para o grupo-pai e não apaga nada além do grupo', async () => {
    const livros = await createGroup('Livros');
    const psi = await createGroup('Psicologia', livros);
    const sub = await createGroup('Corpo', psi);
    const deck = await createDeck('O Que o Corpo Fala', psi);
    await addCards(deck, cards(3));
    await deleteGroup(psi);
    expect(await db.groups.get(psi)).toBeUndefined();
    expect((await db.groups.get(sub))?.parentId).toBe(livros);
    expect((await db.decks.get(deck))?.groupId).toBe(livros);
    expect(await db.cards.count()).toBe(3);
  });

  it('apagar um grupo da raiz deixa os decks soltos', async () => {
    const livros = await createGroup('Livros');
    const deck = await createDeck('X', livros);
    await deleteGroup(livros);
    expect((await db.decks.get(deck))?.groupId).toBeUndefined();
  });

  it('moveDeck troca e tira o deck de um grupo', async () => {
    const g = await createGroup('Livros');
    const deck = await createDeck('X');
    await moveDeck(deck, g);
    expect((await db.decks.get(deck))?.groupId).toBe(g);
    await moveDeck(deck, undefined);
    expect((await db.decks.get(deck))?.groupId).toBeUndefined();
  });
});

describe('fila de estudo por escopo', () => {
  it('o limite de fichas novas vale por deck, e o escopo escolhe os decks', async () => {
    const a = await createDeck('A');
    const b = await createDeck('B');
    await addCards(a, cards(15));
    await addCards(b, cards(15));
    await saveSettings({ ...DEFAULT_SETTINGS, newPerDay: 10 });
    const now = Date.now();
    expect(await buildQueue(undefined, now)).toHaveLength(20);
    expect(await buildQueue([a, b], now)).toHaveLength(20);
    expect(await buildQueue([a], now)).toHaveLength(10);
    expect(await buildQueue([], now)).toHaveLength(0);
  });

  it('desconta do limite as fichas novas que o deck já iniciou hoje', async () => {
    const a = await createDeck('A');
    const b = await createDeck('B');
    await addCards(a, cards(15));
    await addCards(b, cards(15));
    await saveSettings({ ...DEFAULT_SETTINGS, newPerDay: 10 });
    const now = startOfDay(Date.now()) + 3_600_000;
    for (let i = 0; i < 4; i++) await db.reviews.add({ cardId: i, deckId: a, ts: now, grade: 3, wasNew: true } as never);
    expect(await buildQueue([a], now)).toHaveLength(6);
    expect(await buildQueue([a, b], now)).toHaveLength(16); // 6 do A + 10 do B
  });
});

describe('countCards: fichas em espera', () => {
  const NOW = Date.UTC(2026, 10, 19, 15, 0, 0);
  const card = (state: 'new' | 'learning' | 'review', due: number) => ({ id: 1, deckId: 1, front: 'a', back: 'b', tags: [], createdAt: 0, state, ease: 2.5, interval: 1, reps: 0, lapses: 0, due }) as never;

  it('separa as em aprendizado que já venceram das que ainda esperam, e guarda a primeira a voltar', () => {
    const c = countCards(
      [card('learning', NOW - 1), card('learning', NOW + 5 * 60_000), card('learning', NOW + 60_000), card('new', 0)],
      10,
      NOW,
    );
    expect(c).toMatchObject({ learning: 1, waiting: 2, fresh: 1, nextDue: NOW + 60_000 });
  });

  it('sem nada esperando, waiting é 0 e nextDue não existe', () => {
    const c = countCards([card('review', NOW - 1)], 10, NOW);
    expect(c.waiting).toBe(0);
    expect(c.nextDue).toBeUndefined();
  });
});

describe('modo de aprendizado (gravado nas configurações)', () => {
  const firstCard = async () => {
    const d = await createDeck('X');
    await addCards(d, cards(1));
    return (await db.cards.toArray())[0].id;
  };

  it('rápido (padrão): um Bom gradua a ficha nova para 1 dia', async () => {
    const id = await firstCard();
    const after = await gradeCard(id, 3, Date.now());
    expect(after).toMatchObject({ state: 'review', interval: 1 });
  });

  it('rigoroso: o primeiro Bom leva a ficha para o segundo passo; o segundo gradua; fica gravado no banco', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, learningMode: 'strict' });
    const id = await firstCard();
    const t = Date.now();
    const one = await gradeCard(id, 3, t);
    expect(one).toMatchObject({ state: 'learning', step: 1, due: t + 10 * 60_000 });
    expect((await db.cards.get(id))?.step).toBe(1);
    const two = await gradeCard(id, 3, t + 10 * 60_000);
    expect(two).toMatchObject({ state: 'review', interval: 1, step: 0 });
  });

  it('o modo escolhido entra no backup e volta ao restaurar', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, learningMode: 'strict' });
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    await db.delete();
    await db.open();
    await importBackup(backup);
    expect((await db.meta.get('settings'))?.value).toMatchObject({ learningMode: 'strict' });
  });

  it('configurações antigas, sem o campo, usam o modo rápido', async () => {
    await db.meta.put({ key: 'settings', value: { newPerDay: 5, dailyGoal: 10, theme: 'blue' } });
    const id = await firstCard();
    expect(await gradeCard(id, 3, Date.now())).toMatchObject({ state: 'review' });
  });
});

describe('backup e migração', () => {
  it('exporta e restaura com grupos', async () => {
    const g = await createGroup('Livros');
    const d = await createDeck('X', g);
    await addCards(d, cards(2));
    const backup = await exportBackup();
    expect(backup.version).toBe(2);
    await db.delete();
    await db.open();
    await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(await db.groups.count()).toBe(1);
    expect((await db.decks.toArray())[0].groupId).toBe(g);
    expect(await db.cards.count()).toBe(2);
  });

  it('aceita backup antigo (versão 1, sem grupos)', async () => {
    await importBackup({ version: 1, exportedAt: 0, decks: [{ id: 1, name: 'Velho', createdAt: 0 }], cards: [], reviews: [], settings: DEFAULT_SETTINGS });
    expect(await db.decks.count()).toBe(1);
    expect(await db.groups.count()).toBe(0);
  });

  it('recusa arquivo que não é backup', async () => {
    await expect(importBackup({ foo: 1 } as never)).rejects.toThrow('inválido');
  });

  it('um banco criado na versão 1 (sem grupos) abre na versão atual sem perder nada', async () => {
    await db.delete();
    const old = new Dexie('flashcards');
    old.version(1).stores({ decks: '++id', cards: '++id, deckId, due, [deckId+state]', reviews: '++id, deckId, ts', meta: 'key' });
    await old.open();
    await old.table('decks').add({ name: 'Deck antigo', createdAt: 1 });
    old.close();

    await db.open();
    const decks = await db.decks.toArray();
    expect(decks.map((d) => d.name)).toEqual(['Deck antigo']);
    expect(decks[0].groupId).toBeUndefined();
    expect(await db.groups.count()).toBe(0);
  });
});
