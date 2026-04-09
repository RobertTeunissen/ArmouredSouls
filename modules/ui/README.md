# UI Module

> **Phase 2 — Migration Planned**

React frontend application — pages, components, stores, API client, and static assets. No code dependencies on other modules; communicates with the API via HTTP.

See [MODULE_CONTRACT.md](./MODULE_CONTRACT.md) for the full specification.
See [Migration Strategy](../../docs/guides/MODULAR_MIGRATION_STRATEGY.md) for the extraction plan (Phase 2e).

## Current Source

All implementation currently lives in `prototype/frontend/`:
- 19 page components in `src/pages/`
- 8 feature component directories in `src/components/`
- 2 Zustand stores in `src/stores/`
- 11 API client files in `src/utils/`
- 125 test files
