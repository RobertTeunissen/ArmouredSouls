/**
 * League detail of one mode: one row (desktop) or card (below md) per tier,
 * with the instances of the expanded tier underneath.
 */
import { Fragment, useId } from 'react';
import type { ReactNode } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import type { LeagueHealthModeSummary } from '../../../utils/adminLeagueHealthApi';
import {
  activeOfTotal,
  demotionText,
  formatCount,
  instanceSummary,
  promotionText,
  stableMixText,
  tierLabel,
  tierStatusText,
} from '../../../utils/adminLeagueHealthFormat';
import { StableMixBar, StableMixLegend } from './StableMixBar';
import { TierInstances } from './TierInstances';
import { STATUS_TEXT } from './leagueHealthTones';

export interface TierTableProps {
  mode: LeagueHealthModeSummary;
  expandedTier: string | null;
  onToggleTier: (tier: string) => void;
}

function eloLabel(mode: LeagueHealthModeSummary): string {
  return mode.entityType === 'team' ? 'Avg team ELO' : 'Avg ELO';
}

function Cell({ value, caption, className = '' }: { value: ReactNode; caption?: ReactNode; className?: string }): ReactNode {
  return (
    <td className={`whitespace-nowrap px-3 py-2.5 align-top ${className}`}>
      <span className="block tabular-nums text-white">{value}</span>
      {caption && <span className="block text-xs text-secondary">{caption}</span>}
    </td>
  );
}

