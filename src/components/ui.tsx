import type { ElementType, HTMLAttributes, ReactNode } from 'react';

/** Teclas (botões e links). As variantes "lit" são para usar dentro de um painel escuro. */
export type KeyVariant = 'solid' | 'outline' | 'bar' | 'lit' | 'litOutline';

const KEY_BASE =
  'inline-flex items-center justify-center gap-2 rounded-[10px] border-2 font-mono uppercase leading-[normal] no-underline disabled:cursor-default disabled:opacity-50 aria-disabled:opacity-50';

const KEY_COLOR: Record<KeyVariant, string> = {
  solid: 'border-panel bg-panel text-pt',
  outline: 'border-panel bg-transparent text-ink',
  bar: 'border-ink bg-ink text-page',
  lit: 'border-pt bg-pt text-panel',
  litOutline: 'border-pt bg-transparent text-pt',
};

const KEY_SIZE = {
  normal: 'min-h-11 px-4 text-[15px] tracking-[0.1em]',
  compact: 'min-h-11 px-2 text-[14px] tracking-[0.06em]', // para três teclas na mesma linha
  bar: 'min-h-[52px] w-full px-4 text-[16px] tracking-[0.14em]',
} as const;

export const keyCls = (variant: KeyVariant = 'solid', extra = '', size: 'normal' | 'compact' = 'normal'): string =>
  `${KEY_BASE} ${variant === 'bar' ? KEY_SIZE.bar : KEY_SIZE[size]} ${KEY_COLOR[variant]} ${extra}`.trim();

/** Tecla quadrada só com ícone, no cabeçalho. */
export const ICON_KEY = 'grid size-11 flex-none place-items-center rounded-[10px] border-0 bg-panel text-pt no-underline';
/** Versão de contorno, para usar sobre o fundo claro (por exemplo, dentro de um grupo). */
export const ICON_KEY_LINE = 'grid size-11 flex-none place-items-center rounded-[10px] border-2 border-panel bg-transparent text-ink';

export const SELECT_CLS =
  'min-h-12 w-full rounded-[10px] border-0 bg-panel px-3 py-2.5 font-lcd text-[22px] leading-[1.05] text-pt';

/** Painel escuro (display invertido). A classe "panel" só marca o contexto para o foco. */
export function Panel({ className = '', children, ...rest }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <section className={`panel flex flex-col gap-2.5 rounded-[14px] bg-panel px-4 py-3.5 text-pt ${className}`} {...rest}>
      {children}
    </section>
  );
}

/** Caixa de contorno sobre o fundo claro, com fundo sólido para o texto ler bem. */
export function Box({ className = '', children, ...rest }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <section className={`flex flex-col gap-0.5 rounded-xl border-2 border-panel bg-page px-3.5 py-2.5 ${className}`} {...rest}>
      {children}
    </section>
  );
}

/** Rótulo pequeno em caixa-alta. `tone="panel"` para usar sobre o painel escuro. */
export function Label({
  as: Tag = 'span',
  tone = 'page',
  className = '',
  children,
  ...rest
}: {
  as?: ElementType;
  tone?: 'page' | 'panel';
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`m-0 text-[11px] font-normal uppercase tracking-[0.16em] ${tone === 'panel' ? 'text-pm' : 'text-muted'} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export const HINT = 'm-0 text-[13px] text-muted';
export const FIELD_LABEL = 'text-[12px] uppercase tracking-[0.16em] text-muted';
export const FIELD_INPUT =
  'w-full resize-y rounded-[10px] border-0 bg-panel px-3 py-2.5 font-lcd text-[26px] leading-[1.05] text-pt';
