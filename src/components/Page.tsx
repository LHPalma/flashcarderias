import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

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
    <main className="wrap">
      <header className="top">
        {backTo && (
          <Link className="iconkey" to={backTo} aria-label="Voltar">
            <Icon name="back" />
          </Link>
        )}
        <div className="titles">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className={'title' + (small ? ' small' : '')}>{title}{small ? '' : '_'}</h1>
        </div>
        {actions}
      </header>
      {status ? <p className="status" role="status" aria-live="polite">{status}</p> : null}
      {children}
    </main>
  );
}
