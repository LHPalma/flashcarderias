// Qual ficha mostrar agora numa sessão de estudo. Lógica pura, sem React nem banco.
import { formatDue, type CardState } from './srs';

export type Next =
  | { kind: 'card'; id: number } // há uma ficha para mostrar
  | { kind: 'wait'; nextDue: number; waiting: number } // só restam fichas cujo prazo ainda não chegou
  | { kind: 'done' }; // a fila acabou

interface Pickable {
  state: CardState;
  due: number;
}

/**
 * Fichas novas e de revisão estão sempre disponíveis. Uma ficha em aprendizado (por exemplo, depois de
 * "Errei", que mostra 1 min) só volta quando o prazo do botão passar. Se só sobraram fichas assim, devolve
 * "wait" em vez de mostrá-las na hora, para os prazos que aparecem nos botões serem verdadeiros.
 * Com `ahead`, o usuário escolheu adiantar: mostra a que vence primeiro.
 */
export function pickNext(queue: number[], cards: Map<number, Pickable>, now: number, ahead = false): Next {
  const live = queue.filter((id) => cards.has(id));
  if (live.length === 0) return { kind: 'done' };

  const ready = live.find((id) => {
    const c = cards.get(id)!;
    return c.state !== 'learning' || c.due <= now;
  });
  if (ready !== undefined) return { kind: 'card', id: ready };

  const byDue = [...live].sort((a, b) => cards.get(a)!.due - cards.get(b)!.due);
  if (ahead) return { kind: 'card', id: byDue[0] };
  return { kind: 'wait', nextDue: cards.get(byDue[0])!.due, waiting: live.length };
}

/** Aviso da tela inicial: fichas que você errou e ainda esperam o prazo para voltar. */
export function waitingText(waiting: number, nextDue: number, now: number): string {
  const when = formatDue(nextDue, now);
  return waiting === 1 ? `1 ficha volta em ${when}` : `${waiting} fichas em espera · a próxima volta em ${when}`;
}

/** "00:42" para a contagem regressiva. */
export function formatCountdown(ms: number): { mm: number; ss: number } {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return { mm: Math.floor(total / 60), ss: total % 60 };
}
