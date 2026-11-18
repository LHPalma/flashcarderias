import { describe, expect, it } from 'vitest';
import { MIN, addDays, formatDue, isDue, newSrsFields, schedule, startOfDay, type SrsFields } from './srs';

const NOW = new Date(2026, 5, 10, 15, 30).getTime();
const review = (over: Partial<SrsFields> = {}): SrsFields => ({
  state: 'review', ease: 2.5, interval: 10, reps: 3, lapses: 0, due: startOfDay(NOW), ...over,
});

describe('cartão novo', () => {
  it('Errei mantém em aprendizado por 1 min', () => {
    const r = schedule(newSrsFields(NOW), 1, NOW);
    expect(r.state).toBe('learning');
    expect(r.due).toBe(NOW + MIN);
  });
  it('Bom gradua para 1 dia; Fácil para 4 dias', () => {
    const good = schedule(newSrsFields(NOW), 3, NOW);
    expect(good).toMatchObject({ state: 'review', interval: 1, reps: 1, due: addDays(NOW, 1) });
    expect(schedule(newSrsFields(NOW), 4, NOW).interval).toBe(4);
  });
});

describe('cartão em revisão', () => {
  it('Bom multiplica o intervalo pela facilidade', () => {
    expect(schedule(review(), 3, NOW)).toMatchObject({ interval: 25, ease: 2.5 });
  });
  it('Fácil aumenta o intervalo e a facilidade', () => {
    const r = schedule(review(), 4, NOW);
    expect(r.interval).toBe(33);
    expect(r.ease).toBeCloseTo(2.65);
  });
  it('Difícil cresce pouco e reduz a facilidade', () => {
    const r = schedule(review(), 2, NOW);
    expect(r.interval).toBe(12);
    expect(r.ease).toBeCloseTo(2.35);
  });
  it('Errei conta lapso, reduz o intervalo e volta a aprender', () => {
    const r = schedule(review(), 1, NOW);
    expect(r).toMatchObject({ state: 'learning', lapses: 1, interval: 5 });
    expect(r.ease).toBeCloseTo(2.3);
    expect(r.due).toBe(NOW + 10 * MIN);
  });
  it('a facilidade nunca cai abaixo de 1,3', () => {
    expect(schedule(review({ ease: 1.35 }), 1, NOW).ease).toBe(1.3);
  });
  it('o intervalo sempre avança pelo menos 1 dia', () => {
    expect(schedule(review({ interval: 1, ease: 1.3 }), 3, NOW).interval).toBe(2);
  });
  it('depois de um lapso, Bom volta com o intervalo reduzido', () => {
    const lapsed = schedule(review(), 1, NOW);
    expect(schedule(lapsed, 3, NOW + 10 * MIN)).toMatchObject({ state: 'review', interval: 5 });
  });
});

describe('isDue e formatDue', () => {
  it('revisão vence pelo dia; aprendizado pelo horário; novo nunca', () => {
    expect(isDue(review({ due: addDays(NOW, 1) }), NOW)).toBe(false);
    expect(isDue(review({ due: startOfDay(NOW) }), NOW)).toBe(true);
    expect(isDue(review({ state: 'learning', due: NOW + MIN }), NOW)).toBe(false);
    expect(isDue(review({ state: 'learning', due: NOW - 1 }), NOW)).toBe(true);
    expect(isDue(newSrsFields(NOW), NOW)).toBe(false);
  });
  it('formata minutos, dias, meses e anos', () => {
    expect(formatDue(NOW + MIN, NOW)).toBe('1 min');
    expect(formatDue(addDays(NOW, 3), NOW)).toBe('3 d');
    expect(formatDue(addDays(NOW, 60), NOW)).toBe('2 meses');
    expect(formatDue(addDays(NOW, 400), NOW)).toBe('1,1 anos');
  });
});
