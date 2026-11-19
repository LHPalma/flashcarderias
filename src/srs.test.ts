import { describe, expect, it } from 'vitest';
import { MIN, addDays, formatDue, isDue, newSrsFields, previewLabels, schedule, startOfDay, type SrsFields } from './srs';

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
    expect(schedule(review({ interval: 1, ease: 1.3 }), 2, NOW).interval).toBe(2);
  });
  it('Difícil < Bom < Fácil em qualquer intervalo e facilidade (antes Bom e Fácil empatavam em 1 dia)', () => {
    for (const ease of [1.3, 2.0, 2.5, 3.0]) {
      for (let interval = 1; interval <= 400; interval++) {
        const at = (g: 2 | 3 | 4) => schedule(review({ interval, ease }), g, NOW).interval;
        expect(at(2)).toBeLessThan(at(3));
        expect(at(3)).toBeLessThan(at(4));
      }
    }
  });
  it('na primeira revisão (1 dia): Difícil 2 d, Bom 3 d, Fácil 4 d', () => {
    const at = (g: 2 | 3 | 4) => schedule(review({ interval: 1 }), g, NOW).interval;
    expect([at(2), at(3), at(4)]).toEqual([2, 3, 4]);
  });
  it('depois de um lapso, Bom volta com o intervalo reduzido', () => {
    const lapsed = schedule(review(), 1, NOW);
    expect(schedule(lapsed, 3, NOW + 10 * MIN)).toMatchObject({ state: 'review', interval: 5 });
  });
});

describe('modo rigoroso (ficha nova em dois passos: 1 min e 10 min)', () => {
  const strict = (c: SrsFields, g: 1 | 2 | 3 | 4, now = NOW) => schedule(c, g, now, 'strict');

  it('primeiro passo: Errei 1 min, Difícil 6 min, Bom vai ao segundo passo (10 min), Fácil gradua', () => {
    const c = newSrsFields(NOW);
    expect(strict(c, 1)).toMatchObject({ state: 'learning', step: 0, due: NOW + MIN });
    expect(strict(c, 2)).toMatchObject({ state: 'learning', due: NOW + 6 * MIN });
    expect(strict(c, 3)).toMatchObject({ state: 'learning', step: 1, due: NOW + 10 * MIN });
    expect(strict(c, 4)).toMatchObject({ state: 'review', interval: 4, reps: 1 });
  });

  it('segundo passo: Bom gradua para 1 dia; Errei volta ao começo; Difícil repete os 10 min', () => {
    const second = strict(newSrsFields(NOW), 3);
    expect(strict(second, 3)).toMatchObject({ state: 'review', interval: 1, reps: 1, step: 0 });
    expect(strict(second, 1)).toMatchObject({ state: 'learning', step: 0, due: NOW + MIN });
    expect(strict(second, 2)).toMatchObject({ state: 'learning', step: 1, due: NOW + 10 * MIN });
  });

  it('precisa de dois Bons seguidos; um Errei no meio recomeça a contagem', () => {
    let c = newSrsFields(NOW);
    c = strict(c, 3);
    c = strict(c, 1);
    c = strict(c, 3);
    expect(c.state).toBe('learning');
    c = strict(c, 3);
    expect(c.state).toBe('review');
  });

  it('os botões mostram a verdade em cada passo', () => {
    const c = newSrsFields(NOW);
    expect(Object.values(previewLabels(c, NOW, 'strict'))).toEqual(['1 min', '6 min', '10 min', '4 d']);
    expect(Object.values(previewLabels(strict(c, 3), NOW, 'strict'))).toEqual(['1 min', '10 min', '1 d', '4 d']);
  });

  it('o modo rápido continua igual: um Bom já gradua', () => {
    expect(schedule(newSrsFields(NOW), 3, NOW)).toMatchObject({ state: 'review', interval: 1 });
    expect(schedule(newSrsFields(NOW), 3, NOW, 'fast')).toMatchObject({ state: 'review', interval: 1 });
  });

  it('depois de um lapso (reaprendendo) o passo é um só, mesmo no rigoroso', () => {
    const lapsed = schedule(review(), 1, NOW, 'strict');
    expect(lapsed).toMatchObject({ state: 'learning', step: 0 });
    expect(schedule(lapsed, 3, NOW + 10 * MIN, 'strict')).toMatchObject({ state: 'review', interval: 5 });
  });

  it('ficha antiga, salva sem o campo step, é tratada como passo 0', () => {
    const old = { ...newSrsFields(NOW) } as SrsFields;
    delete old.step;
    expect(strict(old, 3)).toMatchObject({ state: 'learning', step: 1 });
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
