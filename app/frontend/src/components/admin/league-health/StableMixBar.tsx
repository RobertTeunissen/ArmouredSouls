/** Human / Automaton / generated share of a tier as one stacked bar. */
import type { ReactNode } from 'react';
import { stableMixText } from '../../../utils/adminLeagueHealthFormat';

export interface StableMixBarProps {
  mix: { human: number; automaton: number; generated: number };
  className?: string;
}

const SEGMENTS = [
  { key: 'human', label: 'human', colour: 'bg-primary' },
  { key: 'automaton', label: 'automaton', colour: 'bg-info' },
  { key: 'generated', label: 'generated', colour: 'bg-tertiary' },
] as const;

export function StableMixBar({ mix, className = '' }: StableMixBarProps): ReactNode {
  const total = mix.human + mix.automaton + mix.generated;
  return (
    <span
      role="img"
      aria-label={`Stable mix: ${stableMixText(mix)}`}
      className={`flex h-2 overflow-hidden rounded-sm bg-white/5 ${className}`}
    >
      {total > 0 && SEGMENTS.map((segment) => {
        const count = mix[segment.key];
        if (count === 0) return null;
        // A non-zero share never renders thinner than 2 px.
        return (
          <span
            key={segment.key}
            className={segment.colour}
            style={{ width: `${(count / total) * 100}%`, minWidth: '2px' }}
          />
        );
      })}
    </span>
  );
}

export function StableMixLegend(): ReactNode {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-normal normal-case tracking-normal text-secondary">
      {SEGMENTS.map((segment) => (
        <span key={segment.key} className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-sm ${segment.colour}`} aria-hidden="true" />
          {segment.label}
        </span>
      ))}
    </span>
  );
}
