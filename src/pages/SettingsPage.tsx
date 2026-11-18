import { useRef, useState } from 'react';
import { Page } from '../components/Page';
import { Seg } from '../components/Seg';
import { download, readText } from '../components/files';
import { Box, HINT, Label, Panel, keyCls } from '../components/ui';
import { exportBackup, importBackup, type Backup } from '../db';
import { usePwaInstall, useSettings } from '../hooks';
import { THEMES } from '../theme';

const STEP_KEY =
  'size-[52px] rounded-[10px] border-2 border-pt bg-transparent font-lcd text-[30px] leading-none text-pt disabled:opacity-50';

function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <Panel className="gap-3">
      <Label as="h2" tone="panel">{label}</Label>
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={STEP_KEY} aria-label={`Diminuir: ${label}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>−</button>
        <Seg value={value} digits={2} size="big" onPanel />
        <button type="button" className={STEP_KEY} aria-label={`Aumentar: ${label}`} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>+</button>
      </div>
    </Panel>
  );
}

export function SettingsPage() {
  const [s, update] = useSettings();
  const install = usePwaInstall();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');

  async function restore(file: File) {
    try {
      const data = JSON.parse(await readText(file)) as Backup;
      if (!window.confirm('Restaurar este backup substitui todos os decks e o progresso atuais. Continuar?')) return;
      await importBackup(data);
      await update({}); // reaplica o tema do backup
      setStatus('Backup restaurado.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Não consegui ler o arquivo.');
    }
  }

  return (
    <Page title="Ajustes" eyebrow="FLASHCARDS // SETUP" backTo="/" status={status}>
      <Box className="gap-2.5">
        <Label as="h2">Tema da tela</Label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tema da tela">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="flex min-h-[52px] items-center gap-2.5 rounded-[10px] border-2 border-panel bg-transparent px-3 font-mono text-[14px] leading-[normal] tracking-[0.08em] text-ink aria-pressed:bg-panel aria-pressed:text-pt"
              aria-pressed={s.theme === t.id}
              onClick={() => void update({ theme: t.id })}
            >
              <span className="flex border-2 border-panel" aria-hidden="true">
                <i className="block h-[22px] w-3.5" style={{ background: t.bg }} />
                <i className="block h-[22px] w-3.5" style={{ background: t.panel }} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
        <p className={HINT}>As teclas ERREI, DIFÍCIL, BOM e FÁCIL mantêm suas cores em todos os temas.</p>
      </Box>

      <Stepper label="Novas fichas por dia / deck" value={s.newPerDay} min={0} max={100} step={5} onChange={(v) => void update({ newPerDay: v })} />
      <Stepper label="Meta de revisões por dia" value={s.dailyGoal} min={5} max={200} step={5} onChange={(v) => void update({ dailyGoal: v })} />
      <p className={`${HINT} -mt-1.5`}>As revisões do dia sempre aparecem, sem limite.</p>

      <Box className="gap-2.5">
        <Label as="h2">Seus dados</Label>
        <p className={HINT}>Tudo fica salvo neste aparelho. Faça backup para levar a outro celular.</p>
        <div className="flex gap-2">
          <button type="button" className={keyCls('outline', 'flex-1')} onClick={async () => download(`flashcards-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportBackup()), 'application/json')}>Exportar</button>
          <button type="button" className={keyCls('outline', 'flex-1')} onClick={() => fileRef.current?.click()}>Restaurar</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
        </div>
      </Box>

      <div className="mt-auto" />
      {install.installed ? (
        <p className={`${HINT} text-center uppercase`}>App instalado neste aparelho ■</p>
      ) : install.canPrompt ? (
        <button type="button" className={keyCls('bar')} onClick={() => void install.install()}>▶ Instalar no celular</button>
      ) : (
        <p className={HINT}>
          {install.ios
            ? 'Para instalar no iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".'
            : 'Para instalar, use o menu do navegador e escolha "Instalar app" ou "Adicionar à tela inicial".'}
        </p>
      )}
    </Page>
  );
}
