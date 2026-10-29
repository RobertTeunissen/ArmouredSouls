/**
 * Instances of one expanded tier: size, humans, top LP, the LP at each zone
 * line and how many would move, with a link to the player standings.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ADMIN_FOCUS_RING } from '../shared';
import type { LeagueHealthInstance, LeagueHealthModeSummary, LeagueHealthTier } from '../../../utils/adminLeagueHealthApi';
import { entityNoun, formatCount, pointsUnit, standingsHref, tierLabel } from '../../../utils/adminLeagueHealthFormat';

export interface TierInstancesProps {
  mode: LeagueHealthModeSummary;
  tier: LeagueHealthTier;
  id: string;
}

function line(lp: number | null, rank: number | null, unit: string): string {
  if (lp === null || rank === null) return '—';
  return `${formatCount(lp)} ${unit} · rank ${rank}`;
}

function moves(candidates: number, slots: number): string {
  return slots === 0 ? '—' : `${candidates} of ${slots}`;
}

function size(instance: LeagueHealthInstance): string {
  return instance.active === instance.total
    ? formatCount(instance.total)
    : `${formatCount(instance.active)} / ${formatCount(instance.total)}`;
}

function zoneNote(mode: LeagueHealthModeSummary, tier: LeagueHealthTier): string {
  const lp = tier.promotion.minLp !== null ? ` with ${formatCount(tier.promotion.minLp)} LP and` : ' with';
  return `"Qualify now" is a snapshot of the current standings; the league rebalances after its next battles, so right after a rebalance few qualify. Zones are fixed places in each instance: the top ${Math.round(mode.rules.promotionPercentage * 100)}% promote${lp} ${mode.rules.minCyclesInTier} cycles in tier, the bottom ${Math.round(mode.rules.demotionPercentage * 100)}% demote with ${mode.rules.minCyclesInTier} cycles in tier. A place that doesn't qualify stays empty; nobody below moves up into it.`;
}

export function TierInstances({ mode, tier, id }: TierInstancesProps): ReactNode {
  const unit = pointsUnit(mode);
  const noun = entityNoun(mode.entityType, 2);
  const nounLabel = noun.charAt(0).toUpperCase() + noun.slice(1);
  const label = `${tierLabel(tier.tier)} instances`;

  return (
    <div id={id} className="rounded-md bg-background p-3" data-testid={`league-health-instances-${tier.tier}`}>
      <table className="hidden w-full text-sm md:table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-secondary">
            <th scope="col" className="px-2 py-1.5">Instance</th>
            <th scope="col" className="px-2 py-1.5 text-right">{nounLabel}</th>
            <th scope="col" className="px-2 py-1.5 text-right">Human</th>
            <th scope="col" className="px-2 py-1.5 text-right">Top {unit}</th>
            <th scope="col" className="px-2 py-1.5 text-right">Promotion line</th>
            <th scope="col" className="px-2 py-1.5 text-right">Qualify now</th>
            <th scope="col" className="px-2 py-1.5 text-right">Demotion line</th>
            <th scope="col" className="px-2 py-1.5 text-right">Qualify now</th>
            <th scope="col" className="px-2 py-1.5"><span className="sr-only">Standings</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {tier.instances.map((instance) => (
            <tr key={instance.id}>
              <th scope="row" className="px-2 py-2 text-left font-medium text-white">{instance.id}</th>
              <td className="px-2 py-2 text-right tabular-nums">{size(instance)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatCount(instance.human)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{instance.topLp === null ? '—' : formatCount(instance.topLp)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{line(instance.promotionLineLp, instance.promotionLineRank, unit)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{moves(instance.promotionCandidates, instance.promotionSlots)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{line(instance.demotionLineLp, instance.demotionLineRank, unit)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{moves(instance.demotionCandidates, instance.demotionSlots)}</td>
              <td className="px-2 py-2 text-right">
                <Link
                  to={standingsHref(mode.mode, tier.tier, instance.id)}
                  aria-label={`Standings of ${instance.id}`}
                  className={`whitespace-nowrap text-primary hover:underline ${ADMIN_FOCUS_RING}`}
                >
                  Standings <span aria-hidden="true">→</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-0 divide-y divide-white/5 md:hidden" aria-label={label}>
        {tier.instances.map((instance) => (
          <li key={instance.id} className="py-2.5 text-xs text-secondary">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white">{instance.id}</span>
              <Link
                to={standingsHref(mode.mode, tier.tier, instance.id)}
                aria-label={`Standings of ${instance.id}`}
                className={`flex min-h-11 items-center text-sm text-primary ${ADMIN_FOCUS_RING}`}
              >
                Standings <span aria-hidden="true">&nbsp;→</span>
              </Link>
            </div>
            <p>{size(instance)} {noun} · {formatCount(instance.human)} human · top {instance.topLp === null ? '—' : formatCount(instance.topLp)} {unit}</p>
            <p>Promotion: <span className="text-white">{moves(instance.promotionCandidates, instance.promotionSlots)}</span> qualify now</p>
            <p className="pl-3">line {line(instance.promotionLineLp, instance.promotionLineRank, unit)}</p>
            <p>Demotion: <span className="text-white">{moves(instance.demotionCandidates, instance.demotionSlots)}</span> qualify now</p>
            <p className="pl-3">line {line(instance.demotionLineLp, instance.demotionLineRank, unit)}</p>
          </li>
        ))}
      </ul>

      <p className="mt-2 px-2 text-xs text-secondary">{zoneNote(mode, tier)}</p>
    </div>
  );
}
