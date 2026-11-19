import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Page';
import { Icon } from '../components/Icon';
import { Seg } from '../components/Seg';
import { ICON_KEY, Label, Panel, keyCls } from '../components/ui';
import { buildQueue, db, gradeCard, type Card } from '../db';
import { buildTree, findNode, subtreeDeckIds } from '../groups';
import { useSettings } from '../hooks';
import { formatCountdown, pickNext, type Next } from '../session';
import { GRADES, GRADE_LABEL, MIN, previewLabels, type Grade } from '../srs';

interface Session {
  queue: number[]; // o primeiro é a ficha da vez
  cards: Map<number, Card>;
  total: number;
  finished: number;
  tally: Record<Grade, number>;
  missed: number[];
}

// Classes completas (o Tailwind só gera o que aparece escrito por inteiro no código).
const GRADE_STYLE: Record<Grade, { key: string; on: string; off: string; text: string }> = {
  1: { key: 'border-g1 bg-g1-bg text-g1', on: 'bg-g1', off: 'bg-g1/25', text: 'text-g1' },
  2: { key: 'border-g2 bg-g2-bg text-g2', on: 'bg-g2', off: 'bg-g2/25', text: 'text-g2' },
  3: { key: 'border-g3 bg-g3-bg text-g3', on: 'bg-g3', off: 'bg-g3/25', text: 'text-g3' },
  4: { key: 'border-g4 bg-g4-bg text-g4', on: 'bg-g4', off: 'bg-g4/25', text: 'text-g4' },
};

const CARD_BASE = 'flex min-h-[260px] w-full max-h-[470px] flex-1 flex-col justify-between gap-3.5 rounded-2xl p-5 text-left';
const CARD_TEXT = 'font-lcd uppercase leading-[1.02] break-words whitespace-pre-wrap text-balance';

