// Contraste das cores dos temas (WCAG). Lê os valores direto do CSS e do mapa de calor, então se alguém
// mudar uma cor e estragar a leitura, este teste acusa. O axe-core não consegue medir texto sobre a trama
// de pontos do fundo, por isso o pior caso (texto exatamente sobre um ponto) é calculado aqui.
import { describe, expect, it } from 'vitest';
import css from './styles.css?raw';
import progress from './pages/ProgressPage.tsx?raw';

const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** `fg` com opacidade `a` sobre `bg`. */
const over = (fg: string, bg: string, a: number) =>
  '#' + rgb(fg).map((v, i) => Math.round(v * a + rgb(bg)[i] * (1 - a)).toString(16).padStart(2, '0')).join('');

// --- temas: cada bloco [data-theme='x'] { --bg: #...; ... }
const themes: Record<string, Record<string, string>> = {};
for (const m of css.matchAll(/\[data-theme='(\w+)'\]\s*\{([^}]*)\}/g)) {
  themes[m[1]] = Object.fromEntries([...m[2].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((v) => [v[1], v[2]]));
}
// --- teclas de resposta: --color-g1: #...; --color-g1-bg: #...;
const grades = Object.fromEntries([...css.matchAll(/--color-(g\d(?:-bg)?):\s*(#[0-9a-fA-F]{6})/g)].map((v) => [v[1], v[2]]));
// --- opacidade da trama de pontos do fundo
const dotPct = Number(css.match(/radial-gradient\(color-mix\(in srgb, var\(--ink\) (\d+)%/)?.[1]);
// --- níveis do mapa de calor: 'bg-pt/[.12]', 'bg-pt/[.45]', ... e por fim 'bg-pt' (cor cheia).
// O primeiro (nível 0) é "sem estudo": é de propósito quase apagado, então não entra na regra dos 3:1.
const [emptyLevel, ...heat] = [...progress.matchAll(/'bg-pt\/\[\.(\d+)\]'/g)].map((m) => Number('0.' + m[1]));

const NAMES = ['amber', 'sage', 'blue', 'wine'];
const TEXT_MIN = 4.5; // texto pequeno
const GRAPHIC_MIN = 3; // elemento gráfico que carrega informação

describe('as cores foram lidas do código', () => {
  it('quatro temas completos, teclas e trama', () => {
    expect(Object.keys(themes).sort()).toEqual([...NAMES].sort());
    for (const n of NAMES) for (const k of ['bg', 'ink', 'muted', 'panel', 'pt', 'pm', 'back']) expect(themes[n][k], `${n} --${k}`).toMatch(/^#[0-9a-f]{6}$/i);
    expect(Object.keys(grades)).toHaveLength(8);
    expect(dotPct).toBeGreaterThan(0);
    expect(emptyLevel).toBeGreaterThan(0);
    expect(heat.length).toBe(3); // níveis 1, 2 e 3 (o 4 é a cor cheia e o 0 é o vazio)
  });
});

describe.each(NAMES)('tema %s: texto', (name) => {
  const t = themes[name];
  const dot = over(t.ink, t.bg, dotPct / 100); // pior caso: texto sobre um ponto da trama

  it('texto principal e secundário sobre o fundo da página, inclusive sobre um ponto da trama', () => {
    expect(ratio(t.ink, t.bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(ratio(t.ink, dot)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(ratio(t.muted, t.bg)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(ratio(t.muted, dot)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it('texto claro sobre o painel escuro (principal e secundário)', () => {
    expect(ratio(t.pt, t.panel)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(ratio(t.pm, t.panel)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it('verso da ficha (escuro sobre o painel claro) e barras (cor do fundo sobre a cor do texto)', () => {
    expect(ratio(t.panel, t.back)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(ratio(t.bg, t.ink)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it('mapa de calor: todo nível que mostra estudo se distingue do painel (3:1)', () => {
    for (const a of [...heat, 1]) expect(ratio(over(t.pt, t.panel, a), t.panel), `nível ${a}`).toBeGreaterThanOrEqual(GRAPHIC_MIN);
  });

  it('os níveis do mapa de calor continuam crescendo', () => {
    const levels = [emptyLevel, ...heat, 1];
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });
});

describe('teclas de resposta (iguais em todos os temas)', () => {
  it.each([1, 2, 3, 4])('g%i: texto sobre o fundo da tecla', (n) => {
    expect(ratio(grades[`g${n}`], grades[`g${n}-bg`])).toBeGreaterThanOrEqual(TEXT_MIN);
  });
});
