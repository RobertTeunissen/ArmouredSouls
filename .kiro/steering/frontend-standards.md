---
inclusion: fileMatch
fileMatchPattern: "**/frontend/src/**,**/*.tsx,**/*.jsx,**/*.css,**/tailwind.config.*,**/vite.config.*"
---

# Frontend Standards

## Components and extraction
- Keep page components under 300 lines, layout components under 200, and feature components under 300 where practical.
- When a component grows beyond that, extract a kebab-case feature directory, typed `types.ts`, focused subcomponents, hooks for complex logic, and an `index.ts` barrel. Keep the page responsible for composition.
- Presentational components receive typed props and render UI; containers/hooks own fetching and orchestration. Keep components focused and one-way data flow explicit.
- Use functional React components and React 19 conventions (`ref` is a regular prop; use parameters instead of `defaultProps`).

## State
`frontend-state-management.md` owns the local state/Context/Zustand decision framework. Always use Zustand selectors; never subscribe to the whole store. Use local state for component UI, Context for stable global state, and stores for shared cross-page state.

## API integration
- All frontend API calls use the typed `api` helper from `src/utils/api.ts`; it handles JWT interception, returns unwrapped typed data, and normalizes failures as `ApiError`.
- Domain API modules live in `src/utils/` and expose typed functions. Do not access Axios `.data` directly when using the helper.
- Branch on `ApiError.code`, preserve structured `details`, and expose user-safe loading, empty, network, authorization, and domain-error states. Detailed server error contracts are in `error-handling-logging.md`.
- Keep fetching/orchestration in hooks or services rather than render components; cancel or ignore stale requests where the pattern requires it.

## Forms and async UI
- Use controlled inputs or the project form abstraction, validate at the boundary, show field-level errors, disable duplicate submission, and preserve server error codes.
- Every async view handles loading, empty, success, and failure states. Optimistic updates must revert on failure and must not bypass server authorization or mutation rules.

## Responsive and accessible UI
- Use semantic elements, keyboard/focus support, labels, appropriate ARIA only when needed, visible focus, and `prefers-reduced-motion` support.
- Use mobile-first responsive layouts and design tokens from `docs/design_ux/`; do not invent ad-hoc colors or spacing.
- For responsive canvases/containers, use `src/hooks/useContainerSize.ts` with `ResizeObserver`, clamped dimensions, and device-pixel-ratio handling instead of fixed canvas constants.
- For multi-section pages, use the `TabLayout` pattern: desktop tabs at ≥1024px and stacked mobile content below that breakpoint. Hide empty tabs and preserve tab state across refreshes.

## Data derivation and performance
- Move API-response aggregation into pure functions in `src/utils/`; keep components focused on rendering and test conservation/edge-case properties.
- Derivations must handle empty input and division by zero safely. Use `useMemo` only for expensive stable computations, `useCallback` for passed handlers when it prevents meaningful churn, and `memo` when measured prop stability justifies it.
- Avoid N+1 fetches, unnecessary global subscriptions, unvirtualized large lists, and unoptimized images.

## Routing and styling
- Keep routes centralized, protected pages behind the existing auth guard, and navigation state URL-addressable where users expect deep links.
- Use Tailwind and shared components consistently. Prefer semantic class composition over duplicated inline style systems.

## Testing
Frontend test placement, Vitest/RTL conventions, Zustand reset, coverage, and Playwright gates are canonical in `testing-strategy.md`. Add focused tests for behavior changes and verify loading/error/empty/accessibility/responsive states.
