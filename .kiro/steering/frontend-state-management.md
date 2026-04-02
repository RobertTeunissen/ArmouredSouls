---
inclusion: fileMatch
fileMatchPattern: "**/frontend/src/**,**/stores/**"
---

# Frontend State Management Guidelines

## Decision Framework: The 3-Criteria Rule

Before creating a new Zustand store, check if the data meets at least one of these criteria:

1. **3+ pages need the same data** — If three or more pages/routes consume the same server data, a store eliminates redundant fetches and keeps them in sync.
2. **Cross-page mutations** — If an action on one page (e.g., buying a weapon) must update data displayed on another page (e.g., currency on the dashboard), a store provides a single source of truth.
3. **Expensive fetches that benefit from caching** — If the API call is slow or returns a large payload, caching it in a store avoids re-fetching on every navigation.

If none of these apply, use local state (`useState` / `useReducer`).

## When to Use Each Approach

### Zustand Store
- Robot roster (accessed by dashboard, robot list, robot detail, matchmaking, battle history)
- Stable data — currency, prestige, stats (accessed by dashboard, income page, facilities)
- Any future domain that meets the 3-criteria rule

### Local State (`useState` / `useReducer`)
- Form inputs and validation state
- UI toggles (expanded/collapsed, modals, tabs)
- Data used by a single component or page
- Temporary data that doesn't need to survive navigation

### React Context
- Auth session (user, token, login/logout) — global, rarely changes
- Onboarding state — global, rarely changes
- Theme preferences — global, rarely changes
- Any truly global, rarely-changing state where provider scoping is useful

## Store Selector Pattern

Always use selectors when reading from a Zustand store. Never subscribe to the entire store object.

```typescript
// GOOD — only re-renders when `robots` changes
const robots = useRobotStore(state => state.robots);
const loading = useRobotStore(state => state.loading);

// BAD — re-renders on ANY state change in the store
const store = useRobotStore();
```

For multiple related fields, use a single selector that returns an object with `shallow` comparison:

```typescript
import { useShallow } from 'zustand/react/shallow';

const { currency, prestige } = useStableStore(
  useShallow(state => ({ currency: state.currency, prestige: state.prestige }))
);
```

## Store Structure

All stores live in `src/stores/` and are re-exported from `src/stores/index.ts`.

Each store follows this pattern:
- State fields (data, loading, error)
- Async actions that call API helpers and update state
- A `clear()` action that resets to initial state (called on logout)

```typescript
import { create } from 'zustand';

interface ExampleState {
  data: SomeType[];
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  clear: () => void;
}

const initialState = {
  data: [] as SomeType[],
  loading: false,
  error: null as string | null,
};

export const useExampleStore = create<ExampleState>((set) => ({
  ...initialState,
  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchFromApi();
      set({ data, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch', loading: false });
    }
  },
  clear: () => set({ ...initialState }),
}));
```

## Logout Cleanup

Every Zustand store must be cleared when the user logs out. The `AuthContext.logout()` function calls `.getState().clear()` on each store:

```typescript
useRobotStore.getState().clear();
useStableStore.getState().clear();
```

When adding a new store, add its `.clear()` call to the logout function.

## Existing Stores

| Store | File | Key Data | Actions |
|-------|------|----------|---------|
| Robot Store | `src/stores/robotStore.ts` | robots, loading, error | `fetchRobots()`, `clear()` |
| Stable Store | `src/stores/stableStore.ts` | currency, prestige, stats, financialSummary, loading, error | `fetchStableData()`, `refreshCurrency()`, `clear()` |
