import { describe, expect, it } from 'vitest';
import { formatCountdown, pickNext } from './session';
import type { CardState } from './srs';

const NOW = 1_000_000;
const MIN = 60_000;
const cards = (...rows: [number, CardState, number][]) => new Map(rows.map(([id, state, due]) => [id, { state, due }]));

describe('pickNext', () => {
  it('fila vazia: terminou', () => {
    expect(pickNext([], cards(), NOW)).toEqual({ kind: 'done' });
  });

  it('fichas novas e de revisão aparecem na ordem da fila', () => {
    const c = cards([1, 'new', 0], [2, 'review', 0]);
    expect(pickNext([1, 2], c, NOW)).toEqual({ kind: 'card', id: 1 });
    expect(pickNext([2, 1], c, NOW)).toEqual({ kind: 'card', id: 2 });
  });

  it('ficha em aprendizado ainda no prazo é pulada enquanto houver outra disponível', () => {
    const c = cards([1, 'learning', NOW + MIN], [2, 'new', 0], [3, 'review', 0]);
    expect(pickNext([1, 2, 3], c, NOW)).toEqual({ kind: 'card', id: 2 });
  });

  it('ficha em aprendizado volta quando o prazo chega', () => {
    const c = cards([1, 'learning', NOW + MIN]);
    expect(pickNext([1], c, NOW).kind).toBe('wait');
    expect(pickNext([1], c, NOW + MIN - 1).kind).toBe('wait');
    expect(pickNext([1], c, NOW + MIN)).toEqual({ kind: 'card', id: 1 });
  });

  it('só sobraram fichas esperando: pede para aguardar, com o prazo da primeira a voltar', () => {
    const c = cards([1, 'learning', NOW + 6 * MIN], [2, 'learning', NOW + MIN]);
    expect(pickNext([1, 2], c, NOW)).toEqual({ kind: 'wait', nextDue: NOW + MIN, waiting: 2 });
  });

  it('adiantar mostra a ficha que vence primeiro', () => {
    const c = cards([1, 'learning', NOW + 6 * MIN], [2, 'learning', NOW + MIN]);
    expect(pickNext([1, 2], c, NOW, true)).toEqual({ kind: 'card', id: 2 });
  });

  it('adiantar não muda nada se já existe ficha disponível', () => {
    const c = cards([1, 'learning', NOW + MIN], [2, 'new', 0]);
    expect(pickNext([1, 2], c, NOW, true)).toEqual({ kind: 'card', id: 2 });
  });

  it('ignora ids da fila que não têm ficha carregada', () => {
    expect(pickNext([9], cards(), NOW)).toEqual({ kind: 'done' });
    expect(pickNext([9, 1], cards([1, 'new', 0]), NOW)).toEqual({ kind: 'card', id: 1 });
  });
});

describe('formatCountdown', () => {
  it('arredonda para cima e nunca fica negativo', () => {
    expect(formatCountdown(42_100)).toEqual({ mm: 0, ss: 43 });
    expect(formatCountdown(61_000)).toEqual({ mm: 1, ss: 1 });
    expect(formatCountdown(-5)).toEqual({ mm: 0, ss: 0 });
  });
});
