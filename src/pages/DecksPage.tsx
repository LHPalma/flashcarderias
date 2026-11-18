import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Page';
import { DIALOG_BODY, DIALOG_TITLE, Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Seg } from '../components/Seg';
import { FIELD_INPUT, FIELD_LABEL, ICON_KEY, Label, Panel, keyCls } from '../components/ui';
import { readText } from '../components/files';
import { parseAnki } from '../anki';
import { addCards, countCards, createDeck, db, getSettings, newStudiedToday } from '../db';

export function DecksPage() {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useLiveQuery(async () => {
    const now = Date.now();
    const [decks, cards, settings] = await Promise.all([db.decks.toArray(), db.cards.toArray(), getSettings()]);
    return Promise.all(
      decks.map(async (deck) => {
        const budget = settings.newPerDay - (await newStudiedToday(now, deck.id));
        return { deck, counts: countCards(cards.filter((c) => c.deckId === deck.id), budget, now) };
      }),
    );
  }, []);

  async function create() {
    await createDeck(name);
    setName('');
    setCreating(false);
  }

  async function importFile(file: File) {
    const parsed = parseAnki(await readText(file));
    if (!parsed.cards.length) {
      setStatus(`Não encontrei fichas em ${file.name}. Use um .txt do Anki com campos separados por tab.`);
      return;
    }
    const id = await createDeck(parsed.deckName ?? file.name.replace(/\.\w+$/, ''));
    const n = await addCards(id, parsed.cards);
    setStatus(`Deck criado com ${n} fichas.`);
  }

  const list = rows ?? [];
  const todayTotal = list.reduce((s, r) => s + r.counts.fresh + r.counts.learning + r.counts.review, 0);

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
        <button type="button" className={keyCls('solid', 'flex-1')} onClick={() => setCreating(true)}>[+] Novo deck</button>
        <button type="button" className={keyCls('outline', 'flex-1')} onClick={() => fileRef.current?.click()}>Importar Anki</button>
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

      {rows && list.length === 0 && <p className="py-6 text-center uppercase text-muted">Nenhum deck ainda. Crie um ou importe do Anki.</p>}

      <div className="flex flex-col gap-2.5">
        {list.map(({ deck, counts }) => {
          const work = counts.fresh + counts.learning + counts.review;
          return (
            <Panel key={deck.id}>
              <div className="flex items-baseline justify-between gap-2">
                <Link className="text-[17px] uppercase tracking-[0.06em] no-underline break-words" to={`/deck/${deck.id}`}>{deck.name}</Link>
                <span className="whitespace-nowrap text-[12px] text-pm">{String(counts.total).padStart(3, '0')} FICHAS</span>
              </div>
              {work > 0 ? (
                <>
                  <div className="flex flex-wrap gap-[22px]">
                    <div className="flex flex-col gap-0.5"><Label tone="panel">Novos</Label><Seg value={counts.fresh} onPanel /></div>
                    <div className="flex flex-col gap-0.5"><Label tone="panel">Aprendendo</Label><Seg value={counts.learning} onPanel /></div>
                    <div className="flex flex-col gap-0.5"><Label tone="panel">Revisar</Label><Seg value={counts.review} onPanel /></div>
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
                    <Label tone="panel">{counts.total === 0 ? 'Deck vazio' : 'Em dia hoje ■'}</Label>
                    <Link className={keyCls('litOutline')} to={`/deck/${deck.id}`}>Fichas</Link>
                  </div>
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <div className="mt-auto" />
      {todayTotal > 0 && (
        <Link className={keyCls('bar')} to="/study/all">▶ Estudar tudo · {String(todayTotal).padStart(3, '0')} hoje</Link>
      )}

      <Modal open={creating} onClose={() => setCreating(false)}>
        <form className={DIALOG_BODY} onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <h2 className={DIALOG_TITLE}>Novo deck</h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="deck-name" className={FIELD_LABEL}>Nome</label>
            <input id="deck-name" className={`${FIELD_INPUT} min-h-12`} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Inglês, Anatomia…" />
          </div>
          <div className="flex gap-2">
            <button type="button" className={keyCls('outline', 'flex-1')} onClick={() => setCreating(false)}>Cancelar</button>
            <button type="submit" className={keyCls('solid', 'flex-1')}>Criar ▮</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
