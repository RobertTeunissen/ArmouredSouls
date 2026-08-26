/**
 * Credits_Tile — "am I making or losing money, and was any of the loss avoidable?"
 *
 * Spec #48 Requirement 6. Avoidable_Repair_Spend is the point of this tile: it is the
 * only figure on the Overview_Row that responds to whether the player showed up
 * before their robots fought.
 */

import React from 'react';
import {
  DashboardTile,
  DashboardTileStat,
  DashboardTileNote,
} from './DashboardTile';
import type { OverviewRowData } from './types';
import { MANUAL_REPAIR_DISCOUNT } from '../../../../shared/utils/repairCost';

/**
 * Credits the player would have kept by repairing manually.
 *
 * NOTE: this multiplies by `MANUAL_REPAIR_DISCOUNT` directly rather than calling
 * `applyManualRepairDiscount`. That is deliberate and not a breach of Requirement 15
 * criterion 9, whose ban is on applying the discount to a Repair_Quote at a call
 * site. This derives a DIFFERENT quantity — what was forgone by not taking the
 * discount — from a total that was already charged. The two look alike at a glance,
 * which is why it is spelled out.
 */
function avoidableRepairSpend(automaticSpend: number): number {
  return Math.round(automaticSpend * MANUAL_REPAIR_DISCOUNT);
}

export function CreditsTile({ data }: { data: OverviewRowData }): React.ReactElement {
  const { creditBalance, cycleProgress, isLoading, error } = data;

  // Requirement 6 criteria 10 and 13: the balance and the Income_Dashboard link
  // survive a failed read, so this tile is NOT put into the shared error state — that
  // would hide both. The three cycle figures are replaced by an inline note instead.
  const readFailed = error !== null || cycleProgress === null;

  const repairSpend = cycleProgress
    ? cycleProgress.repairSpend.manual + cycleProgress.repairSpend.automatic
    : 0;
  const avoidable = cycleProgress ? avoidableRepairSpend(cycleProgress.repairSpend.automatic) : 0;

  const comparison = cycleProgress?.comparison;
  const comparisonRepair = comparison?.repairSpend;
  const comparisonRepairTotal =
    comparisonRepair ? comparisonRepair.manual + comparisonRepair.automatic : undefined;
  const comparisonAvoidable =
    comparisonRepair ? avoidableRepairSpend(comparisonRepair.automatic) : undefined;

  const content = (
    <>
      {/* Requirement 11 criterion 4: the balance takes the NEUTRAL stat treatment,
          not the favourable one. Green means healthy in this system, and a balance is
          a neutral point-in-time figure that the navigation bar already shows. Which
          class that maps to is DashboardTile's business, not this file's — passing
          `no-meaning` is how that is expressed. */}
      <DashboardTileStat
        label="Balance"
        value={`₡${Math.round(creditBalance).toLocaleString()}`}
        period="current-cycle"
        signMeaning="no-meaning"
      />

      {readFailed ? (
        <DashboardTileNote message="Today's earnings and repair figures could not be loaded." />
      ) : (
        <>
          <DashboardTileStat
            label="Battle earnings"
            value={`₡${cycleProgress!.battleEarnings.toLocaleString()}`}
            period="current-cycle"
            comparison={
              comparison ? { value: `₡${comparison.battleEarnings.toLocaleString()}` } : undefined
            }
            delta={comparison ? cycleProgress!.battleEarnings - comparison.battleEarnings : undefined}
            signMeaning="higher-is-better"
          />

          {/* Requirement 10 criterion 8: both repair lines are omitted TOGETHER when
              nothing was spent — a stable that fought clean should not be shown two
              zeroes. */}
          {repairSpend > 0 ? (
            <>
              <DashboardTileStat
                label="Repairs"
                value={`₡${repairSpend.toLocaleString()}`}
                period="current-cycle"
                comparison={
                  comparisonRepairTotal !== undefined
                    ? { value: `₡${comparisonRepairTotal.toLocaleString()}` }
                    : undefined
                }
                delta={
                  comparisonRepairTotal !== undefined
                    ? repairSpend - comparisonRepairTotal
                    : undefined
                }
                signMeaning="lower-is-better"
              />

              {/* Requirement 6 criterion 9: the label names a robot's next scheduled
                  match as the deadline. Automatic repair is scoped per event, not per
                  cycle, so "at settlement" would be wrong. */}
              <DashboardTileStat
                label="Avoidable — repair before each robot's next match"
                value={`₡${avoidable.toLocaleString()}`}
                period="current-cycle"
                comparison={
                  comparisonAvoidable !== undefined
                    ? { value: `₡${comparisonAvoidable.toLocaleString()}` }
                    : undefined
                }
                delta={
                  comparisonAvoidable !== undefined ? avoidable - comparisonAvoidable : undefined
                }
                signMeaning="lower-is-better"
              />
            </>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <DashboardTile
      title="Credits"
      clickThrough={{ label: 'Full breakdown', to: '/income' }}
      isLoading={isLoading}
      error={null}
      content={content}
      loadingRows={4}
    />
  );
}