export function StudyPage() {
  // Rota: "all" (tudo), "g12" (o grupo 12 e tudo dentro dele) ou "5" (o deck 5).
  const param = useParams().id ?? 'all';
  const groupId = /^g\d+$/.test(param) ? Number(param.slice(1)) : undefined;
  const deckId = param === 'all' || groupId !== undefined ? undefined : Number(param);
  const deck = useLiveQuery(() => (deckId === undefined ? undefined : db.decks.get(deckId)), [deckId]);
  const group = useLiveQuery(() => (groupId === undefined ? undefined : db.groups.get(groupId)), [groupId]);
  const [session, setSession] = useState<Session | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [ahead, setAhead] = useState(false); // "Estudar agora": adianta uma ficha que ainda estava esperando o prazo
  const [, setTick] = useState(0); // só para redesenhar a contagem regressiva a cada segundo
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let scope: number[] | undefined; // undefined = todos os decks
      if (groupId !== undefined) {
        const [groups, decks] = await Promise.all([db.groups.toArray(), db.decks.toArray()]);
        const node = findNode(buildTree(groups, decks).roots, groupId);
        scope = node ? subtreeDeckIds(node) : [];
      } else if (deckId !== undefined) {
        scope = [deckId];
      }
      const queue = await buildQueue(scope, Date.now());
      const list = await db.cards.bulkGet(queue);
      if (!alive) return;
      const cards = new Map<number, Card>();
      list.forEach((c) => c && cards.set(c.id, c));
      setSession({ queue, cards, total: queue.length, finished: 0, tally: { 1: 0, 2: 0, 3: 0, 4: 0 }, missed: [] });
    })();
    return () => { alive = false; };
  }, [deckId, groupId]);

  // Qual ficha vem agora: uma ficha que você errou (1 min) ou achou difícil (6 min) só volta quando esse
  // prazo passa. Se só restarem essas, mostra a espera em vez de repetir a ficha na hora.
  const next: Next | null = session ? pickNext(session.queue, session.cards, Date.now(), ahead) : null;
  const current = session && next?.kind === 'card' ? session.cards.get(next.id) ?? null : null;
  const [settings] = useSettings();
  const mode = settings.learningMode;
  const labels = useMemo(() => (current ? previewLabels(current, Date.now(), mode) : null), [current, flipped, mode]);

  const waiting = next?.kind === 'wait';
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [waiting]);

  async function grade(g: Grade) {
    if (!session || !current || busy.current) return;
    busy.current = true;
    try {
      const now = Date.now();
      const updated = await gradeCard(current.id, g, now);
      setSession((s) => {
        if (!s) return s;
        const cards = new Map(s.cards).set(updated.id, updated);
        const rest = s.queue.filter((x) => x !== updated.id);
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
      setAhead(false);
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

  const title = groupId !== undefined ? group?.name ?? '…' : deckId === undefined ? 'TODOS OS DECKS' : deck?.name ?? '…';
  const back = deckId === undefined ? '/' : `/deck/${deckId}`;
  const leave = (
    <Link className={ICON_KEY} to={back} aria-label="Sair do estudo"><Icon name="close" /></Link>
  );

  if (!session) return <Shell title={title} leave={leave}><p className="py-6 text-center uppercase text-muted">Carregando…</p></Shell>;

  if (session.total === 0) {
    return (
      <Shell title={title} leave={leave}>
        <p className="py-6 text-center uppercase text-muted">Nada para estudar agora ■</p>
        <Link className={keyCls('bar')} to="/">Voltar aos decks</Link>
      </Shell>
    );
  }

  if (next?.kind === 'wait') {
    const { mm, ss } = formatCountdown(next.nextDue - Date.now());
    const n = next.waiting;
    return (
      <Shell title={title} leave={leave}>
        <Panel className="gap-3.5">
          <Label tone="panel">Aguardando</Label>
          <div className="flex items-center gap-1">
            <Seg value={mm} size="big" onPanel />
            <span aria-hidden="true" className="font-lcd text-[72px] leading-none">:</span>
            <Seg value={ss} size="big" onPanel />
          </div>
          <p className="m-0 text-[14px] text-pm">
            {n === 1 ? 'Falta 1 ficha' : `Faltam ${n} fichas`} em aprendizado. Elas voltam quando o prazo do botão
            (1 min, 6 min…) terminar. O que falta fica guardado.
          </p>
        </Panel>
        <div className="mt-auto" />
        <button type="button" className={keyCls('solid')} onClick={() => setAhead(true)}>▶ Estudar agora</button>
        <Link className={keyCls('outline')} to={back}>Terminar por hoje</Link>
      </Shell>
    );
  }

  if (!current) {
    const t = session.tally;
    const sum = t[1] + t[2] + t[3] + t[4];
    const pct = sum ? Math.round(((t[3] + t[4]) / sum) * 100) : 0;
    return (
      <Shell title={title} leave={leave}>
        <Panel className="gap-3.5">
          <Label tone="panel">Sessão concluída</Label>
          <div>
            <span className="relative inline-block font-lcd text-[72px] leading-none">
              <span aria-hidden="true" className="absolute left-0 top-0 select-none text-pt/[.13]">888</span>
              <span className="relative">{String(pct).padStart(3, '0')}</span>
            </span>
          </div>
          <Label tone="panel">% de acerto em {sum} revisões</Label>
          <div className="flex flex-wrap items-center gap-2">
            {GRADES.map((g) => (
              <Label key={g} className={GRADE_STYLE[g].text}>{GRADE_LABEL[g]} {t[g]}</Label>
            ))}
          </div>
          {session.missed.length > 0 && (
            <>
              <Label tone="panel">Fichas que você errou ({session.missed.length})</Label>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-[18px] text-[14px]">
                {session.missed.map((cid) => <li key={cid}>{session.cards.get(cid)?.front}</li>)}
              </ul>
            </>
          )}
        </Panel>
        <div className="mt-auto" />
        <Link className={keyCls('bar')} to={back}>▶ Concluir</Link>
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
      <div className="flex items-center gap-3 text-[12px] tracking-[0.1em]">
        <span>{String(pos).padStart(2, '0')}/{String(session.total).padStart(2, '0')}</span>
        <div className="flex flex-1 gap-[3px]" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => <span key={i} className={`h-2.5 flex-1 ${i < Math.max(1, lit) ? 'bg-ink' : 'bg-ink/[.16]'}`} />)}
        </div>
        <span>N{String(n).padStart(2, '0')} A{String(a).padStart(2, '0')} R{String(r).padStart(2, '0')}</span>
      </div>

      {!flipped ? (
        <>
          <button type="button" className={`${CARD_BASE} border-0 bg-panel text-pt`} onClick={() => setFlipped(true)}>
            <span className="flex w-full justify-between gap-2 text-[12px] uppercase tracking-[0.16em] text-pm"><span>Frente</span><span>{tag}</span></span>
            <span className={`${CARD_TEXT} text-[38px] min-[421px]:text-[44px]`}>{current.front}</span>
            <span className="text-[13px] tracking-[0.12em] text-pm">TOQUE PARA VER A RESPOSTA █</span>
          </button>
          <button type="button" className={keyCls('bar')} onClick={() => setFlipped(true)}>▶ Mostrar resposta</button>
        </>
      ) : (
        <>
          <div className={`${CARD_BASE} border-[3px] border-panel bg-back text-panel`} aria-live="polite">
            <div className="flex justify-between gap-2 text-[12px] uppercase tracking-[0.16em]"><span>Verso</span><span>{tag}</span></div>
            <div>
              <p className="mb-3 text-[13px] uppercase tracking-[0.06em]">&gt; {current.front}</p>
              <div className={`${CARD_TEXT} text-[28px] min-[421px]:text-[32px]`}>{current.back}</div>
            </div>
            <div className="text-[13px] tracking-[0.12em]">QUÃO BEM VOCÊ LEMBROU?</div>
          </div>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Quão bem você lembrou">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                className={`flex min-h-20 flex-col items-center gap-1 rounded-[10px] border-2 px-0.5 py-2 text-[13px] leading-[normal] uppercase tracking-[0.06em] hover:brightness-[1.15] ${GRADE_STYLE[g].key}`}
                onClick={() => void grade(g)}
                aria-keyshortcuts={String(g)}
              >
                {GRADE_LABEL[g]}
                <span className="font-lcd text-[28px] leading-none">{labels?.[g].toUpperCase()}</span>
                <span className="flex gap-[3px]" aria-hidden="true">
                  {[1, 2, 3, 4].map((i) => <i key={i} className={`block size-2 ${i <= g ? GRADE_STYLE[g].on : GRADE_STYLE[g].off}`} />)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ title, leave, children }: { title: string; leave: ReactNode; children: ReactNode }) {
  return (
    <Page eyebrow="ESTUDANDO" title={title} small actions={leave}>
      {children}
    </Page>
  );
}
