import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { ICON_KEY } from './ui';

interface Props {
  eyebrow?: string;
  title: string;
  small?: boolean;
  backTo?: string;
  actions?: ReactNode;
  status?: string;
  children: ReactNode;
}

export function Page({ eyebrow = 'FLASHCARDS', title, small, backTo, actions, status, children }: Props) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col gap-3.5 px-4 py-7">
      <header className="flex items-end gap-2">
        {backTo && (
          <Link className={ICON_KEY} to={backTo} aria-label="Voltar">
            <Icon name="back" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[12px] uppercase tracking-[0.16em] text-muted">{eyebrow}</p>
          <h1
            className={`font-head font-extrabold uppercase break-words ${
              small ? 'text-[24px] leading-[1.05] tracking-[0.02em]' : 'text-[30px] leading-none tracking-[0.02em] min-[421px]:text-[34px]'
            }`}
          >
            {title}
            {small ? '' : '_'}
          </h1>
        </div>
        {actions}
      </header>
      {status ? (
        <p className="min-h-[1.4em] text-[13px] text-muted" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
      {children}
    </main>
  );
}
