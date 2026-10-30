/**
 * Refinements (adoption by tier, and their effect once there are enough
 * comparisons) and catalogue coverage, with the weapons no player owns.
 */
import { useId, useState } from 'react';
import { ADMIN_FOCUS_RING } from '../shared';
import type { CoverageSummary, RefinementSummary, RefinementTier } from './types';
import { effectDescription, formatCount } from '../../../utils/adminAttributesFormat';
import { formatUsage } from '../../../utils/adminWeaponsFormat';

export interface RefinementsCoverageProps {
  refinements: RefinementSummary;
  coverage: CoverageSummary;
  notOwnedByPlayers: Array<{ weaponId: number; name: string }>;
}

const TIER_LABELS: Record<RefinementTier, string> = { hone: 'Hone', augment: 'Augment', sharpen: 'Sharpen', forge: 'Forge' };

export function RefinementsCoverage({ refinements, coverage, notOwnedByPlayers }: RefinementsCoverageProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const tiers = (Object.keys(TIER_LABELS) as RefinementTier[]).map((t) => `${TIER_LABELS[t]} ${formatUsage(refinements.tierShares[t])}`).join(' · ');
  return (
    <div className="space-y-3 p-4 text-sm text-secondary sm:p-5">
      <p>
        <span className="text-white">Refined weapons:</span> {formatUsage(refinements.refinedShare)} of {formatCount(refinements.robots)} robots that fought
        <span className="block text-xs text-tertiary">{tiers}</span>
      </p>
      <p>
        <span className="text-white">Effect of refined weapons:</span>{' '}
        {refinements.effect.effect === null
          ? `shown from 100 comparisons where the sides differ (now ${formatCount(refinements.comparisons)}).`
          : `${effectDescription(refinements.effect)} at equal strength.`}
      </p>
      <p>
        <span className="text-white">Coverage:</span> {coverage.fought} of {coverage.catalogue} weapons fought with in this window · by players&apos; robots: {coverage.foughtByPlayers}.
      </p>
      {notOwnedByPlayers.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((value) => !value)}
            className={`min-h-11 rounded px-1 text-sm text-primary hover:underline ${ADMIN_FOCUS_RING}`}
          >
            {open ? 'Hide' : 'Show'} the {notOwnedByPlayers.length} weapons no player owns
          </button>
          {open && (
            <ul id={listId} className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-secondary">
              {notOwnedByPlayers.map((w) => <li key={w.weaponId}>{w.name}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
