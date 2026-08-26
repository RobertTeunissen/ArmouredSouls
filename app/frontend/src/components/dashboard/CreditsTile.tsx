/**
 * Credits_Tile — "am I making or losing money, and where is it going?"
 *
 * Spec #48 Requirement 6, amended 26 August 2026. Repair spend is split by
 * `repairType` — automatic and manual as two plain lines — rather than reported as a
 * total plus a derived "avoidable" figure.
 *
 * The split carries the same message with less text and no arithmetic to explain. An
 * automatic repair is one the player was not present for, charged at full price; a
 * manual one is a repair they took at half price. So the automatic line IS the cost of
 * not logging in, stated as money actually spent rather than as a hypothetical saving.
 * The previous line read "Avoidable — repair before each robot's next match", which
 * needed a sentence of label to explain a number that was not a real transaction.
 */

import React from 'react';
import {
  DashboardTile,
  DashboardTileStat,
  DashboardTileNote,
} from './DashboardTile';
import type { OverviewRowData } from './types';

export function CreditsTile({ data }: { data: OverviewRowData }): React.ReactElement {
  const { creditBalance, cycleProgress, isLoading, error } = data;

  // Requirement 6 criteria 10 and 13: the balance and the Income_Dashboard link
  // survive a failed read, so this tile is NOT put into the shared error state — that
  // would hide both. The three cycle figures are replaced by an inline note instead.
  const readFailed = error !== null || cycleProgress === null;

  const automaticSpend = cycleProgress?.repairSpend.automatic ?? 0;
  const manualSpend = cycleProgress?.repairSpend.manual ?? 0;
  const repairSpend = automaticSpend + manualSpend;

  const comparison = cycleProgress?.comparison;
  const comparisonRepair = comparison?.repairSpend;

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
              zeroes.

              When there IS spend, both lines render even if one of them is zero. A zero
              on the automatic line is the good news: every repair was caught at half
              price. Hiding it would remove the only place that shows so. */}
          {repairSpend > 0 ? (
            <>
              <DashboardTileStat
                label="Automatic repairs"
                value={`₡${automaticSpend.toLocaleString()}`}
                period="current-cycle"
                comparison={
                  comparisonRepair
                    ? { value: `₡${comparisonRepair.automatic.toLocaleString()}` }
                    : undefined
                }
                delta={comparisonRepair ? automaticSpend - comparisonRepair.automatic : undefined}
                signMeaning="lower-is-better"
              />

              <DashboardTileStat
                label="Manual repairs"
                value={`₡${manualSpend.toLocaleString()}`}
                period="current-cycle"
                comparison={
                  comparisonRepair
                    ? { value: `₡${comparisonRepair.manual.toLocaleString()}` }
                    : undefined
                }
                delta={comparisonRepair ? manualSpend - comparisonRepair.manual : undefined}
                // `no-meaning`, deliberately, while the automatic line above is
                // `lower-is-better`. Every credit on the automatic line is a credit the
                // player would have halved by showing up, so a rise there is
                // unambiguously bad. Manual spend has no such direction: it rises when a
                // player fights more AND when they start catching repairs they used to
                // miss. Rendering that in the error colour would flag the behaviour the
                // discount exists to encourage. DashboardTile applies a colour only when
                // the direction is meaningful, and here it is not.
                signMeaning="no-meaning"
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
