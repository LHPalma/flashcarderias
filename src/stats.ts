// Estatísticas de estudo: dias ativos, sequência, mapa de calor e distribuição por estágio.
import type { Card } from './db';

export interface DayStat {
  n: number; // revisões no dia
  ok: number; // revisões com nota Bom ou Fácil
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tally(logs: { ts: number; grade: number }[]): Map<string, DayStat> {
  const map = new Map<string, DayStat>();
  for (const l of logs) {
    const k = dayKey(l.ts);
    const s = map.get(k) ?? { n: 0, ok: 0 };
    s.n++;
    if (l.grade >= 3) s.ok++;
    map.set(k, s);
  }
  return map;
}

function shiftDay(t: number, n: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Dias seguidos até hoje. Se hoje ainda não tem revisão, a sequência de ontem continua valendo. */
export function currentStreak(map: Map<string, DayStat>, now: number): number {
  let t = now;
  if (!map.has(dayKey(t))) t = shiftDay(t, -1);
  let n = 0;
  while (map.has(dayKey(t))) {
    n++;
    t = shiftDay(t, -1);
  }
  return n;
}

export function bestStreak(map: Map<string, DayStat>): number {
  const days = [...map.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of days) {
    const [y, m, d] = k.split('-').map(Number);
    const day = Date.UTC(y, m - 1, d) / 86_400_000;
    run = prev !== null && day - prev === 1 ? run + 1 : 1;
    prev = day;
    if (run > best) best = run;
  }
  return best;
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export function heatLevel(n: number): HeatLevel {
  if (n <= 0) return 0;
  if (n <= 4) return 1;
  if (n <= 14) return 2;
  if (n <= 29) return 3;
  return 4;
}

export interface HeatCell {
  key: string;
  date: Date;
  n: number;
  ok: number;
  level: HeatLevel;
  future: boolean;
}

/** Colunas de 7 dias (domingo a sábado), da semana mais antiga até a de hoje. */
export function buildHeatmap(map: Map<string, DayStat>, now: number, weeks = 22): HeatCell[][] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7);
  const cols: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = dayKey(date.getTime());
      const s = map.get(key) ?? { n: 0, ok: 0 };
      col.push({ key, date, n: s.n, ok: s.ok, level: heatLevel(s.n), future: date.getTime() > today.getTime() });
    }
    cols.push(col);
  }
  return cols;
}

export const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
export const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** Distribuição das fichas por estágio, para o histograma do deck. */
export function stageBuckets(cards: Pick<Card, 'state' | 'interval'>[]): { label: string; count: number }[] {
  const b = [
    { label: 'NOVA', count: 0 },
    { label: 'APR', count: 0 },
    { label: '1 D', count: 0 },
    { label: '7 D', count: 0 },
    { label: '30 D', count: 0 },
    { label: '30 D+', count: 0 },
  ];
  for (const c of cards) {
    if (c.state === 'new') b[0].count++;
    else if (c.state === 'learning') b[1].count++;
    else if (c.interval <= 1) b[2].count++;
    else if (c.interval <= 7) b[3].count++;
    else if (c.interval <= 30) b[4].count++;
    else b[5].count++;
  }
  return b;
}