export function TierTable({ mode, expandedTier, onToggleTier }: TierTableProps): ReactNode {
  const baseId = useId();
  const panelId = (tier: string): string => `${baseId}-${tier}-instances`;

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm" data-testid="league-health-tier-table">
          <caption className="sr-only">Tiers of the selected league. Promotion and demotion: moved in the last rebalance of the places, and the average over the recent rebalances.</caption>
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wide text-secondary">
              <th scope="col" className="px-3 py-2">Tier</th>
              <th scope="col" className="px-3 py-2 text-right">Active / total</th>
              <th scope="col" className="px-3 py-2">Instances<span className="block font-normal normal-case tracking-normal">count · size</span></th>
              <th scope="col" className="px-3 py-2">Stable mix<StableMixLegend /></th>
              <th scope="col" className="px-3 py-2 text-right">{eloLabel(mode)}</th>
              <th scope="col" className="px-3 py-2 text-right">Eligible<span className="block font-normal normal-case tracking-normal">≥ {mode.rules.minCyclesInTier} cycles</span></th>
              <th scope="col" className="px-3 py-2">Promotion<span className="block font-normal normal-case tracking-normal">last rebalance of places</span></th>
              <th scope="col" className="px-3 py-2">Demotion<span className="block font-normal normal-case tracking-normal">last rebalance of places</span></th>
              <th scope="col" className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {mode.tiers.map((tier) => {
              const expanded = expandedTier === tier.tier;
              const status = tierStatusText(tier, mode);
              const promotion = promotionText(tier, mode);
              const demotion = demotionText(tier, mode);
              const canExpand = tier.instances.length > 0;
              return (
                <Fragment key={tier.tier}>
                  <tr className={`border-b border-white/5 ${expanded ? 'bg-surface-elevated/40' : ''}`} data-testid={`league-health-tier-${tier.tier}`}>
                    <th scope="row" className="px-3 py-2.5 text-left align-top">
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={() => onToggleTier(tier.tier)}
                          aria-expanded={expanded}
                          aria-controls={panelId(tier.tier)}
                          className={`-ml-1 flex items-center gap-1.5 rounded px-1 font-semibold text-white hover:text-primary ${ADMIN_FOCUS_RING}`}
                        >
                          <span aria-hidden="true" className={`inline-block text-secondary transition-transform motion-reduce:transition-none ${expanded ? 'rotate-90' : ''}`}>›</span>
                          {tierLabel(tier.tier)}
                          <span className="sr-only">, {expanded ? 'hide' : 'show'} instances</span>
                        </button>
                      ) : (
                        <span className="pl-4 font-semibold text-tertiary">{tierLabel(tier.tier)}</span>
                      )}
                    </th>
                    <Cell value={activeOfTotal(tier)} className="text-right" />
                    <Cell value={instanceSummary(tier)} />
                    <td className="px-3 py-2.5 align-top">
                      {tier.total > 0 ? (
                        <>
                          <StableMixBar mix={tier.stableMix} className="mt-1.5 w-32" />
                          <span className="mt-1 block text-xs text-secondary">{formatCount(tier.stableMix.human)} human</span>
                        </>
                      ) : <span className="text-tertiary">—</span>}
                    </td>
                    <Cell value={tier.averageElo === null ? '—' : formatCount(tier.averageElo)} className="text-right" />
                    <Cell value={tier.total > 0 ? formatCount(tier.eligible) : '—'} className="text-right" />
                    <Cell value={promotion.value} caption={promotion.caption} />
                    <Cell value={demotion.value} caption={demotion.caption} />
                    <td className="px-3 py-2.5 align-top">
                      <span className={`block whitespace-nowrap font-medium ${STATUS_TEXT[tier.status.level]}`}>{status.label}</span>
                      {status.reason && <span className="block text-xs text-secondary">{status.reason}</span>}
                    </td>
                  </tr>
                  {expanded && canExpand && (
                    <tr>
                      <td colSpan={9} className="bg-surface-elevated/40 px-3 pb-3">
                        <TierInstances mode={mode} tier={tier} id={panelId(tier.tier)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Tiers of the selected league">
        {mode.tiers.map((tier) => {
          const expanded = expandedTier === tier.tier;
          const status = tierStatusText(tier, mode);
          const promotion = promotionText(tier, mode);
          const demotion = demotionText(tier, mode);
          const canExpand = tier.instances.length > 0;
          const border = tier.status.level === 'warning' && expanded ? 'border-warning/40' : 'border-white/10';
          return (
            <li key={tier.tier} className={`rounded-lg border bg-surface p-4 ${border}`} data-testid={`league-health-card-${tier.tier}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className={`text-base font-semibold ${tier.total > 0 ? 'text-white' : 'text-tertiary'}`}>{tierLabel(tier.tier)}</h3>
                <span className={`text-sm font-semibold ${STATUS_TEXT[tier.status.level]}`}>{status.label}</span>
              </div>
              {tier.total > 0 && (
                <>
                  <p className="mt-1 text-xs text-secondary">
                    {activeOfTotal(tier)} active · {tier.instances.length} × {tier.instanceSize ? (tier.instanceSize.min === tier.instanceSize.max ? tier.instanceSize.min : `${tier.instanceSize.min}–${tier.instanceSize.max}`) : '—'}
                    {tier.averageElo !== null && ` · ${mode.entityType === 'team' ? 'team ELO' : 'ELO'} ${formatCount(tier.averageElo)}`}
                  </p>
                  <StableMixBar mix={tier.stableMix} className="mt-2.5 w-full" />
                  <p className="mt-1.5 text-xs text-secondary">{stableMixText(tier.stableMix)}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Promotes</dt>
                      <dd className="text-sm font-semibold tabular-nums text-white">{promotion.value}</dd>
                      <dd className="text-xs text-secondary">{promotion.caption}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Demotes</dt>
                      <dd className="text-sm font-semibold tabular-nums text-white">{demotion.value}</dd>
                      <dd className="text-xs text-secondary">{demotion.caption}</dd>
                    </div>
                  </dl>
                  {status.reason && tier.status.code !== 'ok' && <p className="mt-2 text-xs text-secondary">{status.label}: {status.reason}</p>}
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-1">
                    <span className="text-xs text-secondary">
                      {formatCount(tier.eligible)} eligible{tier.unsubscribed > 0 ? ` · ${formatCount(tier.unsubscribed)} unsubscribed` : ''}
                    </span>
                    {canExpand && (
                      <button
                        type="button"
                        onClick={() => onToggleTier(tier.tier)}
                        aria-expanded={expanded}
                        aria-controls={`${panelId(tier.tier)}-m`}
                        aria-label={`${expanded ? 'Hide' : 'Show'} ${tier.instances.length} instance${tier.instances.length === 1 ? '' : 's'} of ${tierLabel(tier.tier)}`}
                        className={`min-h-11 text-sm text-primary ${ADMIN_FOCUS_RING}`}
                      >
                        {expanded ? 'Hide instances' : `${tier.instances.length} instance${tier.instances.length === 1 ? '' : 's'}`}
                      </button>
                    )}
                  </div>
                  {expanded && canExpand && <TierInstances mode={mode} tier={tier} id={`${panelId(tier.tier)}-m`} />}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
