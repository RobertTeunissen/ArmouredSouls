/**
 * Combat log of one battle with per-hit formula breakdowns. Loaded on its own
 * request so a large Grand Melee log never delays the rest of the panel, and
 * rendered in pages of events so it never freezes it either.
 */
import { useMemo, useState } from 'react';
import { ADMIN_FOCUS_RING, PanelError } from '../shared';
import { useBattleLog } from '../../../hooks/useAdminBattles';
import type { CombatEvent, CombatLogStatus } from './types';
import { displayMessage, formatEventTime, formatNumber, formatShortDate } from '../../../utils/adminBattlesFormat';

export const EVENTS_PER_PAGE = 200;

type EventFilter = 'all' | 'combat' | 'movement' | 'critical' | 'miss' | 'destroyed';

const COMBAT_TYPES = new Set(['attack', 'critical', 'miss', 'counter', 'malfunction', 'shield_break', 'yield', 'destroyed', 'robot_eliminated']);
const MOVEMENT_TYPES = new Set(['movement', 'range_transition', 'out_of_range', 'counter_out_of_range']);

const FILTERS: ReadonlyArray<{ key: EventFilter; label: string; test: (e: CombatEvent) => boolean }> = [
  { key: 'all', label: 'All events', test: () => true },
  { key: 'combat', label: 'Combat', test: (e) => COMBAT_TYPES.has(e.type) },
  { key: 'movement', label: 'Movement', test: (e) => MOVEMENT_TYPES.has(e.type) },
  { key: 'critical', label: 'Critical hits', test: (e) => e.type === 'critical' },
  { key: 'miss', label: 'Misses', test: (e) => e.type === 'miss' },
  { key: 'destroyed', label: 'Destroyed', test: (e) => e.type === 'destroyed' || e.type === 'robot_eliminated' || e.type === 'yield' },
];

const TYPE_TAGS: Record<string, string> = {
  movement: 'Movement',
  range_transition: 'Range',
  out_of_range: 'Out of range',
  counter_out_of_range: 'Out of range',
  shield_regen: 'Shield',
  score_tick: 'Score',
  zone_enter: 'Zone',
  zone_exit: 'Zone',
};

