import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Page';
import { Seg } from '../components/Seg';
import { db } from '../db';
import { useSettings } from '../hooks';
import { MONTHS, WEEKDAYS, bestStreak, buildHeatmap, currentStreak, dayKey, tally } from '../stats';

const LEGEND = ['', 'l1', 'l2', 'l3', 'l4'];

export function ProgressPage() {
  const [settings] = useSettings();
  const logs = useLiveQuery(() => db.reviews.toArray(), []);
  const mastered = useLiveQuery(() => db.cards.filter((c) => c.state === 'review' && c.interval >= 21).count(), []);
  const now = Date.now();
  const todayKey = dayKey(now);
  const [picked, setPicked] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(() => {
    const map = tally(logs ?? []);
    const cols = buildHeatmap(map, now);
    const days = [...map.values()];
    return {
      map,
      cols,
      streak: currentStreak(map, now),
      best: bestStreak(map),
      activeDays: days.length,
      total: days.reduce((s, d) => s + d.n, 0),
      ok: days.reduce((s, d) => s + d.ok, 0),
      bestDay: days.reduce((m, d) => Math.max(m, d.n), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, todayKey]);

  const selKey = picked ?? todayKey;
  const flat = stats.cols.flat();
  const sel = flat.find((c) => c.key === selKey) ?? flat.find((c) => c.key === todayKey)!;
  const doneToday = stats.map.get(todayKey)?.n ?? 0;
  const goal = Math.max(1, settings.dailyGoal);
  const goalLit = Math.round(Math.min(1, doneToday / goal) * 10);
  const accuracy = stats.total ? Math.round((stats.ok / stats.total) * 100) : 0;

  // Setas: esquerda/direita mudam de semana; cima/baixo mudam de dia, como no grid do GitHub.
  function onKeyDown(e: KeyboardEvent) {
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key as 'ArrowLeft'];
    if (!step) return;
    e.preventDefault();
    const i = flat.findIndex((c) => c.key === sel.key);
    const next = flat[i + step];
    if (!next || next.future) return;
    setPicked(next.key);
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-key="${next.key}"]`)?.focus());
  }

  let lastMonth = -1;
  const months = stats.cols.map((col) => {
    const m = col[0].date.getMonth();
    const label = m !== lastMonth ? MONTHS[m] : '';
    lastMonth = m;
    return label;
  });

  const d = sel.date;
  const readout = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  return (
    <Page title="Progresso" eyebrow="FLASHCARDS // LOG" backTo="/">
      <section className="panel streak">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="label">Sequência</span>
          <Seg value={stats.streak} size="big" />
          <span className="label">Dias seguidos</span>
        </div>
        <div className="side">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="label">Meta de hoje · {doneToday}/{goal}</span>
            <div className="goalbar" role="img" aria-label={`${doneToday} de ${goal} revisões hoje`}>
              {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < goalLit ? 'on' : ''} />)}
            </div>
          </div>
          <div className="deck-head label">
            <span>Recorde</span><span style={{ color: 'var(--pt)' }}>{stats.best} D</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="deck-head">
          <h2 className="label" style={{ margin: 0 }}>Últimas 22 semanas</h2>
          <span style={{ fontSize: 12, letterSpacing: '.08em' }}>{String(stats.activeDays).padStart(3, '0')} DIAS ATIVOS</span>
        </div>

        <div className="heat">
          <div className="heat-months" aria-hidden="true">
            {months.map((m, i) => <span key={i}>{m}</span>)}
          </div>
          <div className="heat-body">
            <div className="heat-days" aria-hidden="true">
              {WEEKDAYS.map((w, i) => <span key={w}>{i % 2 === 1 ? w : ''}</span>)}
            </div>
            <div className="heat-grid" role="group" aria-label="Mapa de estudo: um quadrado por dia. Use as setas para navegar." ref={gridRef} onKeyDown={onKeyDown}>
              {flat.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  data-key={c.key}
                  className={`heat-cell ${LEGEND[c.level]}${c.future ? ' future' : ''}${c.key === todayKey ? ' today' : ''}`}
                  aria-pressed={c.key === sel.key}
                  aria-label={`${c.date.getDate()} de ${MONTHS[c.date.getMonth()]}: ${c.n} fichas`}
                  tabIndex={c.key === sel.key ? 0 : -1}
                  disabled={c.future}
                  onClick={() => setPicked(c.key)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="deck-head label">
          <span>Toque num dia</span>
          <span className="legend" aria-hidden="true">
            menos
            {LEGEND.map((l) => <i key={l} className={'heat-cell ' + l} style={{ width: 10, height: 10 }} />)}
            mais
          </span>
        </div>

        <div className="readout" role="status" aria-live="polite">
          <span>{readout}</span>
          <span>{sel.n} FICHAS</span>
          <span>{sel.n ? `${Math.round((sel.ok / sel.n) * 100)}% ACERTO` : 'SEM ESTUDO'}</span>
        </div>
      </section>

      <div className="tiles">
        <div className="box"><span className="label">Taxa de acerto</span><Seg value={accuracy} digits={3} size="mid" /><span className="hint">por cento</span></div>
        <div className="box"><span className="label">Revisões</span><Seg value={stats.total} digits={4} size="mid" /><span className="hint">no total</span></div>
        <div className="box"><span className="label">Melhor dia</span><Seg value={stats.bestDay} digits={3} size="mid" /><span className="hint">fichas em um dia</span></div>
        <div className="box"><span className="label">Dominadas</span><Seg value={mastered ?? 0} digits={3} size="mid" /><span className="hint">intervalo de 21 d ou mais</span></div>
      </div>
    </Page>
  );
}
