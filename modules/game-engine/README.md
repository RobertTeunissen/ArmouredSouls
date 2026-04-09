# Game Engine Module

> **Phase 2 — Migration Planned**

Core game logic — battle simulation, matchmaking, leagues, tournaments, tag-teams, KotH, economy, cycle management, robot management, analytics, onboarding, and the 2D combat arena subsystem. The largest module (~70 service files).

See [MODULE_CONTRACT.md](./MODULE_CONTRACT.md) for the full public API specification.
See [Migration Strategy](../../docs/guides/MODULAR_MIGRATION_STRATEGY.md) for the extraction plan (Phase 2c).

## Current Source

All implementation currently lives in `prototype/backend/src/services/`:
- 14 domain directories: analytics, arena, battle, cycle, economy, koth, league, match, onboarding, practice-arena, robot, tag-team, tournament, common (resetService)
- Shared game formulas: `prototype/shared/utils/`
- Domain errors: `src/errors/`
