import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { RecordStable } from '../hall-of-records/RecordNames';
import { StatusChip } from './StatusChip';
import { robotPath } from '../../utils/robotRoutes';
import { getTierName } from '../../utils/tierHelpers';
import { instanceLabel, type LeagueModeInfo, type ZoneMeta } from '../../utils/leagueStandings';
import type { StandingsRow } from '../../utils/leagueStandingsApi';

export interface StandingsTableProps {
  rows: readonly StandingsRow[];
  mode: LeagueModeInfo;
  tier: string;
  meta: ZoneMeta;
  /** One instance on one page, every row shown: draw the promotion and demotion bands. */
  bands: boolean;
  /** Whole tier: show each row's instance. */
  showGroup?: boolean;
  viewerId: number | null;
  caption: string;
}

function recordText(row: StandingsRow, mode: LeagueModeInfo): string {
  return mode.placement ? `${row.wins} / ${row.matches}` : `${row.wins}-${row.draws}-${row.losses}`;
}

function recordLabel(mode: LeagueModeInfo): string {
  return mode.placement ? 'Wins / matches' : 'W-D-L';
}

function Band({ tone, children, columns }: { tone: 'up' | 'down'; children: string; columns: number }) {
  return (
    <tr className={tone === 'up' ? 'bg-success/10' : 'bg-error/10'} data-testid={`zone-band-${tone}`}>
      <td colSpan={columns} className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wide sm:px-4 ${tone === 'up' ? 'text-success' : 'text-error'}`}>
        <span aria-hidden="true">{tone === 'up' ? '▲ ' : '▼ '}</span>{children}
      </td>
    </tr>
  );
}

/**
 * The ranked list of one tier or instance. In an instance the top and bottom
 * zone places sit between bands; each row's chip says whether it moves at the
 * next rebalance, or why its place is held. Phones show place, name (stable
 * and record underneath, chip below) and LP; md and up add the record, ELO
 * (1v1) and status columns.
 */
export function StandingsTable({ rows, mode, tier, meta, bands, showGroup = false, viewerId, caption }: StandingsTableProps) {
  const showElo = mode.key === '1v1';
  const columns = 4 + (showElo ? 1 : 0) + 1 + (showGroup ? 1 : 0);
  const promotionEnd = bands ? meta.promotionSlots : 0;
  const demotionStart = bands && meta.demotionSlots > 0 ? meta.totalEntities - meta.demotionSlots + 1 : Infinity;
  const tierName = getTierName(tier);

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-surface">
      {/* Fixed layout only from md: below it the hidden columns would still
          reserve their widths and squeeze the name column. */}
      <table className="w-full table-auto text-sm md:table-fixed" data-testid="standings-table">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-elevated text-xs uppercase tracking-wide text-secondary">
          <tr>
            <th scope="col" className="w-12 px-3 py-2 text-left font-medium sm:w-16 sm:px-4">Place</th>
            <th scope="col" className="px-2 py-2 text-left font-medium">{mode.entity === 'robot' ? 'Robot' : 'Team'}</th>
            {showGroup && <th scope="col" className="hidden w-28 px-2 py-2 text-left font-medium md:table-cell">Group</th>}
            <th scope="col" className="hidden w-32 px-2 py-2 text-right font-medium md:table-cell">{recordLabel(mode)}</th>
            {showElo && <th scope="col" className="hidden w-20 px-2 py-2 text-right font-medium md:table-cell">ELO</th>}
            <th scope="col" className="w-16 px-3 py-2 text-right font-medium sm:w-20">LP</th>
            <th scope="col" className="hidden w-48 px-4 py-2 text-left font-medium md:table-cell">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const mine = viewerId !== null && row.stable.userId === viewerId;
            const newHere = mine && !row.status && row.cyclesInTier < meta.minCycles;
            const lastPromotion = row.rank === promotionEnd;
            const chip = row.status ? <StatusChip status={row.status} tier={tier} /> : null;
            return (
              <Fragment key={row.entityId}>
                {promotionEnd > 0 && row.rank === 1 && <Band tone="up" columns={columns}>{`Promotion places · top ${promotionEnd}`}</Band>}
                {row.rank === demotionStart && <Band tone="down" columns={columns}>{`Demotion places · bottom ${meta.demotionSlots}`}</Band>}
                <tr
                  data-testid="standings-row"
                  data-mine={mine ? 'true' : undefined}
                  className={`border-b align-top ${lastPromotion ? 'border-dashed border-b-success/60' : 'border-white/5'} ${
                    mine ? 'bg-primary/10 shadow-[inset_4px_0_0_var(--color-primary)]' : ''
                  } ${row.isSubscribed ? '' : 'text-secondary'}`}
                >
                  <td className={`px-3 py-3 font-bold sm:px-4 ${row.rank === 1 ? 'text-warning' : 'text-secondary'}`}>{row.rank}</td>
                  <td className="min-w-0 px-2 py-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      {row.robotId !== null ? (
                        <Link to={robotPath(row.robotId, mine)} className={`min-w-0 break-words font-medium hover:underline ${mine ? 'text-primary' : 'text-white'}`}>
                          {row.name}
                        </Link>
                      ) : (
                        <span className={`min-w-0 break-words font-medium ${mine ? 'text-primary' : 'text-white'}`}>{row.name}</span>
                      )}
                      {mine && <span className="rounded bg-primary px-1.5 text-[10px] font-semibold uppercase leading-4 text-background">You</span>}
                      {!row.isSubscribed && (
                        <span className="rounded bg-surface-elevated px-1.5 text-[10px] uppercase leading-4 text-secondary" title="Not subscribed to this league: keeps its place, plays no matches">
                          Not entered
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs text-secondary">
                      <RecordStable stable={row.stable} />
                      {row.members.length > 0 && (
                        <span className="min-w-0 break-words text-tertiary">
                          · {row.members.map((m, i) => (
                            <Fragment key={m.robotId}>
                              {i > 0 && ', '}
                              <Link to={robotPath(m.robotId, mine)} className="hover:underline">{m.name}</Link>
                            </Fragment>
                          ))}
                        </span>
                      )}
                      {showGroup && row.instanceId && <span className="md:hidden">· {instanceLabel(row.instanceId)}</span>}
                      <span className="md:hidden">· {recordText(row, mode)}</span>
                    </div>
                    {newHere && (
                      <p className="mt-0.5 text-xs text-tertiary">New in {tierName} · {row.cyclesInTier} of {meta.minCycles} cycles</p>
                    )}
                    {chip && <div className="mt-1.5 md:hidden">{chip}</div>}
                  </td>
                  {showGroup && <td className="hidden px-2 py-3 text-secondary md:table-cell">{row.instanceId ? instanceLabel(row.instanceId) : ''}</td>}
                  <td className="hidden px-2 py-3 text-right font-mono md:table-cell">{recordText(row, mode)}</td>
                  {showElo && <td className="hidden px-2 py-3 text-right font-mono md:table-cell">{row.elo}</td>}
                  <td className="px-3 py-3 text-right font-bold text-warning">{row.leaguePoints}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{chip}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
