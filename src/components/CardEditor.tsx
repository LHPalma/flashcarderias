import { useEffect, useState } from 'react';
import { Modal } from './Modal';
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
      <form className="dlg" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <h2>{card ? 'Editar ficha' : 'Nova ficha'}</h2>
        <div className="field">
          <label htmlFor="cf">Frente</label>
          <textarea id="cf" value={front} onChange={(e) => setFront(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="cb">Verso</label>
          <textarea id="cb" style={{ minHeight: 130 }} value={back} onChange={(e) => setBack(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ct">Tags</label>
          <input id="ct" className="mono" value={tags} onChange={(e) => setTags(e.target.value)} />
          <p className="hint">Separe as tags por espaço.</p>
        </div>
        <div className="row nowrap">
          {card && <button type="button" className="key outline" onClick={() => void remove()}>Excluir</button>}
          <button type="button" className="key outline flex1" onClick={onClose}>Cancelar</button>
          <button type="submit" className="key flex1" disabled={!valid}>Salvar ▮</button>
        </div>
      </form>
    </Modal>
  );
}
