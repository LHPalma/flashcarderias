import { exportBackup, markBackup } from '../db';
import { download } from './files';

/** Baixa o backup completo em JSON e registra que ele foi feito (para o lembrete). */
export async function downloadBackup(): Promise<void> {
  const data = await exportBackup();
  download(`flashcards-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data), 'application/json');
  await markBackup();
}
