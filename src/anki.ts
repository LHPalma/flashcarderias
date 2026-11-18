// Importa e exporta o formato de texto do Anki (campos separados por tab).

export interface ParsedCard {
  front: string;
  back: string;
  tags: string[];
}

export interface ParsedDeck {
  deckName?: string;
  cards: ParsedCard[];
}

/** Converte o HTML simples que o Anki exporta em texto puro. */
export function htmlToText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseAnki(text: string): ParsedDeck {
  const cards: ParsedCard[] = [];
  let deckName: string | undefined;
  let tagCol = 3;
  let html = false;
  let sep = '\t';

  for (const raw of text.replace(/^﻿/, '').replace(/\r/g, '').split('\n')) {
    if (!raw.trim()) continue;
    if (raw.startsWith('#')) {
      const m = raw.match(/^#(\w[\w ]*):(.*)$/);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === 'deck') deckName = val.split('::').pop() || val;
      else if (key === 'tags column') tagCol = parseInt(val, 10) || 3;
      else if (key === 'html') html = val === 'true';
      else if (key === 'separator') {
        if (val === 'comma') sep = ',';
        else if (val === 'semicolon') sep = ';';
        else if (val === 'tab') sep = '\t';
      }
      continue;
    }
    const f = raw.split(sep);
    if (f.length < 2) continue;
    const clean = (s: string) => (html ? htmlToText(s) : s.trim());
    const front = clean(f[0]);
    const back = clean(f[1]);
    if (!front || !back) continue;
    cards.push({ front, back, tags: (f[tagCol - 1] ?? '').trim().split(/\s+/).filter(Boolean) });
  }
  return { deckName, cards };
}

export function toAnki(deckName: string, cards: ParsedCard[]): string {
  const cell = (s: string) => s.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
  const head = ['#separator:tab', '#html:true', `#deck:${deckName}`, '#tags column:3'];
  return head.concat(cards.map((c) => [cell(c.front), cell(c.back), c.tags.join(' ')].join('\t'))).join('\n') + '\n';
}
