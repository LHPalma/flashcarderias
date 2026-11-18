import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Page';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { Seg } from '../components/Seg';
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
          <Link className="iconkey" to="/progress" aria-label="Progresso"><Icon name="grid" /></Link>
          <Link className="iconkey" to="/settings" aria-label="Configurações"><Icon name="sliders" /></Link>
        </>
      }
    >
      <div className="row nowrap">
        <button type="button" className="key flex1" onClick={() => setCreating(true)}>[+] Novo deck</button>
        <button type="button" className="key outline flex1" onClick={() => fileRef.current?.click()}>Importar Anki</button>
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

      {rows && list.length === 0 && <p className="empty">NENHUM DECK AINDA. CRIE UM OU IMPORTE DO ANKI.</p>}

      <div className="decks">
        {list.map(({ deck, counts }) => {
          const work = counts.fresh + counts.learning + counts.review;
          return (
            <section key={deck.id} className="panel">
              <div className="deck-head">
                <Link className="deck-name" to={`/deck/${deck.id}`}>{deck.name}</Link>
                <span className="deck-count pm">{String(counts.total).padStart(3, '0')} FICHAS</span>
              </div>
              {work > 0 ? (
                <>
                  <div className="meters">
                    <div className="meter"><span className="label">Novos</span><Seg value={counts.fresh} /></div>
                    <div className="meter"><span className="label">Aprendendo</span><Seg value={counts.learning} /></div>
                    <div className="meter"><span className="label">Revisar</span><Seg value={counts.review} /></div>
                  </div>
                  <div className="row">
                    <Link className="key" to={`/study/${deck.id}`}>▶ Estudar</Link>
                    <Link className="key outline" to={`/deck/${deck.id}`}>Fichas</Link>
                  </div>
                </>
              ) : (
                <div className="idle">
                  <Seg value={0} digits={3} />
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <span className="label pm">{counts.total === 0 ? 'Deck vazio' : 'Em dia hoje ■'}</span>
                    <Link className="key outline" to={`/deck/${deck.id}`}>Fichas</Link>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="spacer" />
      {todayTotal > 0 && (
        <Link className="key bar" to="/study/all">▶ Estudar tudo · {String(todayTotal).padStart(3, '0')} hoje</Link>
      )}

      <Modal open={creating} onClose={() => setCreating(false)}>
        <form className="dlg" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <h2>Novo deck</h2>
          <div className="field">
            <label htmlFor="deck-name">Nome</label>
            <input id="deck-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Inglês, Anatomia…" />
          </div>
          <div className="row nowrap">
            <button type="button" className="key outline flex1" onClick={() => setCreating(false)}>Cancelar</button>
            <button type="submit" className="key flex1">Criar ▮</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
