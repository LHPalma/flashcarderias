// Lógica pura dos grupos de decks (árvore). Sem acesso a banco, fácil de testar.
import type { Deck, Group } from './db';

export interface GroupNode {
  group: Group;
  children: GroupNode[];
  decks: Deck[];
}

export interface Tree {
  roots: GroupNode[];
  looseDecks: Deck[]; // decks fora de qualquer grupo
}

const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' });

/**
 * Monta a árvore. É tolerante a dados ruins (por exemplo, de um backup antigo ou editado à mão):
 * grupo com pai inexistente ou em ciclo vira raiz, e deck com grupo inexistente fica solto.
 */
export function buildTree(groups: Group[], decks: Deck[]): Tree {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const nodes = new Map<number, GroupNode>(groups.map((g) => [g.id, { group: g, children: [], decks: [] }]));

  const inCycle = (g: Group): boolean => {
    const seen = new Set<number>();
    let cur: Group | undefined = g;
    while (cur) {
      if (seen.has(cur.id)) return true;
      seen.add(cur.id);
      cur = cur.parentId === undefined ? undefined : byId.get(cur.parentId);
    }
    return false;
  };

  const roots: GroupNode[] = [];
  for (const g of groups) {
    const node = nodes.get(g.id)!;
    const parent = g.parentId !== undefined && !inCycle(g) ? nodes.get(g.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }

  const looseDecks: Deck[] = [];
  for (const d of decks) {
    const node = d.groupId === undefined ? undefined : nodes.get(d.groupId);
    (node ? node.decks : looseDecks).push(d);
  }

  const sort = (list: GroupNode[]) => {
    list.sort((a, b) => byName(a.group, b.group));
    list.forEach((n) => {
      n.decks.sort(byName);
      sort(n.children);
    });
  };
  sort(roots);
  looseDecks.sort(byName);
  return { roots, looseDecks };
}

export function subtreeDeckIds(node: GroupNode): number[] {
  return [...node.decks.map((d) => d.id), ...node.children.flatMap(subtreeDeckIds)];
}

export function findNode(roots: GroupNode[], id: number): GroupNode | undefined {
  for (const r of roots) {
    if (r.group.id === id) return r;
    const hit = findNode(r.children, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Nomes do grupo, da raiz até ele. Vazio se `id` for indefinido ou não existir. */
export function groupPath(groups: Group[], id?: number): string[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const out: string[] = [];
  const seen = new Set<number>();
  let cur = id === undefined ? undefined : byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur.name);
    cur = cur.parentId === undefined ? undefined : byId.get(cur.parentId);
  }
  return out;
}

/** O grupo e todos os que estão abaixo dele. */
export function descendantIds(groups: Group[], id: number): Set<number> {
  const out = new Set<number>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const g of groups) {
      if (g.parentId !== undefined && out.has(g.parentId) && !out.has(g.id)) {
        out.add(g.id);
        grew = true;
      }
    }
  }
  return out;
}

export interface GroupOption {
  id: number;
  label: string; // caminho completo, ex.: "Livros / Psicologia"
  depth: number;
}

/** Lista plana em ordem de árvore, para seletores. `exclude` tira esses grupos e tudo abaixo deles. */
export function groupOptions(groups: Group[], exclude?: Set<number>): GroupOption[] {
  const out: GroupOption[] = [];
  const walk = (nodes: GroupNode[], depth: number, trail: string[]) => {
    for (const n of nodes) {
      if (exclude?.has(n.group.id)) continue;
      const path = [...trail, n.group.name];
      out.push({ id: n.group.id, label: path.join(' / '), depth });
      walk(n.children, depth + 1, path);
    }
  };
  walk(buildTree(groups, []).roots, 0, []);
  return out;
}
