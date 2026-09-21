---
inclusion: fileMatch
fileMatchPattern: "**/frontend/src/stores/**,**/frontend/src/**/*Store.ts,**/frontend/src/**/AuthContext*.tsx,**/stores/**"
---

# Frontend State Management

## Choose the narrowest owner
- Use local state (`useState`/`useReducer`) for component/page UI, forms, toggles, and temporary data.
- Use React Context only for stable, truly global state such as authentication, onboarding, or theme preferences.
- Create a Zustand store when at least one condition applies: three or more pages consume the data, a mutation must update data across pages, or an expensive/large fetch benefits from caching.

## Store contract
- Stores live in `src/stores/` and are re-exported from `src/stores/index.ts`.
- Define explicit state/action types. Keep API calls in typed helpers/services, expose loading/error state where needed, and provide `clear()` to restore initial state.
- Read Zustand state through selectors; never subscribe to the whole store. Select only fields needed by a component and use shallow comparison for multiple related fields.
- Every store must be cleared during logout. When adding a store, add its `useXStore.getState().clear()` call to `AuthContext.logout()`.

`frontend-standards.md` owns component/API/async UI rules; `coding-standards.md` owns the cross-cutting selector reminder. This file owns state ownership, store creation, selector scope, and logout cleanup.
