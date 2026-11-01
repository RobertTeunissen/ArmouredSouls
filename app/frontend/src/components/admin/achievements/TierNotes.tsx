/**
 * Two notes for next season's balance: hard achievements most of the
 * population already has, and easy ones hardly anyone has. Notes, not
 * alerts: only a balance change fixes them.
 */
import type { ReactNode } from 'react';
import { AdminPanel } from '../shared';
import type { AchievementRow } from '../../../utils/adminAchievementsApi';
import {
  EASIER_THAN_TIER_RATE,
  HARDER_THAN_TIER_RATE,
  categoryLabel,
  medianDayLabel,
  tierLabel,
} from '../../../utils/adminAchievementsFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';

function NoteList({ title, note, rows, population, tone }: {
  title: string;
  note: string;
  rows: AchievementRow[];
  population: number;
  tone: 'warning' | 'primary';
}): ReactNode {
  const badge = tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary';
  return (
    <AdminPanel title={title} actions={<span className="text-xs text-secondary">{note}</span>}>
      <div className="px-5 py-3">
        {rows.length === 0 ? (
          <p className="py-2 text-sm text-tertiary">None this season.</p>
        ) : (
          <ul className="divide-y divide-white/5" aria-label={title}>
            {rows.map((row) => (
              <li key={row.achievementId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs ${badge}`}>{tierLabel(row.tier)}</span>
                <span className="min-w-0 flex-1 text-white">
                  {row.name} <span className="text-xs text-secondary">{row.achievementId} · {categoryLabel(row.category)}</span>
                </span>
                <span className="tabular-nums text-white">
                  {formatCount(row.unlocked)} of {formatCount(population)} · {medianDayLabel(row.medianDay)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-tertiary">Notes, not alerts: input for next season&apos;s balance.</p>
      </div>
    </AdminPanel>
  );
}

export function TierNotes({ easier, harder, population, who }: {
  easier: AchievementRow[];
  harder: AchievementRow[];
  population: number;
  who: string;
}): ReactNode {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <NoteList
        title="Easier than its tier says"
        note={`Hard or very hard, unlocked by ${EASIER_THAN_TIER_RATE}%+ of ${who}`}
        rows={easier}
        population={population}
        tone="warning"
      />
      <NoteList
        title="Harder than its tier says"
        note={`Easy or medium, unlocked by ${HARDER_THAN_TIER_RATE}% or fewer`}
        rows={harder}
        population={population}
        tone="primary"
      />
    </div>
  );
}
