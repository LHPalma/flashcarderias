import { describe, expect, it } from 'vitest';
import { bestStreak, buildHeatmap, currentStreak, dayKey, heatLevel, stageBuckets, tally } from './stats';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 11, 18); // quarta-feira
const logs = (...days: number[]) => days.map((ts) => ({ ts, grade: 3 }));

describe('tally', () => {
  it('conta revisões e acertos por dia', () => {
    const m = tally([
      { ts: at(2026, 11, 18, 8), grade: 1 },
      { ts: at(2026, 11, 18, 9), grade: 3 },
      { ts: at(2026, 11, 18, 23), grade: 4 },
    ]);
    expect(m.get('2026-11-18')).toEqual({ n: 3, ok: 2 });
  });
});

describe('sequência', () => {
  it('conta dias seguidos terminando hoje', () => {
    const m = tally(logs(at(2026, 11, 16), at(2026, 11, 17), at(2026, 11, 18)));
    expect(currentStreak(m, NOW)).toBe(3);
  });
  it('mantém a sequência de ontem se hoje ainda não estudou', () => {
    const m = tally(logs(at(2026, 11, 16), at(2026, 11, 17)));
    expect(currentStreak(m, NOW)).toBe(2);
  });
  it('quebra quando falta um dia', () => {
    const m = tally(logs(at(2026, 11, 15), at(2026, 11, 18)));
    expect(currentStreak(m, NOW)).toBe(1);
    expect(currentStreak(new Map(), NOW)).toBe(0);
  });
  it('atravessa a virada de mês', () => {
    const m = tally(logs(at(2026, 10, 30), at(2026, 10, 31), at(2026, 11, 1)));
    expect(bestStreak(m)).toBe(3);
  });
  it('acha o melhor recorde', () => {
    const m = tally(logs(at(2026, 11, 1), at(2026, 11, 2), at(2026, 11, 5), at(2026, 11, 6), at(2026, 11, 7)));
    expect(bestStreak(m)).toBe(3);
  });
});

describe('mapa de calor', () => {
  it('tem 22 colunas de 7 dias e termina na semana de hoje', () => {
    const cols = buildHeatmap(new Map(), NOW);
    expect(cols).toHaveLength(22);
    expect(cols.every((c) => c.length === 7)).toBe(true);
    const last = cols[21];
    expect(last[0].date.getDay()).toBe(0);
    expect(last.find((c) => c.key === dayKey(NOW))).toBeTruthy();
    expect(last[3].future).toBe(false); // quarta = hoje
    expect(last[4].future).toBe(true); // quinta ainda não chegou
  });
  it('leva as contagens para as células', () => {
    const m = tally(logs(NOW, NOW, NOW));
    const cell = buildHeatmap(m, NOW)[21][3];
    expect(cell).toMatchObject({ n: 3, ok: 3, level: 1 });
  });
  it('níveis por faixas', () => {
    expect([0, 1, 4, 5, 14, 15, 29, 30].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
  });
});

describe('stageBuckets', () => {
  it('separa novas, aprendendo e revisões por intervalo', () => {
    const b = stageBuckets([
      { state: 'new', interval: 0 },
      { state: 'learning', interval: 0 },
      { state: 'review', interval: 1 },
      { state: 'review', interval: 5 },
      { state: 'review', interval: 20 },
      { state: 'review', interval: 90 },
    ]);
    expect(b.map((x) => x.count)).toEqual([1, 1, 1, 1, 1, 1]);
  });
});
