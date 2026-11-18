import { useRef, useState } from 'react';
import { Page } from '../components/Page';
import { Seg } from '../components/Seg';
import { download, readText } from '../components/files';
import { exportBackup, importBackup, type Backup } from '../db';
import { usePwaInstall, useSettings } from '../hooks';
import { THEMES } from '../theme';

function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <section className="panel" style={{ gap: 12 }}>
      <h2 className="label" style={{ margin: 0 }}>{label}</h2>
      <div className="stepper">
        <button type="button" aria-label={`Diminuir: ${label}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>−</button>
        <Seg value={value} digits={2} size="big" />
        <button type="button" aria-label={`Aumentar: ${label}`} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>+</button>
      </div>
    </section>
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
      <section className="box" style={{ gap: 10 }}>
        <h2 className="label" style={{ margin: 0 }}>Tema da tela</h2>
        <div className="themes" role="group" aria-label="Tema da tela">
          {THEMES.map((t) => (
            <button key={t.id} type="button" className="theme" aria-pressed={s.theme === t.id} onClick={() => void update({ theme: t.id })}>
              <span className="sw" aria-hidden="true"><i style={{ background: t.bg }} /><i style={{ background: t.panel }} /></span>
              {t.label}
            </button>
          ))}
        </div>
        <p className="hint">As teclas ERREI, DIFÍCIL, BOM e FÁCIL mantêm suas cores em todos os temas.</p>
      </section>

      <Stepper label="Novas fichas por dia / deck" value={s.newPerDay} min={0} max={100} step={5} onChange={(v) => void update({ newPerDay: v })} />
      <Stepper label="Meta de revisões por dia" value={s.dailyGoal} min={5} max={200} step={5} onChange={(v) => void update({ dailyGoal: v })} />
      <p className="hint" style={{ marginTop: -6 }}>As revisões do dia sempre aparecem, sem limite.</p>

      <section className="box" style={{ gap: 10 }}>
        <h2 className="label" style={{ margin: 0 }}>Seus dados</h2>
        <p className="hint">Tudo fica salvo neste aparelho. Faça backup para levar a outro celular.</p>
        <div className="row nowrap">
          <button type="button" className="key outline flex1" onClick={async () => download(`flashcards-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportBackup()), 'application/json')}>Exportar</button>
          <button type="button" className="key outline flex1" onClick={() => fileRef.current?.click()}>Restaurar</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void restore(f); e.target.value = ''; }} />
        </div>
      </section>

      <div className="spacer" />
      {install.installed ? (
        <p className="hint" style={{ textAlign: 'center' }}>APP INSTALADO NESTE APARELHO ■</p>
      ) : install.canPrompt ? (
        <button type="button" className="key bar" onClick={() => void install.install()}>▶ Instalar no celular</button>
      ) : (
        <p className="hint">
          {install.ios
            ? 'Para instalar no iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".'
            : 'Para instalar, use o menu do navegador e escolha "Instalar app" ou "Adicionar à tela inicial".'}
        </p>
      )}
    </Page>
  );
}
