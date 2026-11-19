import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from './db';
import { applyTheme } from './theme';

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<void>] {
  const live = useLiveQuery(getSettings, []);
  const settings = live ?? DEFAULT_SETTINGS;
  const update = useCallback(async (patch: Partial<Settings>) => {
    const next = { ...(await getSettings()), ...patch };
    await saveSettings(next);
    if (patch.theme) applyTheme(patch.theme);
  }, []);
  return [settings, update];
}

const COLLAPSED_KEY = 'fc.collapsed';

/** Quais grupos estão fechados na tela inicial. Por padrão, tudo aberto; a escolha fica salva no aparelho. */
export function useCollapsed(): [Set<number>, (id: number) => void] {
  const [set, setSet] = useState<Set<number>>(() => {
    try {
      return new Set<number>(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'));
    } catch {
      return new Set<number>();
    }
  });
  const toggle = useCallback((id: number) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        /* sem localStorage, só não lembra na próxima vez */
      }
      return next;
    });
  }, []);
  return [set, toggle];
}

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Botão "instalar": usa o prompt do navegador quando existe; no iOS só dá para orientar. */
export function usePwaInstall() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    canPrompt: !!evt,
    installed: installed || standalone,
    ios,
    install: async () => {
      if (!evt) return;
      await evt.prompt();
      await evt.userChoice;
      setEvt(null);
    },
  };
}
