/**
 * Overview_Row — the topmost substantive module on the Dashboard.
 *
 * Spec #48 Requirements 1 and 13. Three tiles in a FIXED order, rendered in every
 * data state: tile count and tile order never depend on data availability
 * (criterion 8), so nothing appears or disappears as the reads land.
 *
 * `grid-cols-1 lg:grid-cols-3` is the mobile-first pattern from
 * .kiro/steering/frontend-standards.md. Tailwind's `lg` breakpoint is 1024px, exactly
 * the boundary Requirement 13 names, so one utility pair covers stacking below it,
 * the equal-width three-column grid at and above it, and re-render on rotation with
 * no reload.
 *
 * No `min-w`, no `whitespace-nowrap`, no fixed pixel width and no `overflow-hidden`
 * anywhere in the row or the tiles, so nothing is clipped between 320px and 1920px.
 */

import React from 'react';
import { PrestigeTile } from './PrestigeTile';
import { TodaysBattlesTile } from './TodaysBattlesTile';
import { CreditsTile } from './CreditsTile';
import type { OverviewRowData } from './types';

export function OverviewRow({ data }: { data: OverviewRowData }): React.ReactElement {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <PrestigeTile data={data} />
      <TodaysBattlesTile data={data} />
      <CreditsTile data={data} />
    </div>
  );
}
