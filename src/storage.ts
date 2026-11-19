// Proteção do armazenamento do navegador. Sem isso, o navegador pode apagar os dados do app quando faltar
// espaço ou se o app ficar muito tempo sem uso (o Safari, por exemplo, é mais rígido com sites não instalados).

export type Persistence = 'persistent' | 'best-effort' | 'unsupported';

const storage = (): StorageManager | undefined => (typeof navigator === 'undefined' ? undefined : navigator.storage);

/** Os dados estão protegidos agora? Não pede nada ao usuário. */
export async function persistenceState(): Promise<Persistence> {
  const s = storage();
  if (!s?.persisted) return 'unsupported';
  try {
    return (await s.persisted()) ? 'persistent' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}

/**
 * Pede ao navegador que trate os dados como permanentes. O Chrome decide sozinho (instalar o app ajuda);
 * o Firefox pergunta ao usuário. Por isso só chamamos quando já existe algo a proteger.
 */
export async function requestPersistence(): Promise<Persistence> {
  const s = storage();
  if (!s?.persist) return 'unsupported';
  try {
    if (s.persisted && (await s.persisted())) return 'persistent';
    return (await s.persist()) ? 'persistent' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}

export async function storageUsage(): Promise<{ usage?: number; quota?: number }> {
  const s = storage();
  if (!s?.estimate) return {};
  try {
    const e = await s.estimate();
    return { usage: e.usage, quota: e.quota };
  } catch {
    return {};
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1).replace('.', ',')} GB`;
}
