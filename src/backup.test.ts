import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY, ago, backupReminder, type BackupFacts, type BackupState } from './backup';
import { formatBytes, persistenceState, requestPersistence } from './storage';

const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);
const facts = (over: Partial<BackupFacts> = {}): BackupFacts => ({ firstReviewAt: NOW - 30 * DAY, reviewsSinceLast: 40, ...over });

describe('backupReminder', () => {
  it('sem nenhum estudo, não há o que proteger: não avisa', () => {
    expect(backupReminder({}, { reviewsSinceLast: 0 }, NOW)).toEqual({ show: false });
  });

  it('nunca fez backup: só avisa depois de 7 dias de estudo', () => {
    expect(backupReminder({}, facts({ firstReviewAt: NOW - 6 * DAY }), NOW)).toEqual({ show: false });
    expect(backupReminder({}, facts({ firstReviewAt: NOW - 7 * DAY }), NOW)).toEqual({ show: true, never: true, days: 7 });
    expect(backupReminder({}, facts({ firstReviewAt: NOW - 40 * DAY }), NOW)).toEqual({ show: true, never: true, days: 40 });
  });

  it('já fez backup: avisa depois de 14 dias, mas só se estudou desde então', () => {
    const s: BackupState = { lastAt: NOW - 15 * DAY };
    expect(backupReminder(s, facts({ reviewsSinceLast: 12 }), NOW)).toEqual({ show: true, never: false, days: 15 });
    expect(backupReminder(s, facts({ reviewsSinceLast: 0 }), NOW)).toEqual({ show: false });
    expect(backupReminder({ lastAt: NOW - 13 * DAY }, facts({ reviewsSinceLast: 12 }), NOW)).toEqual({ show: false });
  });

  it('"Depois" silencia o aviso por um tempo e depois ele volta', () => {
    const s: BackupState = { lastAt: NOW - 20 * DAY, snoozeUntil: NOW + 2 * DAY };
    expect(backupReminder(s, facts(), NOW)).toEqual({ show: false });
    expect(backupReminder(s, facts(), NOW + 3 * DAY).show).toBe(true);
  });
});

describe('ago', () => {
  it('descreve o último backup', () => {
    expect(ago(undefined, NOW)).toBe('nunca');
    expect(ago(NOW - 3600_000, NOW)).toBe('hoje');
    expect(ago(NOW - DAY - 1000, NOW)).toBe('ontem');
    expect(ago(NOW - 5 * DAY, NOW)).toBe('há 5 dias');
  });
});

describe('armazenamento', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sem suporte no navegador', async () => {
    vi.stubGlobal('navigator', {});
    expect(await persistenceState()).toBe('unsupported');
    expect(await requestPersistence()).toBe('unsupported');
  });

  it('já protegido: não pede de novo', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { storage: { persisted: async () => true, persist } });
    expect(await persistenceState()).toBe('persistent');
    expect(await requestPersistence()).toBe('persistent');
    expect(persist).not.toHaveBeenCalled();
  });

  it('não protegido: pede, e informa se o navegador concedeu ou não', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => true } });
    expect(await requestPersistence()).toBe('persistent');
    vi.stubGlobal('navigator', { storage: { persisted: async () => false, persist: async () => false } });
    expect(await requestPersistence()).toBe('best-effort');
    expect(await persistenceState()).toBe('best-effort');
  });

  it('erro do navegador não derruba o app', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: async () => { throw new Error('x'); }, persist: async () => { throw new Error('x'); } } });
    expect(await persistenceState()).toBe('unsupported');
    expect(await requestPersistence()).toBe('unsupported');
  });

  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024 + 300_000)).toBe('5,3 MB');
  });
});
