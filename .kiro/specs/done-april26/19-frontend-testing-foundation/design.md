# Design Document: Frontend Testing Foundation — Coverage Gaps

## Overview

Write tests for the four untested utility files and three extracted component directories, then update steering documentation. The test infrastructure, store tests, and CI integration already exist — this spec only covers the remaining gaps.

### Key Research Findings

- The frontend already has 118 test files, a fully configured `vitest.config.ts`, `setupTests.ts`, and CI integration in `.github/workflows/ci.yml`.
- Store tests (`stableStore.test.ts`, `robotStore.test.ts`) already exist in `src/stores/__tests__/`.
- `bracketUtils.test.ts` already exists in `src/utils/__tests__/` — no need to create it.
- The four untested utility files are: `robotStats.ts` (12 exported functions + 2 exported constants), `battleHistoryStats.ts` (1 main function + constants), `formatters.ts` (4 functions), `weaponRange.ts` (5 functions).
- Spec 18 created component directories `practice-arena/`, `facilities/`, `weapon-shop/` with extracted sub-components. Page-level tests exist in `src/pages/__tests__/` but no sub-component tests exist inside these directories.
- The project convention uses `__tests__/` subdirectories (not co-located test files), as seen in `src/utils/__tests__/`, `src/stores/__tests__/`, `src/components/__tests__/`, etc.

## Architecture

### Test File Organization

All new test files follow the existing `__tests__/` subdirectory convention:

```
prototype/frontend/src/
├── utils/
│   └── __tests__/
│       ├── robotStats.test.ts          # NEW — tests for robotStats.ts
│       ├── battleHistoryStats.test.ts  # NEW — tests for battleHistoryStats.ts
│       ├── formatters.test.ts          # NEW — tests for formatters.ts
│       ├── weaponRange.test.ts         # NEW — tests for weaponRange.ts
│       ├── bracketUtils.test.ts        # EXISTS
│       ├── api.test.ts                 # EXISTS
│       ├── ApiError.test.ts            # EXISTS
│       └── ...                         # EXISTS
├── components/
│   ├── practice-arena/
│   │   └── __tests__/
│   │       └── WhatIfPanel.test.tsx    # NEW — sub-component test
│   ├── facilities/
│   │   └── __tests__/
│   │       └── FacilityCard.test.tsx   # NEW — sub-component test
│   └── weapon-shop/
│       └── __tests__/
│           └── WeaponCard.test.tsx     # NEW — sub-component test
```

### No Infrastructure Changes

The following already exist and require no changes:
- `vitest.config.ts` — jsdom environment, v8 coverage, globals enabled
- `src/setupTests.ts` — RTL cleanup, jest-dom matchers, matchMedia/localStorage/sessionStorage mocks
- `package.json` — `test`, `test:coverage`, `test:ui` scripts
- All devDependencies — vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, @vitest/coverage-v8, jsdom, fast-check
- `.github/workflows/ci.yml` — `frontend-tests` job running `npx vitest --run`

## Components and Interfaces

### Utility Test Patterns

#### robotStats.test.ts

Tests the 12 exported functions and 2 exported constants. Key test areas:

```typescript
// src/utils/__tests__/robotStats.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateAttributeBonus, getLoadoutBonus, getStanceModifier,
  calculateEffectiveStat, calculateEffectiveStats, calculateMaxHP,
  calculateMaxShield, getAttributeDisplay, getLoadoutModifiedAttributes,
  formatLoadoutName, getLoadoutDescription, LOADOUT_BONUSES, STANCE_MODIFIERS,
} from '../robotStats';

describe('calculateAttributeBonus', () => {
  it('should sum bonuses from main and offhand weapons', () => { /* ... */ });
  it('should handle null/undefined weapons', () => { /* ... */ });
  it('should return 0 when no weapons have the attribute', () => { /* ... */ });
});

describe('calculateEffectiveStat', () => {
  it('should apply floor to the result', () => { /* ... */ });
  it('should apply loadout multiplier correctly', () => { /* ... */ });
});
// ... etc for all 12 functions
```

