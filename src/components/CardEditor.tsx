import { useEffect, useState } from 'react';
import { DIALOG_BODY, DIALOG_TITLE, Modal } from './Modal';
import { FIELD_INPUT, FIELD_LABEL, HINT, keyCls } from './ui';
import { db, type Card } from '../db';
import { newSrsFields } from '../srs';

interface Props {
  open: boolean;
  deckId: number;
  card: Card | null; // null = nova ficha
  onClose: () => void;
}

export function CardEditor({ open, deckId, card, onClose }: Props) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!open) return;
    setFront(card?.front ?? '');
    setBack(card?.back ?? '');
    setTags(card?.tags.join(' ') ?? '');
  }, [open, card]);

  const valid = front.trim() !== '' && back.trim() !== '';

  async function save() {
    if (!valid) return;
    const fields = { front: front.trim(), back: back.trim(), tags: tags.trim().split(/\s+/).filter(Boolean) };
    if (card) await db.cards.update(card.id, fields);
    else await db.cards.add({ ...fields, deckId, createdAt: Date.now(), ...newSrsFields(Date.now()) } as Card);
    onClose();
  }

  async function remove() {
    if (!card) return;
    if (!window.confirm('Excluir esta ficha? Não dá para desfazer.')) return;
    // O histórico de revisões fica, para não apagar dias de estudo do mapa de calor.
    await db.cards.delete(card.id);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form className={DIALOG_BODY} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <h2 className={DIALOG_TITLE}>{card ? 'Editar ficha' : 'Nova ficha'}</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cf" className={FIELD_LABEL}>Frente</label>
          <textarea id="cf" className={`${FIELD_INPUT} min-h-24`} value={front} onChange={(e) => setFront(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cb" className={FIELD_LABEL}>Verso</label>
          <textarea id="cb" className={`${FIELD_INPUT} min-h-[130px]`} value={back} onChange={(e) => setBack(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ct" className={FIELD_LABEL}>Tags</label>
          <input
            id="ct"
            className="min-h-12 w-full rounded-[10px] border-0 bg-panel px-3 py-2.5 font-mono text-[17px] leading-[normal] tracking-[0.04em] text-pt"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <p className={HINT}>Separe as tags por espaço.</p>
        </div>
        <div className="flex gap-2">
          {card && <button type="button" className={keyCls('outline')} onClick={() => void remove()}>Excluir</button>}
          <button type="button" className={keyCls('outline', 'flex-1')} onClick={onClose}>Cancelar</button>
          <button type="submit" className={keyCls('solid', 'flex-1')} disabled={!valid}>Salvar ▮</button>
        </div>
      </form>
    </Modal>
  );
}
