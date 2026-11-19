import { useLiveQuery } from 'dexie-react-hooks';
import { backupReminder } from '../backup';
import { getBackupFacts, getBackupState, snoozeBackup } from '../db';
import { downloadBackup } from './backupFile';
import { Box, Label, keyCls } from './ui';

/**
 * Lembrete discreto de backup na tela inicial. Só aparece quando existe estudo a proteger
 * (veja `backupReminder`). `tick` faz a conta ser refeita de tempos em tempos.
 */
export function BackupBanner({ tick }: { tick: number }) {
  const reminder = useLiveQuery(async () => {
    const state = await getBackupState();
    return backupReminder(state, await getBackupFacts(state), Date.now());
  }, [tick]);

  if (!reminder || !reminder.show) return null;
  return (
    <Box className="gap-2.5" role="region" aria-label="Lembrete de backup">
      <Label as="p">Backup</Label>
      <p className="m-0 text-[14px]">
        {reminder.never
          ? `Você estuda há ${reminder.days} dias e ainda não fez backup.`
          : `Seu último backup foi há ${reminder.days} dias, e você estudou desde então.`}{' '}
        Se o navegador apagar os dados deste aparelho, o progresso se perde.
      </p>
      <div className="flex gap-2">
        <button type="button" className={keyCls('solid', 'flex-1')} onClick={() => void downloadBackup()}>Fazer backup</button>
        <button type="button" className={keyCls('outline', 'flex-1')} onClick={() => void snoozeBackup()}>Depois</button>
      </div>
    </Box>
  );
}
