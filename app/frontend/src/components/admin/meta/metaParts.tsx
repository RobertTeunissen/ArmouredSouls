/**
 * Small building blocks shared by the Meta page's build sections: a headline
 * stat, a section label, and a labelled bar row.
 */
import type { ReactNode } from 'react';

export function MetaStat({ label, value }: { label: string; value: string }): ReactNode {
  return (
    // The term comes first in the DOM (valid <dl>); the value is shown on top.
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums text-white">{value}</dd>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }): ReactNode {
  return <h4 className="text-[11px] font-semibold uppercase tracking-wider text-secondary">{children}</h4>;
}

export interface BarRowProps {
  label: string;
  /** Bar length as a fraction of the longest bar (0–1). */
  share: number;
  value: string;
  detail?: string;
  /** Screen-reader text after the value, in place of the visual `detail`. */
  srDetail?: string;
  barClassName?: string;
}

export function BarRow({ label, share, value, detail, srDetail, barClassName = 'bg-primary/70' }: BarRowProps): ReactNode {
  return (
    <li className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem_3rem] items-center gap-3 text-xs">
      <span className="truncate text-white">{label}</span>
      <span className="block h-2.5 rounded-sm bg-white/5" aria-hidden="true">
        <span className={`block h-2.5 rounded-sm ${barClassName}`} style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} />
      </span>
      <span className="text-right tabular-nums text-white">
        {value}
        {srDetail && <span className="sr-only"> {srDetail}</span>}
      </span>
      <span className="text-right tabular-nums text-secondary" aria-hidden={srDetail ? true : undefined}>{detail}</span>
    </li>
  );
}
