/** Número estilo LCD: os dígitos acesos sobre "8" apagados ao fundo. */
export function Seg({ value, digits = 2, size }: { value: number | string; digits?: number; size?: 'big' | 'mid' }) {
  const text = typeof value === 'number' ? String(value).padStart(digits, '0') : value;
  return (
    <span className={'seg' + (size ? ' ' + size : '')}>
      <span className="ghost" aria-hidden="true">{'8'.repeat(Math.max(digits, text.length))}</span>
      <span className="val">{text}</span>
    </span>
  );
}
