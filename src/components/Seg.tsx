const SIZE = { base: 'text-[50px]', mid: 'text-[46px]', big: 'text-[72px]' } as const;

/** Número estilo LCD: os dígitos acesos sobre "8" apagados ao fundo. */
export function Seg({
  value,
  digits = 2,
  size = 'base',
  onPanel = false,
}: {
  value: number | string;
  digits?: number;
  size?: keyof typeof SIZE;
  /** Sobre painel escuro, o segmento apagado usa a cor do painel. */
  onPanel?: boolean;
}) {
  const text = typeof value === 'number' ? String(value).padStart(digits, '0') : value;
  return (
    <span className={`relative inline-block font-lcd leading-none ${SIZE[size]}`}>
      <span aria-hidden="true" className={`absolute left-0 top-0 select-none ${onPanel ? 'text-pt/[.13]' : 'text-ink/[.16]'}`}>
        {'8'.repeat(Math.max(digits, text.length))}
      </span>
      <span className="relative">{text}</span>
    </span>
  );
}
