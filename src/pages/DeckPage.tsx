import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Page';
import { DIALOG_BODY, DIALOG_TITLE, Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { CardEditor } from '../components/CardEditor';
import { GroupSelect } from '../components/GroupSelect';
import { FIELD_LABEL, ICON_KEY, Label, keyCls } from '../components/ui';
import { download, readText, slug } from '../components/files';
import { parseAnki, toAnki } from '../anki';
import { addCards, countCards, db, deleteDeck, getSettings, moveDeck, newStudiedToday, type Card } from '../db';
import { groupPath } from '../groups';
import { endOfDay, formatDue } from '../srs';
import { stageBuckets } from '../stats';
import { useTick } from '../hooks';

const CHIP =
  'min-h-9 rounded-lg leading-[normal] border-2 border-panel bg-transparent px-2.5 py-1.5 text-[12px] uppercase tracking-[0.06em] text-ink aria-pressed:bg-panel aria-pressed:text-pt';

function stateLabel(c: Card, now: number): string {
  if (c.state === 'new') return 'NOVA';
  if (c.state === 'learning') return 'APRENDENDO';
  return c.due <= endOfDay(now) ? 'REVISAR HOJE' : `REVISÃO EM ${formatDue(c.due, now).toUpperCase()}`;
}

export function DeckPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Card | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState('');
  const [status, setStatus] = useState('');

  const tick = useTick(); // fichas em aprendizado vencem com o tempo: recontar de vez em quando
  const deck = useLiveQuery(() => db.decks.get(id), [id]);
  const groups = useLiveQuery(() => db.groups.toArray(), []) ?? [];
  const cards = useLiveQuery(() => db.cards.where('deckId').equals(id).sortBy('id'), [id]);
  const counts = useLiveQuery(async () => {
    const now = Date.now();
    const [list, settings, done] = await Promise.all([db.cards.where('deckId').equals(id).toArray(), getSettings(), newStudiedToday(now, id)]);
    return countCards(list, settings.newPerDay - done, now);
  }, [id, tick]);

  const all = cards ?? [];
  const now = Date.now();

  const tags = useMemo(() => {
    const count = new Map<string, number>();
    all.forEach((c) => c.tags.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1)));
    // tags presentes em todas as fichas não ajudam a filtrar
    return [...count].filter(([, n]) => all.length < 2 || n < all.length).sort((a, b) => b[1] - a[1]);
  }, [all]);

  const buckets = stageBuckets(all);
  const max = Math.max(1, ...buckets.map((b) => b.count));

  const q = query.trim().toLowerCase();
  const shown = all
    .map((c, i) => ({ c, n: i + 1 }))
    .filter(({ c }) => (!tag || c.tags.includes(tag)) && (!q || (c.front + ' ' + c.back).toLowerCase().includes(q)));

  if (deck === undefined && cards === undefined) return <Page title="…" backTo="/"><p className="py-6 text-center uppercase text-muted">Carregando…</p></Page>;
  if (!deck) return <Page title="Deck" backTo="/"><p className="py-6 text-center uppercase text-muted">Deck não encontrado.</p></Page>;

  const toStudy = counts ? counts.fresh + counts.learning + counts.review : 0;
  const path = groupPath(groups, deck.groupId); // grupos acima deste deck, da raiz até o mais próximo

  function openEditor(c: Card | null) {
    setEditing(c);
    setEditorOpen(true);
  }

  async function importFile(file: File) {
    const parsed = parseAnki(await readText(file));
    if (!parsed.cards.length) {
      setStatus(`Não encontrei fichas em ${file.name}.`);
      return;
    }
    const n = await addCards(id, parsed.cards);
    setStatus(`${n} fichas novas de ${file.name}${n < parsed.cards.length ? ` (${parsed.cards.length - n} já existiam)` : ''}.`);
    setMenu(false);
  }

  return (
    <Page
      title={deck.name}
      small
      eyebrow={`${path.length ? path.join(' / ') : 'DECK'} // ${String(all.length).padStart(3, '0')} FICHAS`}
      backTo="/"
      status={status}
      actions={
        <button type="button" className={ICON_KEY} aria-label="Opções do deck" onClick={() => { setRename(deck.name); setMenu(true); }}>
          <Icon name="more" />
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <Label>Distribuição por estágio</Label>
        <div className="flex justify-between gap-2" role="img" aria-label={buckets.map((b) => `${b.label}: ${b.count}`).join(', ')}>
          {buckets.map((b) => {
            const lit = b.count === 0 ? 0 : Math.max(1, Math.round((b.count / max) * 10));
            return (
              <div key={b.label} className="flex min-w-0 flex-1 basis-0 flex-col items-center gap-[3px]">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={`h-[11px] w-full max-w-[38px] ${10 - i <= lit ? 'bg-ink' : 'bg-ink/[.16]'}`} />
                ))}
                <span className="mt-1 font-lcd text-[24px] leading-none">{String(b.count).padStart(2, '0')}</span>
                <span className="whitespace-nowrap text-[11px] tracking-[0.08em] text-muted">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        {toStudy > 0 ? (
          <Link className={keyCls('solid', 'flex-1')} to={`/study/${id}`}>▶ Estudar · {toStudy}</Link>
        ) : (
          <span className={keyCls('solid', 'flex-1')} aria-disabled="true">Nada para hoje ■</span>
        )}
        <button type="button" className={keyCls('outline', 'flex-1')} onClick={() => openEditor(null)}>[+] Nova ficha</button>
      </div>

      <input
        className="min-h-11 w-full rounded-[10px] border-2 border-panel bg-panel px-3.5 font-mono text-[16px] leading-[normal] tracking-[0.08em] text-pt placeholder:text-pm"
        type="search"
        placeholder="> BUSCAR_"
        aria-label="Buscar nas fichas"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tag">
          <button type="button" className={CHIP} aria-pressed={tag === null} onClick={() => setTag(null)}>Todas {all.length}</button>
          {tags.map(([t, n]) => (
            <button key={t} type="button" className={CHIP} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>{t} {n}</button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-6 text-center uppercase text-muted">{all.length === 0 ? 'Deck vazio. Crie a primeira ficha.' : 'Nenhuma ficha encontrada.'}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {shown.map(({ c, n }) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-1.5 rounded-[10px] border-2 border-panel bg-page px-3.5 py-3 text-left hover:bg-[color-mix(in_srgb,var(--bg)_90%,var(--ink))]"
                onClick={() => openEditor(c)}
              >
                <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
                  #{String(n).padStart(3, '0')} · {stateLabel(c, now)}{c.tags.length ? ' · ' + c.tags.join(' · ') : ''}
                </span>
                <span className="font-lcd text-[24px] uppercase leading-[1.05] break-words whitespace-pre-wrap">{c.front}</span>
                <span className="line-clamp-3 text-[14px] break-words whitespace-pre-wrap">&gt; {c.back}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <CardEditor open={editorOpen} deckId={id} card={editing} onClose={() => setEditorOpen(false)} />

      <Modal open={menu} onClose={() => setMenu(false)}>
        <div className={DIALOG_BODY}>
          <h2 className={DIALOG_TITLE}>Opções do deck</h2>
          <form
            className="flex flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (rename.trim()) void db.decks.update(id, { name: rename.trim() }).then(() => setMenu(false));
            }}
          >
            <label htmlFor="rn" className={FIELD_LABEL}>Nome</label>
            <div className="flex gap-2">
              <input
                id="rn"
                className="min-h-12 min-w-0 flex-1 rounded-[10px] border-0 bg-panel px-3 py-2.5 font-lcd text-[22px] leading-[1.05] text-pt"
                value={rename}
                onChange={(e) => setRename(e.target.value)}
              />
              <button type="submit" className={keyCls('solid')}>Salvar</button>
            </div>
          </form>
          <GroupSelect label="Grupo" groups={groups} value={deck.groupId} onChange={(g) => void moveDeck(id, g)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={keyCls('outline', 'flex-1')} onClick={() => fileRef.current?.click()}>Importar .txt</button>
            <button
              type="button"
              className={keyCls('outline', 'flex-1')}
              onClick={() => download(`${slug(deck.name)}.txt`, toAnki([...path, deck.name].join('::'), all.map(({ front, back, tags }) => ({ front, back, tags }))))}
            >
              Exportar .txt
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.tsv,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
          <div className="flex gap-2">
            <button
              type="button"
              className={keyCls('outline')}
              onClick={async () => {
                if (!window.confirm(`Excluir o deck "${deck.name}" e todas as suas fichas? Não dá para desfazer.`)) return;
                await deleteDeck(id);
                nav('/');
              }}
            >
              Excluir deck
            </button>
            <button type="button" className={keyCls('solid', 'flex-1')} onClick={() => setMenu(false)}>Fechar</button>
          </div>
        </div>
      </Modal>
    </Page>
  );
}
