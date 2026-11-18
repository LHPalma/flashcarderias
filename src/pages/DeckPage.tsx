import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Page';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { CardEditor } from '../components/CardEditor';
import { download, readText, slug } from '../components/files';
import { parseAnki, toAnki } from '../anki';
import { addCards, countCards, db, deleteDeck, getSettings, newStudiedToday, type Card } from '../db';
import { endOfDay, formatDue } from '../srs';
import { stageBuckets } from '../stats';

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

  const deck = useLiveQuery(() => db.decks.get(id), [id]);
  const cards = useLiveQuery(() => db.cards.where('deckId').equals(id).sortBy('id'), [id]);
  const counts = useLiveQuery(async () => {
    const now = Date.now();
    const [list, settings, done] = await Promise.all([db.cards.where('deckId').equals(id).toArray(), getSettings(), newStudiedToday(now, id)]);
    return countCards(list, settings.newPerDay - done, now);
  }, [id]);

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

  if (deck === undefined && cards === undefined) return <Page title="…" backTo="/"><p className="empty">CARREGANDO…</p></Page>;
  if (!deck) return <Page title="Deck" backTo="/"><p className="empty">DECK NÃO ENCONTRADO.</p></Page>;

  const toStudy = counts ? counts.fresh + counts.learning + counts.review : 0;

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
      eyebrow={`DECK // ${String(all.length).padStart(3, '0')} FICHAS`}
      backTo="/"
      status={status}
      actions={
        <button type="button" className="iconkey" aria-label="Opções do deck" onClick={() => { setRename(deck.name); setMenu(true); }}>
          <Icon name="more" />
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="label" style={{ color: 'var(--muted)' }}>Distribuição por estágio</span>
        <div className="hist" role="img" aria-label={buckets.map((b) => `${b.label}: ${b.count}`).join(', ')}>
          {buckets.map((b) => {
            const lit = b.count === 0 ? 0 : Math.max(1, Math.round((b.count / max) * 10));
            return (
              <div key={b.label} className="hist-col">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={'hist-cell' + (10 - i <= lit ? ' on' : '')} />
                ))}
                <span className="hist-num">{String(b.count).padStart(2, '0')}</span>
                <span className="hist-label">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="row nowrap">
        {toStudy > 0 ? (
          <Link className="key flex1" to={`/study/${id}`}>▶ Estudar · {toStudy}</Link>
        ) : (
          <span className="key flex1" aria-disabled="true">Nada para hoje ■</span>
        )}
        <button type="button" className="key outline flex1" onClick={() => openEditor(null)}>[+] Nova ficha</button>
      </div>

      <input className="search" type="search" placeholder="> BUSCAR_" aria-label="Buscar nas fichas" value={query} onChange={(e) => setQuery(e.target.value)} />

      {tags.length > 0 && (
        <div className="chips" role="group" aria-label="Filtrar por tag">
          <button type="button" className="chip" aria-pressed={tag === null} onClick={() => setTag(null)}>Todas {all.length}</button>
          {tags.map(([t, n]) => (
            <button key={t} type="button" className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>{t} {n}</button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="empty">{all.length === 0 ? 'DECK VAZIO. CRIE A PRIMEIRA FICHA.' : 'NENHUMA FICHA ENCONTRADA.'}</p>
      ) : (
        <ul className="cards">
          {shown.map(({ c, n }) => (
            <li key={c.id}>
              <button type="button" className="cardrow" onClick={() => openEditor(c)}>
                <span className="meta">#{String(n).padStart(3, '0')} · {stateLabel(c, now)}{c.tags.length ? ' · ' + c.tags.join(' · ') : ''}</span>
                <span className="q">{c.front}</span>
                <span className="a">&gt; {c.back}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <CardEditor open={editorOpen} deckId={id} card={editing} onClose={() => setEditorOpen(false)} />

      <Modal open={menu} onClose={() => setMenu(false)}>
        <div className="dlg">
          <h2>Opções do deck</h2>
          <form
            className="field"
            onSubmit={(e) => {
              e.preventDefault();
              if (rename.trim()) void db.decks.update(id, { name: rename.trim() }).then(() => setMenu(false));
            }}
          >
            <label htmlFor="rn">Nome</label>
            <div className="row nowrap">
              <input id="rn" value={rename} onChange={(e) => setRename(e.target.value)} style={{ flex: 1, fontSize: 22 }} />
              <button type="submit" className="key">Salvar</button>
            </div>
          </form>
          <div className="row">
            <button type="button" className="key outline flex1" onClick={() => fileRef.current?.click()}>Importar .txt</button>
            <button
              type="button"
              className="key outline flex1"
              onClick={() => download(`${slug(deck.name)}.txt`, toAnki(deck.name, all.map(({ front, back, tags }) => ({ front, back, tags }))))}
            >
              Exportar .txt
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.tsv,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
          <div className="row nowrap">
            <button
              type="button"
              className="key outline"
              onClick={async () => {
                if (!window.confirm(`Excluir o deck "${deck.name}" e todas as suas fichas? Não dá para desfazer.`)) return;
                await deleteDeck(id);
                nav('/');
              }}
            >
              Excluir deck
            </button>
            <button type="button" className="key flex1" onClick={() => setMenu(false)}>Fechar</button>
          </div>
        </div>
      </Modal>
    </Page>
  );
}
