import { useEffect, useState } from 'react';
import { DIALOG_BODY, DIALOG_TITLE, Modal } from './Modal';
import { GroupSelect } from './GroupSelect';
import { FIELD_INPUT, FIELD_LABEL, HINT, keyCls } from './ui';
import { createDeck, createGroup, deleteGroup, moveGroup, renameGroup, type Group } from '../db';
import { descendantIds, groupPath } from '../groups';

/** Janela de "novo deck", com escolha do grupo. */
export function NewDeckDialog({ open, groupId, groups, onClose }: { open: boolean; groupId?: number; groups: Group[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState<number | undefined>(groupId);
  useEffect(() => {
    if (open) {
      setName('');
      setGroup(groupId);
    }
  }, [open, groupId]);

  return (
    <Modal open={open} onClose={onClose}>
      <form
        className={DIALOG_BODY}
        onSubmit={(e) => {
          e.preventDefault();
          void createDeck(name, group).then(onClose);
        }}
      >
        <h2 className={DIALOG_TITLE}>Novo deck</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deck-name" className={FIELD_LABEL}>Nome</label>
          <input id="deck-name" className={`${FIELD_INPUT} min-h-12`} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Inglês, Anatomia…" />
        </div>
        <GroupSelect label="Grupo" groups={groups} value={group} onChange={setGroup} />
        <div className="flex gap-2">
          <button type="button" className={keyCls('outline', 'flex-1')} onClick={onClose}>Cancelar</button>
          <button type="submit" className={keyCls('solid', 'flex-1')}>Criar ▮</button>
        </div>
      </form>
    </Modal>
  );
}

/** Janela de "novo grupo". `parentId` já vem escolhido quando criado de dentro de outro grupo. */
export function NewGroupDialog({ open, parentId, groups, onClose }: { open: boolean; parentId?: number; groups: Group[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [parent, setParent] = useState<number | undefined>(parentId);
  useEffect(() => {
    if (open) {
      setName('');
      setParent(parentId);
    }
  }, [open, parentId]);

  return (
    <Modal open={open} onClose={onClose}>
      <form
        className={DIALOG_BODY}
        onSubmit={(e) => {
          e.preventDefault();
          void createGroup(name, parent).then(onClose);
        }}
      >
        <h2 className={DIALOG_TITLE}>Novo grupo</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="group-name" className={FIELD_LABEL}>Nome</label>
          <input id="group-name" className={`${FIELD_INPUT} min-h-12`} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Livros, Faculdade…" />
        </div>
        <GroupSelect label="Dentro de" noneLabel="(nenhum, fica na raiz)" groups={groups} value={parent} onChange={setParent} />
        <div className="flex gap-2">
          <button type="button" className={keyCls('outline', 'flex-1')} onClick={onClose}>Cancelar</button>
          <button type="submit" className={keyCls('solid', 'flex-1')}>Criar ▮</button>
        </div>
      </form>
    </Modal>
  );
}

/** Renomear, mover ou apagar um grupo; atalhos para criar subgrupo e deck dentro dele. */
export function EditGroupDialog({
  open,
  group,
  groups,
  onClose,
  onNewSub,
  onNewDeck,
}: {
  open: boolean;
  group: Group | null;
  groups: Group[];
  onClose: () => void;
  onNewSub: (parentId: number) => void;
  onNewDeck: (groupId: number) => void;
}) {
  const [name, setName] = useState('');
  const [parent, setParent] = useState<number | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open && group) {
      setName(group.name);
      setParent(group.parentId);
      setError('');
    }
  }, [open, group]);

  if (!group) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const g = group;

  async function save() {
    try {
      await renameGroup(g.id, name);
      if (parent !== g.parentId) await moveGroup(g.id, parent);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui salvar.');
    }
  }

  async function remove() {
    const up = groupPath(groups, g.parentId).join(' / ');
    const msg = `Excluir o grupo "${g.name}"?\n\nOs decks e subgrupos dentro dele NÃO são apagados: ${up ? `sobem para "${up}"` : 'ficam soltos na tela inicial'}.`;
    if (!window.confirm(msg)) return;
    await deleteGroup(g.id);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form className={DIALOG_BODY} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <h2 className={DIALOG_TITLE}>Opções do grupo</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-group-name" className={FIELD_LABEL}>Nome</label>
          <input id="edit-group-name" className={`${FIELD_INPUT} min-h-12`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <GroupSelect label="Dentro de" noneLabel="(nenhum, fica na raiz)" groups={groups} value={parent} onChange={setParent} exclude={descendantIds(groups, g.id)} />
        {error && <p className={`${HINT} text-ink`} role="alert">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className={keyCls('outline', 'flex-1')} onClick={() => { onClose(); onNewSub(g.id); }}>[+] Subgrupo</button>
          <button type="button" className={keyCls('outline', 'flex-1')} onClick={() => { onClose(); onNewDeck(g.id); }}>[+] Deck aqui</button>
        </div>
        <div className="flex gap-2">
          <button type="button" className={keyCls('outline')} onClick={() => void remove()}>Excluir grupo</button>
          <button type="button" className={keyCls('outline', 'flex-1')} onClick={onClose}>Cancelar</button>
          <button type="submit" className={keyCls('solid', 'flex-1')} disabled={!name.trim()}>Salvar ▮</button>
        </div>
      </form>
    </Modal>
  );
}