function EventRow({ event, index }: { event: CombatEvent; index: number }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const formula = typeof event.formulaBreakdown?.calculation === 'string' ? event.formulaBreakdown : null;
  const tag = TYPE_TAGS[event.type];
  const details = [
    typeof event.distance === 'number' ? `${event.distance.toFixed(1)} u` : null,
    typeof event.rangeBand === 'string' ? event.rangeBand : null,
  ].filter(Boolean).join(' · ');
  const detailId = `combat-formula-${index}`;
  return (
    <li className="border-t border-white/5 px-4 py-2 first:border-t-0">
      <div className="flex items-start gap-3">
        <span className="w-16 shrink-0 font-mono text-xs leading-5 text-secondary">{formatEventTime(event.timestamp)}</span>
        <div className="min-w-0 flex-1 text-sm leading-5">
          {tag && <span className="mr-2 inline-flex rounded-full bg-info/10 px-2 text-[10px] font-semibold leading-4 text-info">{tag}</span>}
          <span className={tag ? 'text-secondary' : 'text-white'}>{displayMessage(event.message) || event.type}</span>
          {details && <span className="ml-1 text-xs text-tertiary">· {details}</span>}
        </div>
        {formula && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls={detailId}
            className={`-my-3 min-h-11 min-w-11 shrink-0 rounded px-2 text-xs text-primary hover:underline ${ADMIN_FOCUS_RING}`}
          >
            {open ? 'Hide' : 'Formula'}
          </button>
        )}
      </div>
      {formula && open && (
        <div id={detailId} className="mt-2 rounded bg-background p-3 sm:ml-[4.75rem]">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-success">{formula.calculation}</pre>
          {formula.components && Object.keys(formula.components).length > 0 && (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
              {Object.entries(formula.components).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-2">
                  <dt className="truncate text-secondary">{key}</dt>
                  <dd className="tabular-nums text-white">{typeof value === 'number' ? Number(value.toFixed(2)) : String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
          {typeof formula.result === 'number' && <p className="mt-2 text-xs font-semibold text-warning">Result: {formula.result.toFixed(2)}</p>}
        </div>
      )}
    </li>
  );
}

export function BattleCombatLog({ battleId, status }: { battleId: number; status: CombatLogStatus }): React.ReactElement {
  const log = useBattleLog(battleId, status.available);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [robot, setRobot] = useState('');
  const [shown, setShown] = useState(EVENTS_PER_PAGE);

  const events = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)!.test;
    const needle = robot.trim().toLowerCase();
    return (log.data?.events ?? []).filter((e) => test(e) && (
      !needle
      || (typeof e.attacker === 'string' && e.attacker.toLowerCase().includes(needle))
      || (typeof e.defender === 'string' && e.defender.toLowerCase().includes(needle))
    ));
  }, [log.data, filter, robot]);

  const total = log.data?.events.length ?? 0;
  const notes = [
    !status.hasFormulas ? 'stored without formulas' : 'formula per hit',
    status.movementSampled ? 'movement thinned' : null,
    status.available ? `kept until ${formatShortDate(status.removesOn)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section aria-labelledby="combat-log-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="combat-log-heading" className="text-base font-semibold text-white">Combat log</h3>
        <span className="text-xs text-secondary">{status.available && log.data ? `${formatNumber(total)} event${total === 1 ? '' : 's'} · ` : ''}{notes}</span>
      </div>

      {!status.available ? (
        <p className="rounded-lg bg-surface-elevated px-4 py-3 text-sm text-secondary">
          Combat log removed on {formatShortDate(status.removesOn)} (kept for 7 days). Participants and the payout check above are permanent.
        </p>
      ) : (
        <>
          {(!status.hasFormulas || status.movementSampled) && (
            <p className="text-xs text-tertiary">
              {!status.hasFormulas
                ? 'This King of the Hill / Grand Melee battle was stored before formulas were kept: no formulas, and movement, range and shield events were thinned.'
                : 'Movement, range and shield events were thinned before this log was stored.'}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Event types" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => { setFilter(f.key); setShown(EVENTS_PER_PAGE); }}
                  className={`min-h-11 rounded-full border px-4 text-xs font-semibold ${ADMIN_FOCUS_RING} ${
                    filter === f.key ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/15 text-secondary hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label htmlFor="combat-log-robot" className="sr-only">Filter by robot</label>
            <input
              id="combat-log-robot"
              type="search"
              value={robot}
              onChange={(e) => { setRobot(e.target.value); setShown(EVENTS_PER_PAGE); }}
              placeholder="Filter by robot"
              className={`min-h-11 w-full rounded-md border border-white/10 bg-background px-3 text-xs text-white placeholder:text-tertiary sm:ml-auto sm:w-44 ${ADMIN_FOCUS_RING}`}
            />
          </div>

          {log.error && <PanelError message={log.error} onRetry={log.reload} />}
          {log.loading && !log.data && <p className="text-sm text-secondary" role="status">Loading the combat log…</p>}
          {log.data && (
            events.length === 0 ? (
              <p className="rounded-lg bg-surface-elevated px-4 py-3 text-sm text-secondary">No events match.</p>
            ) : (
              <>
                <ol className="rounded-lg bg-surface-elevated py-1" aria-label="Combat events">
                  {events.slice(0, shown).map((event, index) => (
                    <EventRow key={`${event.timestamp}-${event.type}-${index}`} event={event} index={index} />
                  ))}
                </ol>
                {events.length > shown && (
                  <button
                    type="button"
                    onClick={() => setShown(shown + EVENTS_PER_PAGE)}
                    className={`min-h-11 w-full rounded-md bg-surface-elevated text-sm text-white hover:bg-white/10 ${ADMIN_FOCUS_RING}`}
                  >
                    Show {Math.min(EVENTS_PER_PAGE, events.length - shown)} more ({formatNumber(events.length - shown)} left)
                  </button>
                )}
              </>
            )
          )}
        </>
      )}
    </section>
  );
}
