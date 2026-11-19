import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Page';
import { Icon } from '../components/Icon';
import { Seg } from '../components/Seg';
import { EditGroupDialog, NewDeckDialog, NewGroupDialog } from '../components/GroupDialogs';
import { ICON_KEY, ICON_KEY_LINE, Label, Panel, keyCls } from '../components/ui';
import { readText } from '../components/files';
import { parseAnki } from '../anki';
import { addCards, countCards, createDeck, db, ensureGroupPath, getSettings, newStudiedToday, type Deck, type DeckCounts, type Group } from '../db';
import { buildTree, subtreeDeckIds, type GroupNode } from '../groups';
import { useCollapsed } from '../hooks';

type CountsByDeck = Map<number, DeckCounts>;
const todo = (c?: DeckCounts) => (c ? c.fresh + c.learning + c.review : 0);

export function DecksPage() {
  const [status, setStatus] = useState('');
  const [newDeck, setNewDeck] = useState<{ open: boolean; groupId?: number }>({ open: false });
  const [newGroup, setNewGroup] = useState<{ open: boolean; parentId?: number }>({ open: false });
  const [editing, setEditing] = useState<Group | null>(null);
  const [collapsed, toggle] = useCollapsed();
  const fileRef = useRef<HTMLInputElement>(null);

  const data = useLiveQuery(async () => {
    const now = Date.now();
    const [groups, decks, cards, settings] = await Promise.all([db.groups.toArray(), db.decks.toArray(), db.cards.toArray(), getSettings()]);
    const counts: CountsByDeck = new Map();
    await Promise.all(
      decks.map(async (deck) => {
        const budget = settings.newPerDay - (await newStudiedToday(now, deck.id));
        counts.set(deck.id, countCards(cards.filter((c) => c.deckId === deck.id), budget, now));
      }),
    );
    return { groups, decks, counts };
  }, []);

  async function importFile(file: File) {
    const parsed = parseAnki(await readText(file));
    if (!parsed.cards.length) {
      setStatus(`Não encontrei fichas em ${file.name}. Use um .txt do Anki com campos separados por tab.`);
      return;
    }
    // "Livros::Psicologia::Meu Livro" vira o grupo Livros, dentro dele Psicologia, e o deck Meu Livro.
    const path = parsed.deckPath ?? [file.name.replace(/\.\w+$/, '')];
    const groupPath = path.slice(0, -1);
    const groupId = await ensureGroupPath(groupPath);
    const id = await createDeck(path[path.length - 1], groupId);
    const n = await addCards(id, parsed.cards);
    setStatus(`Deck criado${groupPath.length ? ` em ${groupPath.join(' / ')}` : ''} com ${n} fichas.`);
  }

  const groups = data?.groups ?? [];
  const decks = data?.decks ?? [];
  const counts = data?.counts ?? new Map<number, DeckCounts>();
  const tree = buildTree(groups, decks);
  const todayTotal = decks.reduce((s, d) => s + todo(counts.get(d.id)), 0);
  const empty = data && groups.length === 0 && decks.length === 0;

  return (
    <Page
      title="Meus decks"
      eyebrow="FLASHCARDS // MEM-01"
      status={status}
      actions={
        <>
          <Link className={ICON_KEY} to="/progress" aria-label="Progresso"><Icon name="grid" /></Link>
          <Link className={ICON_KEY} to="/settings" aria-label="Configurações"><Icon name="sliders" /></Link>
        </>
      }
    >
      <div className="flex gap-2">
        <button type="button" className={keyCls('solid', 'flex-1', 'compact')} onClick={() => setNewDeck({ open: true })}>[+] Deck</button>
        <button type="button" className={keyCls('solid', 'flex-1', 'compact')} onClick={() => setNewGroup({ open: true })}>[+] Grupo</button>
        <button type="button" className={keyCls('outline', 'flex-1', 'compact')} aria-label="Importar do Anki" onClick={() => fileRef.current?.click()}>Importar</button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.tsv,.csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {empty && (
        <p className="py-6 text-center uppercase text-muted">
          Nenhum deck ainda. Crie um deck ou um grupo, ou importe do Anki.
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {tree.roots.map((n) => (
          <GroupBlock key={n.group.id} node={n} counts={counts} collapsed={collapsed} onToggle={toggle} onOptions={setEditing} />
        ))}
        {tree.looseDecks.map((d) => (
          <DeckPanel key={d.id} deck={d} counts={counts.get(d.id)} />
        ))}
      </div>

      <div className="mt-auto" />
      {todayTotal > 0 && (
        <Link className={keyCls('bar')} to="/study/all">▶ Estudar tudo · {String(todayTotal).padStart(3, '0')} hoje</Link>
      )}

      <NewDeckDialog open={newDeck.open} groupId={newDeck.groupId} groups={groups} onClose={() => setNewDeck({ open: false })} />
      <NewGroupDialog open={newGroup.open} parentId={newGroup.parentId} groups={groups} onClose={() => setNewGroup({ open: false })} />
      <EditGroupDialog
        open={editing !== null}
        group={editing}
        groups={groups}
        onClose={() => setEditing(null)}
        onNewSub={(parentId) => setNewGroup({ open: true, parentId })}
        onNewDeck={(groupId) => setNewDeck({ open: true, groupId })}
      />
    </Page>
  );
}

/** Um grupo: caixa de contorno que guarda subgrupos e decks. Pode ser fechada. */
function GroupBlock({
  node,
  counts,
  collapsed,
  onToggle,
  onOptions,
}: {
  node: GroupNode;
  counts: CountsByDeck;
  collapsed: Set<number>;
  onToggle: (id: number) => void;
  onOptions: (g: Group) => void;
}) {
  const { group } = node;
  const open = !collapsed.has(group.id);
  const ids = subtreeDeckIds(node);
  const due = ids.reduce((s, id) => s + todo(counts.get(id)), 0);
  const empty = node.children.length === 0 && node.decks.length === 0;

  return (
    <section className="flex flex-col gap-2.5 rounded-xl border-2 border-panel bg-page p-2.5" aria-label={`Grupo ${group.name}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
          onClick={() => onToggle(group.id)}
        >
          <span aria-hidden="true" className="w-3 flex-none text-[15px]">{open ? '▾' : '▸'}</span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[17px] uppercase tracking-[0.06em] break-words">{group.name}</span>
            <span className="text-[12px] uppercase tracking-[0.08em] text-muted">
              {ids.length} {ids.length === 1 ? 'deck' : 'decks'}{due > 0 ? ` · ${String(due).padStart(3, '0')} hoje` : ''}
            </span>
          </span>
        </button>
        <button type="button" className={ICON_KEY_LINE} aria-label={`Opções do grupo ${group.name}`} onClick={() => onOptions(group)}>
          <Icon name="more" />
        </button>
      </div>

      {open && (
        <>
          {node.children.map((c) => (
            <GroupBlock key={c.group.id} node={c} counts={counts} collapsed={collapsed} onToggle={onToggle} onOptions={onOptions} />
          ))}
          {node.decks.map((d) => (
            <DeckPanel key={d.id} deck={d} counts={counts.get(d.id)} />
          ))}
          {empty && <p className="text-[13px] text-muted">Grupo vazio. Use ⋯ para criar um deck ou um subgrupo aqui.</p>}
          {due > 0 && (
            <Link className={keyCls('solid')} to={`/study/g${group.id}`}>▶ Estudar grupo · {String(due).padStart(3, '0')}</Link>
          )}
        </>
      )}
    </section>
  );
}

/** Painel escuro de um deck, com as contagens do dia. */
function DeckPanel({ deck, counts }: { deck: Deck; counts?: DeckCounts }) {
  const c = counts ?? { total: 0, fresh: 0, learning: 0, review: 0 };
  const work = todo(c);
  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-2">
        <Link className="text-[17px] uppercase tracking-[0.06em] no-underline break-words" to={`/deck/${deck.id}`}>{deck.name}</Link>
        <span className="whitespace-nowrap text-[12px] text-pm">{String(c.total).padStart(3, '0')} FICHAS</span>
      </div>
      {work > 0 ? (
        <>
          <div className="flex flex-wrap gap-[22px]">
            <div className="flex flex-col gap-0.5"><Label tone="panel">Novos</Label><Seg value={c.fresh} onPanel /></div>
            <div className="flex flex-col gap-0.5"><Label tone="panel">Aprendendo</Label><Seg value={c.learning} onPanel /></div>
            <div className="flex flex-col gap-0.5"><Label tone="panel">Revisar</Label><Seg value={c.review} onPanel /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className={keyCls('lit')} to={`/study/${deck.id}`}>▶ Estudar</Link>
            <Link className={keyCls('litOutline')} to={`/deck/${deck.id}`}>Fichas</Link>
          </div>
        </>
      ) : (
        <div className="flex min-h-11 items-center justify-between gap-3">
          <Seg value={0} digits={3} onPanel />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Label tone="panel">{c.total === 0 ? 'Deck vazio' : 'Em dia hoje ■'}</Label>
            <Link className={keyCls('litOutline')} to={`/deck/${deck.id}`}>Fichas</Link>
          </div>
        </div>
      )}
    </Panel>
  );
}
