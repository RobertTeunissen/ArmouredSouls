/**
 * Top of the Image Uploads page: the six cards, uploads per week this season,
 * and the moderation outcomes of the last 30 days.
 */
import type { ReactNode } from 'react';
import { AdminPanel } from '../shared';
import type { ImagesOverview } from '../../../utils/adminImagesApi';
import { bytesText, dayMonth } from '../../../utils/adminImagesFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';

export function ImageStatCards({ overview }: { overview: ImagesOverview }): ReactNode {
  const { inUse, season, moderation, storage } = overview;
  const cards: { label: string; value: string; hint: string; testId: string }[] = [
    { label: 'In use', value: formatCount(inUse.images), hint: `images on ${formatCount(inUse.robots)} robots · ${formatCount(inUse.stables)} stables`, testId: 'in-use' },
    { label: 'Saved, not in use', value: formatCount(overview.savedNotInUse), hint: "kept in players' libraries", testId: 'saved' },
    { label: 'Uploaded this season', value: formatCount(season.uploads), hint: `${formatCount(season.firstWeekUploads)} in the first week`, testId: 'season' },
    { label: 'NSFW blocks', value: formatCount(moderation.blocked), hint: `last ${moderation.windowDays} days`, testId: 'blocked' },
    { label: 'Uploaded anyway', value: formatCount(moderation.uploadedAnyway), hint: `"not a robot" overridden, ${moderation.windowDays} days`, testId: 'anyway' },
    { label: 'Disk', value: bytesText(storage.bytes), hint: `${formatCount(storage.files)} files`, testId: 'disk' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <div key={card.testId} data-testid={`image-card-${card.testId}`} className="rounded-lg border border-white/10 bg-surface px-4 py-3">
          <dt className="text-sm text-white">{card.label}</dt>
          <dd className="mt-1">
            <span className="block text-2xl font-bold tabular-nums text-white">{card.value}</span>
            <span className="block text-xs text-secondary">{card.hint}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function UploadsPerWeek({ overview }: { overview: ImagesOverview }): ReactNode {
  const { weeks, number, startedAt } = overview.season;
  const peak = Math.max(1, ...weeks.map((w) => w.uploads));
  const title = number === null ? 'Uploads per week' : `Uploads per week, season ${number}`;
  return (
    <AdminPanel title={title}>
      {weeks.length === 0 ? (
        <p className="px-5 py-6 text-sm text-secondary">No season yet.</p>
      ) : (
        <figure className="px-5 pb-4 pt-3">
          <div
            className="flex h-36 items-end gap-1 border-b border-tertiary"
            role="img"
            aria-label={`Uploads per week, oldest first: ${weeks.map((w) => `${dayMonth(w.start)} ${w.uploads}`).join(', ')}`}
          >
            {weeks.map((week) => (
              <div key={week.start} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`Week of ${dayMonth(week.start)}: ${week.uploads}`}>
                {week.uploads > 0 && <span className="mb-0.5 text-[11px] tabular-nums text-secondary">{week.uploads}</span>}
                <span className="block w-full max-w-10 rounded-t-sm bg-primary/75" style={{ height: week.uploads > 0 ? `${Math.max(3, (week.uploads / peak) * 85)}%` : '0' }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1 text-[11px] text-secondary" aria-hidden="true">
            {weeks.map((week, index) => (
              <span key={week.start} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">{index % 2 === 0 ? dayMonth(week.start) : ''}</span>
            ))}
          </div>
          <figcaption className="mt-2 text-xs text-secondary">
            Files still on disk, by upload date{startedAt ? `; the season opened ${dayMonth(startedAt)}` : ''}. Weeks start on Monday (UTC).
          </figcaption>
        </figure>
      )}
    </AdminPanel>
  );
}

export function ModerationSummary({ overview }: { overview: ImagesOverview }): ReactNode {
  const m = overview.moderation;
  const rows: { label: string; value: number; indent?: boolean }[] = [
    { label: 'Saved to a robot', value: m.saved },
    { label: 'Blocked by the NSFW filter', value: m.blocked },
    { label: "Warned \"doesn't look like a robot\"", value: m.warned },
    { label: 'then uploaded anyway', value: m.uploadedAnyway, indent: true },
    { label: 'then gave up', value: m.gaveUp, indent: true },
    { label: 'Refused: filter offline', value: m.filterOffline },
  ];
  return (
    <AdminPanel title={`Moderation, last ${m.windowDays} days`}>
      <p className="px-5 pt-3 text-xs text-secondary">Every upload passes the NSFW filter and a robot-likeness check.</p>
      <dl className="space-y-1.5 px-5 py-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className={`flex items-baseline justify-between gap-3 ${row.indent ? 'pl-4' : ''}`}>
            <dt className={row.indent ? 'text-secondary' : 'text-white'}>{row.label}</dt>
            <dd className="font-semibold tabular-nums text-white">{formatCount(row.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="px-5 pb-4 text-xs text-secondary">From the audit log. &quot;Gave up&quot; is warnings without an override.</p>
    </AdminPanel>
  );
}
