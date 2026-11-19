import { describe, expect, it } from 'vitest';
import type { Deck, Group } from './db';
import { buildTree, descendantIds, findNode, groupOptions, groupPath, subtreeDeckIds } from './groups';

const g = (id: number, name: string, parentId?: number): Group => ({ id, name, parentId, createdAt: 0 });
const d = (id: number, name: string, groupId?: number): Deck => ({ id, name, groupId, createdAt: 0 });

const GROUPS = [g(1, 'Livros'), g(2, 'Psicologia', 1), g(3, 'Idiomas'), g(4, 'Francês', 3)];
const DECKS = [d(10, 'O Que o Corpo Fala', 2), d(11, 'Outro livro', 1), d(12, 'Anatomia'), d(13, 'Verbos', 4)];

describe('buildTree', () => {
  const t = buildTree(GROUPS, DECKS);
  it('aninha grupos e decks, em ordem alfabética', () => {
    expect(t.roots.map((n) => n.group.name)).toEqual(['Idiomas', 'Livros']);
    const livros = t.roots[1];
    expect(livros.children.map((n) => n.group.name)).toEqual(['Psicologia']);
    expect(livros.decks.map((x) => x.name)).toEqual(['Outro livro']);
    expect(livros.children[0].decks.map((x) => x.name)).toEqual(['O Que o Corpo Fala']);
  });
  it('deixa decks sem grupo soltos', () => {
    expect(t.looseDecks.map((x) => x.name)).toEqual(['Anatomia']);
  });
  it('junta os decks de todo o subgrupo', () => {
    expect(subtreeDeckIds(findNode(t.roots, 1)!).sort()).toEqual([10, 11]);
    expect(subtreeDeckIds(findNode(t.roots, 4)!)).toEqual([13]);
  });
  it('ordena números de forma natural', () => {
    const tree = buildTree([], [d(1, 'Cap 10'), d(2, 'Cap 2')]);
    expect(tree.looseDecks.map((x) => x.name)).toEqual(['Cap 2', 'Cap 10']);
  });
});

describe('dados ruins', () => {
  it('grupo com pai inexistente vira raiz; deck com grupo inexistente fica solto', () => {
    const t = buildTree([g(1, 'Órfão', 99)], [d(1, 'X', 77)]);
    expect(t.roots.map((n) => n.group.name)).toEqual(['Órfão']);
    expect(t.looseDecks).toHaveLength(1);
  });
  it('quebra ciclos em vez de entrar em loop', () => {
    const t = buildTree([g(1, 'A', 2), g(2, 'B', 1)], []);
    expect(t.roots).toHaveLength(2);
    expect(t.roots.every((n) => n.children.length === 0)).toBe(true);
    expect(groupPath([g(1, 'A', 2), g(2, 'B', 1)], 1).length).toBeLessThanOrEqual(2);
  });
});

describe('caminhos e seleção', () => {
  it('groupPath vai da raiz até o grupo', () => {
    expect(groupPath(GROUPS, 2)).toEqual(['Livros', 'Psicologia']);
    expect(groupPath(GROUPS, undefined)).toEqual([]);
    expect(groupPath(GROUPS, 999)).toEqual([]);
  });
  it('descendantIds inclui o próprio grupo e tudo abaixo', () => {
    expect([...descendantIds(GROUPS, 1)].sort()).toEqual([1, 2]);
    expect([...descendantIds(GROUPS, 4)]).toEqual([4]);
  });
  it('groupOptions lista em ordem de árvore com caminho completo', () => {
    expect(groupOptions(GROUPS).map((o) => [o.label, o.depth])).toEqual([
      ['Idiomas', 0],
      ['Idiomas / Francês', 1],
      ['Livros', 0],
      ['Livros / Psicologia', 1],
    ]);
  });
  it('groupOptions pode excluir um grupo e seus descendentes (para mover sem criar ciclo)', () => {
    expect(groupOptions(GROUPS, descendantIds(GROUPS, 1)).map((o) => o.id)).toEqual([3, 4]);
  });
});
