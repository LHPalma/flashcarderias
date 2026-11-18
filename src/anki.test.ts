import { describe, expect, it } from 'vitest';
import { htmlToText, parseAnki, toAnki } from './anki';

// Deck de exemplo, só para o teste (conteúdo genérico).
const SAMPLE = [
  '#separator:tab',
  '#html:true',
  '#notetype:Basic',
  '#deck:Idiomas::Francês',
  '#tags column:3',
  'Bonjour<br>(de manhã)\tOlá\tsaudações',
  'Merci\tObrigado\tsaudações cortesia',
  'Frente sem verso',
  '',
].join('\n');

describe('parseAnki', () => {
  it('lê cabeçalho, tags e campos', () => {
    const r = parseAnki('#separator:tab\n#html:true\n#deck:Livros::Meu Livro\n#tags column:3\nP?\tR<br>2\tx y\n');
    expect(r.deckName).toBe('Meu Livro');
    expect(r.cards).toEqual([{ front: 'P?', back: 'R\n2', tags: ['x', 'y'] }]);
  });
  it('ignora linhas vazias ou sem verso', () => {
    expect(parseAnki('só uma coluna\n\n\tvazio\n').cards).toHaveLength(0);
  });
  it('importa um deck com várias fichas e pula a linha sem verso', () => {
    const r = parseAnki(SAMPLE);
    expect(r.deckName).toBe('Francês');
    expect(r.cards).toEqual([
      { front: 'Bonjour\n(de manhã)', back: 'Olá', tags: ['saudações'] },
      { front: 'Merci', back: 'Obrigado', tags: ['saudações', 'cortesia'] },
    ]);
  });
  it('exportar e importar de novo preserva os cartões', () => {
    const cards = [{ front: 'a\tb', back: 'linha1\nlinha2', tags: ['t1'] }];
    const back = parseAnki(toAnki('D', cards));
    expect(back.cards[0]).toEqual({ front: 'a b', back: 'linha1\nlinha2', tags: ['t1'] });
  });
});

describe('htmlToText', () => {
  it('remove tags e decodifica entidades', () => {
    expect(htmlToText('<b>a</b> &amp; b&nbsp;c')).toBe('a & b c');
  });
});
