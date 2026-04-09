# Design Document: Frontend Component Splitting

## Overview

Extract inline sub-components from the 6 largest frontend files into dedicated component files organized by feature area. Page components become thin orchestrators that compose sub-components and manage page-level state.

### Key Research Findings

- `PracticeArenaPage.tsx` (1,413 lines) defines 9 sub-components inline: `SlotToggle`, `BotTierSelector`, `ConfigSelect`, `SparringConfigPanel`, `WhatIfPanel`, `BattleSlotPanel`, `SimulationResultBanner`, `BatchSummary`, `HistoryPanel`.
- `FacilitiesPage.tsx` (960 lines), `WeaponShopPage.tsx` (926 lines), `HallOfRecordsPage.tsx` (940 lines), and `BattleDetailPage.tsx` (985 lines) all contain inline sub-components.
- `Navigation.tsx` (756 lines) contains inline navigation items, mobile menu, and notification components.
- The project already has a `src/components/` directory with feature-specific subdirectories (e.g., `admin/`, `onboarding/`).

## Architecture

### Directory Structure (After)

```
src/components/
├── practice-arena/
│   ├── SlotToggle.tsx
│   ├── BotTierSelector.tsx
│   ├── ConfigSelect.tsx
│   ├── SparringConfigPanel.tsx
│   ├── WhatIfPanel.tsx
│   ├── BattleSlotPanel.tsx
│   ├── SimulationResultBanner.tsx
│   ├── BatchSummary.tsx
│   ├── HistoryPanel.tsx
│   ├── types.ts
│   └── index.ts
├── facilities/
│   ├── [extracted components]
│   ├── types.ts
│   └── index.ts
├── weapon-shop/
│   ├── [extracted components]
│   ├── types.ts
│   └── index.ts
├── hall-of-records/
│   ├── [extracted components]
│   ├── types.ts
│   └── index.ts
├── battle-detail/
│   ├── [extracted components]
│   ├── types.ts
│   └── index.ts
├── navigation/
│   ├── [extracted components]
│   ├── types.ts
│   └── index.ts
```

### Extraction Pattern

For each page:

1. Identify all inline `function ComponentName(...)` definitions
2. Move shared interfaces/types to `types.ts` in the sub-component directory
3. Move each sub-component to its own file with explicit props interface
4. Create `index.ts` barrel export
5. Update the page component to import from the new directory

### Page Component Pattern (After)

```tsx
// PracticeArenaPage.tsx (after)
import { SparringConfigPanel, WhatIfPanel, BattleSlotPanel, HistoryPanel, SimulationResultBanner, BatchSummary } from '../components/practice-arena';

export function PracticeArenaPage() {
  // Page-level state and effects
  const [slots, setSlots] = useState<SlotState[]>([...]);
  // ...

  return (
    <div>
      <SparringConfigPanel config={config} onChange={setConfig} />
      <WhatIfPanel robot={robot} overrides={overrides} ... />
      <BattleSlotPanel slots={slots} ... />
      {result && <SimulationResultBanner result={result} />}
      <HistoryPanel history={history} />
    </div>
  );
}
```

## Components and Interfaces

### Shared Types Pattern

```typescript
// src/components/practice-arena/types.ts
export interface OwnedRobot { /* from PracticeArenaPage */ }
export interface SparringPartnerDef { /* from PracticeArenaPage */ }
export interface SparringConfig { /* from PracticeArenaPage */ }
export interface WhatIfOverrides { /* from PracticeArenaPage */ }
export interface SlotState { /* from PracticeArenaPage */ }
export interface PracticeBattleResult { /* from PracticeArenaPage */ }
export interface PracticeBatchResult { /* from PracticeArenaPage */ }
```

### Barrel Export Pattern

```typescript
// src/components/practice-arena/index.ts
export { SlotToggle } from './SlotToggle';
export { BotTierSelector } from './BotTierSelector';
// ... etc
export type { OwnedRobot, SparringConfig, SlotState } from './types';
```

## Data Models

No data model changes. This is a pure frontend code organization refactoring.

## Documentation Impact

- `.kiro/steering/frontend-standards.md` — Add a "Component Size Guidelines" section specifying maximum page component size (300 lines) and the extraction pattern for sub-components.

## Testing Strategy

### Approach
- Frontend build (`npm run build`) serves as the primary regression check — TypeScript compilation catches broken imports and type mismatches.
- Manual visual verification that pages render identically (no automated visual regression tests exist).
- No new tests in this spec — frontend testing is covered by spec 20.

### Verification
- Run `npm run build` after each page extraction.
- Verify line counts meet targets.
- Verify no inline component definitions remain in page files.
