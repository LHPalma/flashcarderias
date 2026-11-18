import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Page';
import { Icon } from '../components/Icon';
import { buildQueue, db, gradeCard, type Card } from '../db';
import { GRADES, GRADE_LABEL, MIN, previewLabels, type Grade } from '../srs';

interface Session {
  queue: number[]; // o primeiro é a ficha da vez
  cards: Map<number, Card>;
  total: number;
  finished: number;
  tally: Record<Grade, number>;
  missed: number[];
}

const LEVELS: Record<Grade, number> = { 1: 1, 2: 2, 3: 3, 4: 4 };

export function StudyPage() {
  const param = useParams().id;
  const deckId = param === 'all' ? undefined : Number(param);
  const deck = useLiveQuery(() => (deckId === undefined ? undefined : db.decks.get(deckId)), [deckId]);
  const [session, setSession] = useState<Session | null>(null);
  const [flipped, setFlipped] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const queue = await buildQueue(deckId, Date.now());
      const list = await db.cards.bulkGet(queue);
      if (!alive) return;
      const cards = new Map<number, Card>();
      list.forEach((c) => c && cards.set(c.id, c));
      setSession({ queue, cards, total: queue.length, finished: 0, tally: { 1: 0, 2: 0, 3: 0, 4: 0 }, missed: [] });
    })();
    return () => { alive = false; };
  }, [deckId]);

  const current = session && session.queue.length > 0 ? session.cards.get(session.queue[0]) ?? null : null;
  const labels = useMemo(() => (current ? previewLabels(current, Date.now()) : null), [current, flipped]);

  async function grade(g: Grade) {
    if (!session || !current || busy.current) return;
    busy.current = true;
    try {
      const now = Date.now();
      const updated = await gradeCard(current.id, g, now);
      setSession((s) => {
        if (!s) return s;
        const cards = new Map(s.cards).set(updated.id, updated);
        const rest = s.queue.slice(1);
        // Fichas ainda em aprendizado e com prazo curto voltam ao fim da fila desta sessão.
        const again = updated.state === 'learning' && updated.due - now < 20 * MIN;
        const queue = again ? [...rest, updated.id] : rest;
        return {
          ...s,
          cards,
          queue,
          finished: s.finished + (again ? 0 : 1),
          tally: { ...s.tally, [g]: s.tally[g] + 1 },
          missed: g === 1 && !s.missed.includes(updated.id) ? [...s.missed, updated.id] : s.missed,
        };
      });
      setFlipped(false);
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!flipped && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && /^[1-4]$/.test(e.key)) {
        void grade(Number(e.key) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const title = deckId === undefined ? 'TODOS OS DECKS' : deck?.name ?? '…';
  const back = deckId === undefined ? '/' : `/deck/${deckId}`;
  const leave = (
    <Link className="iconkey" to={back} aria-label="Sair do estudo"><Icon name="close" /></Link>
  );

  if (!session) return <Shell title={title} leave={leave}><p className="empty">CARREGANDO…</p></Shell>;

  if (session.total === 0) {
    return (
      <Shell title={title} leave={leave}>
        <p className="empty">NADA PARA ESTUDAR AGORA ■</p>
        <Link className="key bar" to="/">Voltar aos decks</Link>
      </Shell>
    );
  }

  if (!current) {
    const t = session.tally;
    const sum = t[1] + t[2] + t[3] + t[4];
    const pct = sum ? Math.round(((t[3] + t[4]) / sum) * 100) : 0;
    return (
      <Shell title={title} leave={leave}>
        <section className="panel" style={{ gap: 14 }}>
          <span className="label">Sessão concluída</span>
          <div><span className="seg big"><span className="ghost" aria-hidden="true">888</span><span className="val">{String(pct).padStart(3, '0')}</span></span></div>
          <span className="label">% de acerto em {sum} revisões</span>
          <div className="row">
            {GRADES.map((g) => (
              <span key={g} className="label" style={{ color: `var(--g${g})` }}>{GRADE_LABEL[g]} {t[g]}</span>
            ))}
          </div>
          {session.missed.length > 0 && (
            <>
              <span className="label">Fichas que você errou ({session.missed.length})</span>
              <ul className="summary-list">
                {session.missed.map((cid) => <li key={cid}>{session.cards.get(cid)?.front}</li>)}
              </ul>
            </>
          )}
        </section>
        <div className="spacer" />
        <Link className="key bar" to={back}>▶ Concluir</Link>
      </Shell>
    );
  }

  const remaining = session.queue.map((cid) => session.cards.get(cid)?.state);
  const n = remaining.filter((s) => s === 'new').length;
  const a = remaining.filter((s) => s === 'learning').length;
  const r = remaining.filter((s) => s === 'review').length;
  const lit = Math.round((session.finished / session.total) * 10);
  const pos = Math.min(session.finished + 1, session.total);
  const tag = current.tags[current.tags.length - 1] ?? '';

  return (
    <Shell title={title} leave={leave}>
      <div className="progress">
        <span>{String(pos).padStart(2, '0')}/{String(session.total).padStart(2, '0')}</span>
        <div className="segbar" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < Math.max(1, lit) ? 'on' : ''} />)}
        </div>
        <span>N{String(n).padStart(2, '0')} A{String(a).padStart(2, '0')} R{String(r).padStart(2, '0')}</span>
      </div>

      {!flipped ? (
        <>
          <button type="button" className="studycard front" onClick={() => setFlipped(true)}>
            <span className="side" style={{ width: '100%' }}><span>Frente</span><span>{tag}</span></span>
            <span className="text">{current.front}</span>
            <span className="tip">TOQUE PARA VER A RESPOSTA █</span>
          </button>
          <button type="button" className="key bar" onClick={() => setFlipped(true)}>▶ Mostrar resposta</button>
        </>
      ) : (
        <>
          <div className="studycard back" aria-live="polite">
            <div className="side"><span>Verso</span><span>{tag}</span></div>
            <div>
              <p className="ask">&gt; {current.front}</p>
              <div className="text">{current.back}</div>
            </div>
            <div className="tip">QUÃO BEM VOCÊ LEMBROU?</div>
          </div>
          <div className="grades" role="group" aria-label="Quão bem você lembrou">
            {GRADES.map((g) => (
              <button key={g} type="button" className={`grade g${g}`} onClick={() => void grade(g)} aria-keyshortcuts={String(g)}>
                {GRADE_LABEL[g]}
                <span className="when">{labels?.[g].toUpperCase()}</span>
                <span className="lv" aria-hidden="true">
                  {[1, 2, 3, 4].map((i) => <i key={i} className={i <= LEVELS[g] ? 'on' : ''} />)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ title, leave, children }: { title: string; leave: React.ReactNode; children: React.ReactNode }) {
  return (
    <Page eyebrow="ESTUDANDO" title={title} small actions={leave}>
      {children}
    </Page>
  );
}
