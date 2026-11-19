import { useId } from 'react';
import type { Group } from '../db';
import { groupOptions } from '../groups';
import { FIELD_LABEL, SELECT_CLS } from './ui';

/** Seletor de grupo. Mostra o caminho completo ("Livros / Psicologia") de cada opção. */
export function GroupSelect({
  label,
  groups,
  value,
  onChange,
  exclude,
  noneLabel = '(sem grupo)',
}: {
  label: string;
  groups: Group[];
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  /** Grupos que não podem ser escolhidos (por exemplo, o próprio grupo e os de dentro dele). */
  exclude?: Set<number>;
  noneLabel?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={FIELD_LABEL}>{label}</label>
      <select
        id={id}
        className={SELECT_CLS}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      >
        <option value="">{noneLabel}</option>
        {groupOptions(groups, exclude).map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
