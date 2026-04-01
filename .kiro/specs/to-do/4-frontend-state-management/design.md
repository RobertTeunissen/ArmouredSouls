# Design Document: Frontend State Management

## Overview

Introduce Zustand as a lightweight state management layer for the Armoured Souls frontend, starting with two pilot stores: `robotStore` (user's robot roster) and `stableStore` (currency, prestige, aggregate stats). These are the most-shared data domains, accessed across 5+ pages each. The existing Auth and Onboarding contexts remain unchanged.

### Key Research Findings

- Current state management: 2 React Contexts (Auth, Onboarding) + direct API fetching in components.
- `fetchMyRobots()` from `robotApi.ts` is called independently by multiple pages (dashboard, robot list, robot detail, matchmaking), causing redundant API calls.
- Currency/prestige data is fetched separately by the dashboard, income page, and facilities page.
- Zustand is ~1KB gzipped, requires no providers, and integrates cleanly with React 19.
- Zustand's selector pattern (`useStore(state => state.robots)`) prevents unnecessary re-renders — only components subscribed to changed slices re-render.

## Architecture

```
src/stores/
├── robotStore.ts       # Robot roster state + actions
├── stableStore.ts      # Stable-level data (currency, prestige, stats)
└── index.ts            # Re-exports for convenience
```

### Store Pattern

Each store follows the same pattern:

```typescript
import { create } from 'zustand';
import { api } from '../utils/api';

interface RobotState {
  robots: Robot[];
  loading: boolean;
  error: string | null;
  fetchRobots: () => Promise<void>;
  clear: () => void;
}

export const useRobotStore = create<RobotState>((set) => ({
  robots: [],
  loading: false,
  error: null,

  fetchRobots: async () => {
    set({ loading: true, error: null });
    try {
      const robots = await fetchMyRobots();
      set({ robots, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch robots', loading: false });
    }
  },

  clear: () => set({ robots: [], loading: false, error: null }),
}));
```

### Integration with Auth

When the user logs out (via `AuthContext.logout()`), the logout function also calls `useRobotStore.getState().clear()` and `useStableStore.getState().clear()` to reset store state. This avoids stale data from a previous session.

### Component Migration

Before:
```typescript
function RobotList() {
  const [robots, setRobots] = useState<Robot[]>([]);
  useEffect(() => { fetchMyRobots().then(setRobots); }, []);
  // ...
}
```

After:
```typescript
function RobotList() {
  const robots = useRobotStore(state => state.robots);
  const fetchRobots = useRobotStore(state => state.fetchRobots);
  useEffect(() => { fetchRobots(); }, [fetchRobots]);
  // ...
}
```

## Components and Interfaces

### Robot Store (`src/stores/robotStore.ts`)

State:
- `robots: Robot[]` — the user's robot roster
- `loading: boolean` — fetch in progress
- `error: string | null` — last error message

Actions:
- `fetchRobots()` — fetches from API, updates state
- `clear()` — resets to initial state (called on logout)

### Stable Store (`src/stores/stableStore.ts`)

State:
- `currency: number`
- `prestige: number`
- `stats: StableStatistics | null`
- `financialSummary: FinancialSummary | null`
- `loading: boolean`
- `error: string | null`

Actions:
- `fetchStableData()` — fetches user stats + financial summary, merges into state
- `refreshCurrency()` — lightweight refresh of just currency (after purchases)
- `clear()` — resets to initial state

## Data Models

No new data models. Stores use existing TypeScript interfaces from `robotApi.ts`, `userApi.ts`, and `financialApi.ts`.

## Correctness Properties

### Property 1: Store isolation

For any Zustand store, a state change in one store must not trigger re-renders in components that only subscribe to a different store.

### Property 2: Logout clears all stores

When the user logs out, all Zustand stores must be reset to their initial state. No stale data from a previous session may persist.

## Documentation Impact

The following existing documentation and steering files will need updating:

- `.kiro/steering/frontend-standards.md` — State Management section currently describes only Context API. Must be updated to include Zustand stores and the selector pattern.
- `.kiro/steering/project-overview.md` — Frontend section lists "State Management: React Context + hooks". Must be updated to "Zustand + React Context + hooks".
- New steering file `.kiro/steering/frontend-state-management.md` — State management decision guidelines (when to use Zustand vs. local state vs. Context).

## Testing Strategy

### Unit Tests
- Test each store in isolation: initial state, fetch action (with mocked API), error handling, clear action
- Test selector patterns: verify that subscribing to a specific slice only triggers re-renders when that slice changes

### Integration Tests
- Test that logout clears all stores
- Test that multiple components reading from the same store share state (no redundant fetches)

### Migration Verification
- After migrating each page to use stores, run the full frontend test suite
- Verify no visual regressions on affected pages
