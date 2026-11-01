/**
 * Event entry: which events robots are entered in, and how many events each
 * robot is in. Moved here from the old `/admin/subscriptions` page (its
 * per-cycle churn chart and per-stable table were dropped).
 */
import type { ReactNode } from 'react';
import { AdminPanel } from '../shared';
import type { MetaEventEntry } from '../../../utils/adminMetaApi';
import { formatCount, formatDecimal } from '../../../utils/adminDashboardFormat';
import { eventLabel, formatPercentOf } from '../../../utils/adminMetaFormat';
import { BarRow, MetaStat, SectionLabel } from './metaParts';

export interface EventEntryCardProps {
  eventEntry: MetaEventEntry | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function EventEntryCard({ eventEntry, loading, error = null, onRetry }: EventEntryCardProps): ReactNode {
  const histogramPeak = eventEntry ? Math.max(0, ...eventEntry.eventsPerRobot.map((bucket) => bucket.robots)) : 0;
  const maxEvents = eventEntry ? eventEntry.eventsPerRobot.length - 1 : 0;

  return (
    <AdminPanel
      headingLevel={3}
      title="Event entry"
      actions={<span className="text-xs text-secondary">Which events robots are entered in</span>}
      loading={loading && !eventEntry}
      error={error}
      onRetry={onRetry}
      skeletonRows={8}
    >
      {eventEntry && (eventEntry.totalRobots === 0 ? (
        <p className="p-5 text-sm text-tertiary">No robots</p>
      ) : (
        <div className="space-y-5 px-5 py-4">
          <dl className="grid grid-cols-2 gap-4">
            <MetaStat label="robots entered in at least one event" value={`${formatCount(eventEntry.robotsEntered)} of ${formatCount(eventEntry.totalRobots)}`} />
            <MetaStat label="events per robot (average)" value={formatDecimal(eventEntry.averageEvents)} />
          </dl>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div>
              <SectionLabel>Robots entered per event</SectionLabel>
              <ul className="mt-2 space-y-1.5" aria-label="Robots entered per event">
                {eventEntry.perEvent.map((event) => (
                  <BarRow
                    key={event.eventType}
                    label={eventLabel(event.eventType)}
                    share={eventEntry.totalRobots > 0 ? event.robots / eventEntry.totalRobots : 0}
                    value={formatCount(event.robots)}
                    detail={formatPercentOf(event.robots, eventEntry.totalRobots)}
                    srDetail={`robots, ${formatPercentOf(event.robots, eventEntry.totalRobots)}`}
                    barClassName="bg-success/70"
                  />
                ))}
              </ul>
            </div>

            <div>
              <SectionLabel>Events per robot</SectionLabel>
              <div className="mt-2" aria-hidden="true">
                <div className="flex h-28 items-end gap-1 border-b border-white/10">
                  {eventEntry.eventsPerRobot.map((bucket) => (
                    <div key={bucket.events} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                      {bucket.robots > 0 && <span className="text-center text-[10px] tabular-nums text-secondary">{bucket.robots}</span>}
                      <div
                        title={`${bucket.events} events: ${formatCount(bucket.robots)} robots`}
                        className="rounded-t-sm bg-success/70"
                        style={{ height: `${histogramPeak > 0 && bucket.robots > 0 ? Math.max(3, (bucket.robots / histogramPeak) * 80) : 0}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-1 text-[10px] tabular-nums text-tertiary">
                  {eventEntry.eventsPerRobot.map((bucket) => (
                    <span key={bucket.events} className="min-w-0 flex-1 text-center">{bucket.events}</span>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-xs text-tertiary">Robots by events entered ({maxEvents} = all)</p>
              {/* sr-only on a <table> does not clip it; the wrapper does. */}
              <div className="sr-only">
                <table>
                  <caption>Robots by number of events entered</caption>
                  <thead>
                    <tr><th scope="col">Events</th><th scope="col">Robots</th></tr>
                  </thead>
                  <tbody>
                    {eventEntry.eventsPerRobot.map((bucket) => (
                      <tr key={bucket.events}><th scope="row">{bucket.events}</th><td>{formatCount(bucket.robots)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <p className="text-xs text-tertiary">The Booking Office level sets how many events a robot may enter; ownership is under Facilities.</p>
        </div>
      ))}
    </AdminPanel>
  );
}