#### battleHistoryStats.test.ts

Tests `computeBattleSummary` with various battle configurations. Requires mocking the `matchmakingApi` helpers (`getBattleOutcome`, `getELOChange`, `getBattleReward`):

```typescript
// src/utils/__tests__/battleHistoryStats.test.ts
import { describe, it, expect, vi } from 'vitest';
import { computeBattleSummary, EMPTY_SUMMARY } from '../battleHistoryStats';

// Mock the matchmakingApi helpers
vi.mock('../matchmakingApi', () => ({
  getBattleOutcome: vi.fn(),
  getELOChange: vi.fn(),
  getBattleReward: vi.fn(),
}));
```

#### formatters.test.ts and weaponRange.test.ts

Pure function tests with no mocking needed:

```typescript
// src/utils/__tests__/formatters.test.ts
describe('formatCurrency', () => {
  it('should format with ₡ prefix and locale separators', () => {
    expect(formatCurrency(1500)).toBe('₡1,500');
  });
  it('should handle NaN gracefully', () => {
    expect(formatCurrency(NaN)).toBe('₡0');
  });
});
```

### Component Test Patterns

Sub-component tests render the extracted component with mocked props and verify rendering and basic interactions:

```typescript
// src/components/facilities/__tests__/FacilityCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FacilityCard } from '../FacilityCard';

const mockFacility = {
  type: 'training_facility', name: 'Training Facility',
  description: 'Reduces upgrade costs', currentLevel: 3, maxLevel: 10,
  // ... minimal required props
};

describe('FacilityCard', () => {
  it('should display facility name and level', () => {
    render(<FacilityCard facility={mockFacility} /* ... */ />);
    expect(screen.getByText('Training Facility')).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('should disable upgrade button when insufficient credits', () => {
    render(<FacilityCard facility={mockFacility} currency={0} /* ... */ />);
    expect(screen.getByRole('button', { name: /upgrade/i })).toBeDisabled();
  });
});
```

For `WhatIfPanel`, the component imports from `shared/utils/` — these will need to be mocked or the test will need the shared module path alias configured. The existing `vitest.config.ts` already resolves `@` to `./src`, but the `../../../../shared/` relative imports should work as-is since vitest resolves from the file's location.

For `WeaponCard`, the component imports `calculateWeaponWorkshopDiscount` from `shared/utils/discounts` and `getWeaponImagePath` from `../../utils/weaponImages` — mock these to isolate the component.

## Data Models

No data model changes.

## Documentation Impact

- `.kiro/steering/testing-strategy.md` — Add a "Frontend Testing" section covering:
  - Framework: Vitest 4 + React Testing Library + fast-check
  - Setup file: `src/setupTests.ts`
  - File convention: `__tests__/` subdirectories (not co-located)
  - Coverage targets: 80% for utilities/stores, baseline for components
  - Running tests: `cd prototype/frontend && npx vitest --run`
  - Coverage: `cd prototype/frontend && npx vitest --run --coverage`
  - CI: Already integrated in `.github/workflows/ci.yml` `frontend-tests` job

- `.kiro/steering/frontend-standards.md` — Add a "Testing" section with:
  - Test file location: `__tests__/` subdirectory next to source
  - Naming: `*.test.ts` for utilities, `*.test.tsx` for components, `*.pbt.test.ts(x)` for property-based
  - Minimum coverage: 80% for utilities and stores
  - Component tests: use RTL render/screen, mock API calls, test user interactions

## Testing Strategy

This spec adds tests only — no production code changes. The approach:

1. Utility tests first (pure functions, no rendering, highest confidence).
2. Component tests second (require mocking, rendering, more complex setup).
3. All tests use the existing infrastructure — no config changes needed.
