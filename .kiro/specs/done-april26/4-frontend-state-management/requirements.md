# Requirements Document

## Introduction

Evaluate and introduce Zustand as a lightweight state management solution for the Armoured Souls frontend, starting with the most-shared domain (robot/stable data) as a pilot. The current approach — 2 React Contexts (Auth, Onboarding) plus direct API fetching in components — works but will hit scaling issues as cross-page data sharing grows. This spec introduces Zustand incrementally for the first high-value use case, establishes the pattern, and defines criteria for when to migrate additional domains.

## Glossary

- **Zustand_Store**: A lightweight state container created with Zustand's `create()` function that holds state and actions for a specific domain.
- **Robot_Store**: The first Zustand store, managing the authenticated user's robot roster, which is accessed across multiple pages (dashboard, robot list, robot detail, battle history, matchmaking).
- **Stable_Store**: A Zustand store managing the user's stable-level data (currency, prestige, stable name, aggregate stats) that is referenced across the dashboard, income page, and facilities page.
- **Context_Provider**: The existing React Context pattern used for Auth and Onboarding state.

## Expected Contribution

This spec targets the "state management will hit a wall" debt identified in the project assessment. The expected measurable outcomes after all tasks are complete:

1. **Redundant API calls eliminated**: Pages that share robot data (dashboard, robot list, robot detail, matchmaking) fetch once via the store instead of independently. Before: `fetchMyRobots()` called 4+ times across pages. After: called once, shared via store.
2. **Currency consistency**: Currency/prestige displayed on dashboard, income page, and facilities page comes from a single store. Before: each page fetches independently, risking stale data after purchases.
3. **Logout data hygiene**: All Zustand stores are cleared on logout. Before: no centralized cleanup mechanism for component-local state.
4. **Re-render efficiency**: Components subscribe to specific state slices via Zustand selectors. Before: Context-based sharing would cause all consumers to re-render on any state change.
5. **Documented decision framework**: Clear guidelines for when to use Zustand vs. local state vs. Context, preventing ad-hoc decisions as the app grows.

### Verification Criteria

After all tasks are marked complete, run these checks to confirm the debt reduction was achieved:

1. `grep -r "fetchMyRobots()" src/pages/ src/components/` returns zero direct calls (all go through the store)
2. `src/stores/robotStore.ts` and `src/stores/stableStore.ts` exist with `fetchRobots`, `fetchStableData`, and `clear` actions
3. The `AuthContext.logout()` function calls `.clear()` on both stores
4. All frontend tests pass
5. A state management guideline document exists in `.kiro/steering/` or `docs/guides/`
6. `zustand` appears in `app/frontend/package.json` dependencies

## Requirements

### Requirement 1: Zustand Installation and Configuration

**User Story:** As a frontend developer, I want Zustand installed and configured as the project's state management library, so that I can create stores for shared data without the boilerplate and re-render overhead of React Context.

#### Acceptance Criteria

1. WHEN Zustand is added, IT SHALL be installed as a production dependency in `app/frontend/package.json` at the latest stable version compatible with React 19.
2. WHEN Zustand is configured, A `src/stores/` directory SHALL be created to house all Zustand stores.
3. WHEN Zustand is configured, THE existing Auth and Onboarding contexts SHALL NOT be migrated — they remain as React Context (migration is out of scope for this spec).

### Requirement 2: Robot Store

**User Story:** As a frontend developer, I want a Zustand store for the user's robot roster, so that multiple pages can access robot data without redundant API calls or prop drilling.

#### Acceptance Criteria

1. WHEN a `src/stores/robotStore.ts` is created, IT SHALL hold the user's robot list, loading state, error state, and a `fetchRobots()` action that calls the API and populates the store.
2. WHEN `fetchRobots()` is called, IT SHALL use the refactored API helper (from Spec 2) to fetch robots and store them.
3. WHEN a component accesses the robot store, IT SHALL receive only the slices of state it subscribes to, avoiding unnecessary re-renders when unrelated state changes.
4. WHEN the user logs out, THE robot store SHALL be cleared.
5. WHEN the robot store is populated, COMPONENTS that currently call `fetchMyRobots()` directly SHALL be refactored to read from the store instead.

### Requirement 3: Stable Store

**User Story:** As a frontend developer, I want a Zustand store for stable-level data (currency, prestige, stats), so that the dashboard, income page, and facilities page share a single source of truth without redundant fetches.

#### Acceptance Criteria

1. WHEN a `src/stores/stableStore.ts` is created, IT SHALL hold the user's currency, prestige, stable statistics, loading state, and a `fetchStableData()` action.
2. WHEN `fetchStableData()` is called, IT SHALL fetch from the user stats and financial summary endpoints and merge the results into the store.
3. WHEN currency changes (weapon purchase, facility upgrade, battle reward), THE store SHALL be refreshed or optimistically updated.
4. WHEN the user logs out, THE stable store SHALL be cleared.

### Requirement 4: Migration Criteria for Future Stores

**User Story:** As a frontend developer, I want documented criteria for when to create a new Zustand store vs. keeping data in component-local state, so that the team makes consistent decisions as the app grows.

#### Acceptance Criteria

1. WHEN this spec is complete, A guideline SHALL be documented (in steering or a docs file) specifying that a Zustand store is warranted when: (a) 3+ pages need the same data, (b) the data changes in response to actions on other pages, or (c) the data is expensive to fetch and benefits from caching.
2. WHEN this spec is complete, THE guideline SHALL specify that component-local state (useState/useReducer) remains the default for data used by a single component or page.
3. WHEN this spec is complete, THE guideline SHALL specify that React Context remains appropriate for truly global, rarely-changing state (auth session, theme preference).
