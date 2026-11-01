/**
 * Weapons and refinements: weapons owned and equipped (main or offhand slot),
 * then what is bought on top — refinements per kind, the attributes Hone and
 * Augment target, and the top spenders. The refinement part moved here from
 * the old `/admin/refinement` page; what refinements do to winning is on
 * Weapons.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AdminPanel, ADMIN_FOCUS_RING, PanelError } from '../shared';
import type { SystemStats } from '../types';
import type { MetaRefinements } from '../../../utils/adminMetaApi';
import { attributeLabel } from '../../../utils/adminAttributesFormat';
import { formatCount } from '../../../utils/adminDashboardFormat';
import { formatCost } from '../../../utils/adminWeaponsFormat';
import { formatPercentOf, refinementKindEffect, refinementKindLabel } from '../../../utils/adminMetaFormat';
import { MetaStat, SectionLabel } from './metaParts';

export interface WeaponsCardProps {
  weapons: SystemStats['weapons'] | null;
  refinements: MetaRefinements | null;
  loading: boolean;
  refinementsLoading: boolean;
  /** The build sections failed to load; the weapon counts may still show. */
  refinementsError?: string | null;
  onRetryRefinements?: () => void;
  className?: string;
}

function spenderName(spender: MetaRefinements['topSpenders'][number]): string {
  return spender.stableName?.trim() || spender.username;
}

function RefinementDetail({ refinements }: { refinements: MetaRefinements }): ReactNode {
  if (refinements.refinements === 0) return <p className="text-sm text-tertiary">No refinements bought</p>;
  const peak = refinements.targeted[0]?.refinements ?? 0;
  return (
    <>
      <div>
        <table className="w-full text-sm">
          <caption className="text-left">
            <SectionLabel>Refinements per kind</SectionLabel>
          </caption>
          <thead>
            <tr className="text-xs text-secondary">
              <th scope="col" className="py-1.5 text-left font-normal"><span className="sr-only">Kind</span></th>
              <th scope="col" className="py-1.5 text-right font-normal">refinements</th>
              <th scope="col" className="py-1.5 text-right font-normal">stables</th>
              <th scope="col" className="py-1.5 text-right font-normal">credits</th>
            </tr>
          </thead>
          <tbody>
            {refinements.perKind.map((kind) => (
              <tr key={kind.kind} className="border-t border-white/5">
                <th scope="row" className="py-1.5 text-left font-normal">
                  <span className="font-semibold text-white">{refinementKindLabel(kind.kind)}</span>
                  <span className="ml-2 hidden text-xs text-secondary sm:inline">{refinementKindEffect(kind.kind)}</span>
                </th>
                <td className="py-1.5 text-right tabular-nums text-white">{formatCount(kind.refinements)}</td>
                <td className="py-1.5 text-right tabular-nums text-white">{formatCount(kind.stables)}</td>
                <td className="py-1.5 text-right tabular-nums text-white">{formatCost(kind.credits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <SectionLabel>Most-targeted (Hone, Augment)</SectionLabel>
          {refinements.targeted.length === 0 ? (
            <p className="mt-2 text-sm text-tertiary">No Hone or Augment yet</p>
          ) : (
            <ul className="mt-2 space-y-1.5" aria-label="Attributes targeted by Hone and Augment">
              {refinements.targeted.slice(0, 6).map((row) => (
                <li key={row.attribute} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_2.5rem_2.5rem] items-center gap-2 text-xs">
                  <span className="truncate text-white">{attributeLabel(row.attribute)}</span>
                  <span className="block h-2.5 rounded-sm bg-white/5" aria-hidden="true">
                    <span className="block h-2.5 rounded-sm bg-warning/80" style={{ width: `${peak > 0 ? (row.refinements / peak) * 100 : 0}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-white">{formatCount(row.refinements)}×</span>
                  <span className="text-right tabular-nums text-secondary">
                    +{formatCount(row.magnitude)}<span className="sr-only"> total</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <SectionLabel>Top spenders</SectionLabel>
          <ul className="mt-1" aria-label="Top refinement spenders">
            {refinements.topSpenders.map((spender) => (
              <li key={spender.userId} className="flex items-center gap-3 text-sm">
                <Link
                  to={`/admin/players?user=${spender.userId}`}
                  className={`inline-flex min-h-11 min-w-0 flex-1 items-center truncate text-primary hover:underline ${ADMIN_FOCUS_RING}`}
                >
                  {spenderName(spender)}
                </Link>
                <span className="tabular-nums text-white">{formatCost(spender.credits)}</span>
                <span className="w-20 text-right text-xs tabular-nums text-secondary">
                  {formatCount(spender.weapons)} {spender.weapons === 1 ? 'weapon' : 'weapons'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export function WeaponsCard({
  weapons,
  refinements,
  loading,
  refinementsLoading,
  refinementsError = null,
  onRetryRefinements,
  className = '',
}: WeaponsCardProps): ReactNode {
  const equipped = weapons ? weapons.equippedInventoryItems ?? weapons.equipped : 0;

  return (
    <AdminPanel
      headingLevel={3}
      title="Weapons and refinements"
      actions={<Link to="/admin/weapons" className={`text-xs text-primary hover:underline ${ADMIN_FOCUS_RING}`}>Weapons →</Link>}
      loading={loading && !weapons}
      skeletonRows={8}
      className={className}
    >
      {weapons && (
        <div className="space-y-5 px-5 py-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-5">
            <MetaStat label="owned" value={formatCount(weapons.totalBought)} />
            <MetaStat label={`equipped (${formatPercentOf(equipped, weapons.totalBought)})`} value={formatCount(equipped)} />
            {refinements && (
              <>
                <MetaStat label={`refined (${formatPercentOf(refinements.weaponsRefined, weapons.totalBought)})`} value={formatCount(refinements.weaponsRefined)} />
                <MetaStat label="stables refine" value={`${formatCount(refinements.stablesRefining)} of ${formatCount(refinements.stables)}`} />
                <MetaStat label="spent on refinements" value={formatCost(refinements.creditsSpent)} />
              </>
            )}
          </dl>
          <p className="-mt-3 text-xs text-tertiary">Equipped counts main and offhand slots.</p>

          {refinementsError ? (
            <PanelError message={refinementsError} onRetry={onRetryRefinements} />
          ) : refinements ? (
            <RefinementDetail refinements={refinements} />
          ) : refinementsLoading ? (
            <div className="h-24 animate-pulse rounded bg-white/5 motion-reduce:animate-none" aria-hidden="true" />
          ) : null}

          <p className="text-xs text-tertiary">What a refinement does to winning is on Weapons. A stable name opens the Players panel.</p>
        </div>
      )}
    </AdminPanel>
  );
}
