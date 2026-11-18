import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-24px)] w-[min(520px,calc(100vw-24px))] overflow-auto rounded-[20px] border-[3px] border-panel bg-page p-0 text-ink backdrop:bg-ink/60"
    >
      {open && children}
    </dialog>
  );
}

/** Conteúdo padrão dos diálogos. */
export const DIALOG_BODY = 'flex flex-col gap-3.5 px-4 pb-5 pt-[18px]';
export const DIALOG_TITLE = 'm-0 font-head text-[26px] font-extrabold uppercase leading-none';
