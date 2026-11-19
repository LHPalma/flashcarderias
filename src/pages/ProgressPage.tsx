import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '../components/Page';
import { Seg } from '../components/Seg';
import { Box, HINT, Label, Panel } from '../components/ui';
import { db } from '../db';
import { useSettings } from '../hooks';
import { MONTHS, WEEKDAYS, bestStreak, buildHeatmap, currentStreak, dayKey, tally } from '../stats';

// Intensidade de cada dia (classes completas para o Tailwind encontrar). O nível 0 ("sem estudo") é quase apagado
// de propósito; do nível 1 em diante, cada quadrado tem pelo menos 3:1 de contraste contra o painel
// (veja contrast.test.ts), para quem enxerga pouco ainda distinguir os dias estudados.
const LEVEL = ['bg-pt/[.12]', 'bg-pt/[.45]', 'bg-pt/[.62]', 'bg-pt/[.8]', 'bg-pt'];

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
      <Panel className="flex-row items-stretch gap-4">
        <div className="flex flex-col gap-0.5">
          <Label tone="panel">Sequência</Label>
          <Seg value={stats.streak} size="big" onPanel />
          <Label tone="panel">Dias seguidos</Label>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Label tone="panel">Meta de hoje · {doneToday}/{goal}</Label>
            <div className="flex gap-[3px]" role="img" aria-label={`${doneToday} de ${goal} revisões hoje`}>
              {Array.from({ length: 10 }, (_, i) => <span key={i} className={`h-3 flex-1 ${i < goalLit ? 'bg-pt' : 'bg-pt/20'}`} />)}
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <Label tone="panel">Recorde</Label>
            <span className="text-[11px] uppercase tracking-[0.16em] text-pt">{stats.best} D</span>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-baseline justify-between gap-2">
          <Label as="h2" tone="panel">Últimas 22 semanas</Label>
          <span className="text-[12px] tracking-[0.08em]">{String(stats.activeDays).padStart(3, '0')} DIAS ATIVOS</span>
        </div>

        {/* --cell: o tamanho do quadrado encolhe em telas estreitas (22 colunas + rótulos + margens) */}
        <div className="flex flex-col gap-1 overflow-x-auto p-0.5 [--cell:clamp(8px,calc((100vw_-_157px)/22),12px)]">
          <div className="grid h-3 grid-cols-[repeat(22,var(--cell))] gap-[3px] pl-[30px] text-[10px] leading-3 tracking-[0.04em] text-pm" aria-hidden="true">
            {months.map((m, i) => <span key={i} className="overflow-visible whitespace-nowrap">{m}</span>)}
          </div>
          <div className="flex gap-1.5">
            <div className="grid w-6 flex-none grid-rows-[repeat(7,var(--cell))] gap-[3px] text-[9px] leading-[var(--cell)] text-pm" aria-hidden="true">
              {WEEKDAYS.map((w, i) => <span key={w}>{i % 2 === 1 ? w : ''}</span>)}
            </div>
            <div
              className="grid auto-cols-[var(--cell)] grid-flow-col grid-rows-[repeat(7,var(--cell))] gap-[3px]"
              role="group"
              aria-label="Mapa de estudo: um quadrado por dia. Use as setas para navegar."
              ref={gridRef}
              onKeyDown={onKeyDown}
            >
              {flat.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  data-key={c.key}
                  className={`size-[var(--cell)] rounded-none border-0 p-0 ${
                    c.future ? 'pointer-events-none bg-transparent' : LEVEL[c.level]
                  } ${c.key === todayKey ? 'outline-2 outline-offset-1 outline-pt' : ''} aria-pressed:shadow-[0_0_0_4px_color-mix(in_srgb,var(--pt)_25%,transparent)] aria-pressed:outline-2 aria-pressed:outline-offset-1 aria-pressed:outline-pt`}
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

        <div className="flex items-baseline justify-between gap-2">
          <Label tone="panel">Toque num dia</Label>
          <span className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-pm" aria-hidden="true">
            menos
            {LEVEL.map((l) => <i key={l} className={`block size-2.5 ${l}`} />)}
            mais
          </span>
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t-2 border-pt/25 pt-2.5 text-[14px] tracking-[0.06em]" role="status" aria-live="polite">
          <span>{readout}</span>
          <span>{sel.n} FICHAS</span>
          <span>{sel.n ? `${Math.round((sel.ok / sel.n) * 100)}% ACERTO` : 'SEM ESTUDO'}</span>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2.5">
        <Box><Label>Taxa de acerto</Label><Seg value={accuracy} digits={3} size="mid" /><span className={HINT}>por cento</span></Box>
        <Box><Label>Revisões</Label><Seg value={stats.total} digits={4} size="mid" /><span className={HINT}>no total</span></Box>
        <Box><Label>Melhor dia</Label><Seg value={stats.bestDay} digits={3} size="mid" /><span className={HINT}>fichas em um dia</span></Box>
        <Box><Label>Dominadas</Label><Seg value={mastered ?? 0} digits={3} size="mid" /><span className={HINT}>intervalo de 21 d ou mais</span></Box>
      </div>
    </Page>
  );
}
