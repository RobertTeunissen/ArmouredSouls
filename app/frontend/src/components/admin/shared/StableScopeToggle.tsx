/**
 * The admin portal's stable-type filter: Players / Automatons / Generated /
 * All as toggle chips (`?stables=`, `utils/adminStableScope.ts`). Pages that
 * have no "All" view pass a shorter `options` list.
 */
import type { ReactNode } from 'react';
import { ToggleChip } from './ToggleChip';
import { STABLE_SCOPE_HELP, STABLE_SCOPE_LABELS, STABLE_SCOPES, type StableScope } from '../../../utils/adminStableScope';

export interface StableScopeToggleProps<T extends StableScope> {
  value: T;
  onChange: (scope: T) => void;
  options?: readonly T[];
  /** Visible label in front of the chips. */
  label?: string;
}

export function StableScopeToggle<T extends StableScope>({ value, onChange, options, label = 'Stables' }: StableScopeToggleProps<T>): ReactNode {
  const scopes = options ?? (STABLE_SCOPES as readonly StableScope[] as readonly T[]);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="text-xs text-secondary" aria-hidden="true">{label}</span>
      {scopes.map((scope) => (
        <span key={scope} title={STABLE_SCOPE_HELP[scope]} className="inline-flex">
          <ToggleChip pressed={value === scope} onClick={() => onChange(scope)} className="px-3">
            {STABLE_SCOPE_LABELS[scope]}
          </ToggleChip>
        </span>
      ))}
    </div>
  );
}
