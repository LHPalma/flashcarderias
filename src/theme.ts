import type { ThemeId } from './db';

// As cores de cada tema ficam no CSS ([data-theme="…"]); aqui só o que o JS precisa.
export const THEMES: { id: ThemeId; label: string; bg: string; panel: string }[] = [
  { id: 'amber', label: 'ÂMBAR', bg: '#eba83f', panel: '#1e1204' },
  { id: 'sage', label: 'SÁLVIA', bg: '#98ab8a', panel: '#10150f' },
  { id: 'blue', label: 'AZUL', bg: '#8fb7d9', panel: '#07111d' },
  { id: 'wine', label: 'VINHO', bg: '#d8ccb2', panel: '#2a1213' },
];

const KEY = 'fc.theme';

export function storedTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY);
    if (v && THEMES.some((t) => t.id === v)) return v as ThemeId;
  } catch {
    /* localStorage pode estar bloqueado */
  }
  return 'amber';
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignora */
  }
}
