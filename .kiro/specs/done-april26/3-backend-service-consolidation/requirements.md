# Requirements Document

## Introduction

Reorganize and consolidate the 41 backend services in `app/backend/src/services/` from a flat directory of loosely related files into a domain-organized structure with clear boundaries. The primary targets are the 4 duplicate battle orchestrators, the 3 overlapping league services, and the 5 tag-team services that mirror league services. This reduces cognitive load, makes the codebase navigable, and establishes a pattern for future service development.

## Glossary

- **Service_Directory**: The `app/backend/src/services/` directory containing all backend service files.
- **Domain_Subdirectory**: A subdirectory within Service_Directory that groups related services by domain (e.g., `services/battle/`, `services/league/`).
- **Battle_Orchestrator**: A service that coordinates the execution of a battle for a specific mode (league, tournament, tag-team, KotH). Currently 4 separate files with overlapping logic.
- **Base_Orchestrator**: A shared abstraction that encapsulates common battle orchestration logic (matchmaking validation, battle execution, post-combat processing, result recording) used by all battle modes.

## Expected Contribution

This spec targets the "service sprawl" debt identified in the project assessment. The expected measurable outcomes after all tasks are complete:

1. **Navigability**: Services organized into 11 domain subdirectories instead of 41 files in a flat directory. A developer looking for league logic goes to `services/league/`, not scanning 41 filenames.
2. **Duplication reduction**: The 4 battle orchestrators share a common `baseOrchestrator.ts` for the battle execution pipeline. Before: the same validation → simulation → post-combat → recording logic is duplicated 4 times.
3. **Clear public APIs**: Each domain has a barrel `index.ts` that defines what other domains can import. Before: any file can import any other file with no boundary.
4. **Cognitive load**: Finding a service goes from O(41) scan to O(11) directory + O(5) file within the domain.
5. **Zero behavior changes**: All API responses are identical before and after. This is a pure refactoring.

### Verification Criteria

After all tasks are marked complete, run these checks to confirm the debt reduction was achieved:

1. `ls app/backend/src/services/*.ts 2>/dev/null` returns zero files (no service files in root, only subdirectories)
2. Every subdirectory has an `index.ts` barrel file
3. All backend tests pass with zero assertion changes (only import path changes)
4. The application starts and serves requests
5. `docs/guides/MODULE_STRUCTURE.md` is updated to reflect the new service organization

## Requirements

### Requirement 1: Domain-Based Directory Structure

**User Story:** As a backend developer, I want services organized into domain subdirectories, so that I can find related services quickly without scanning a flat list of 41 files.

#### Acceptance Criteria

1. WHEN the reorganization is complete, THE Service_Directory SHALL contain the following subdirectories: `battle/`, `league/`, `economy/`, `cycle/`, `auth/`, `tournament/`, `tag-team/`, `koth/`, and `common/`.
2. WHEN services are moved into subdirectories, EACH subdirectory SHALL contain an `index.ts` barrel file that re-exports the public API of that domain.
3. WHEN services are moved, ALL import paths across the backend (routes, other services, tests) SHALL be updated to reflect the new locations.
4. WHEN the reorganization is complete, THE root of Service_Directory SHALL contain no service files — only subdirectories (plus the existing `arena/` and `notifications/` directories).

### Requirement 2: Battle Orchestrator Consolidation

**User Story:** As a backend developer, I want a shared base battle orchestrator that the league, tournament, tag-team, and KotH orchestrators compose or extend, so that common battle execution logic is not duplicated across 4 files.

#### Acceptance Criteria

1. WHEN a `battle/baseOrchestrator.ts` is created, IT SHALL encapsulate the shared battle execution pipeline: pre-battle validation, combat simulation invocation, post-combat processing, and result recording.
2. WHEN the base orchestrator is created, THE existing `leagueBattleOrchestrator`, `tournamentBattleOrchestrator`, `tagTeamBattleOrchestrator`, and `kothBattleOrchestrator` SHALL be refactored to use the base orchestrator for shared logic, keeping only mode-specific behavior (matchmaking rules, scoring, bracket advancement) in the mode-specific files.
3. WHEN the consolidation is complete, ANY bug fix to the shared battle execution pipeline SHALL only need to be made in one place (`baseOrchestrator.ts`).

### Requirement 3: League Service Consolidation

**User Story:** As a backend developer, I want the 3 league services (`leagueInstanceService`, `leagueRebalancingService`, `leagueBattleOrchestrator`) consolidated into a cohesive `league/` domain, so that league-related logic is co-located and the public API is clear.

#### Acceptance Criteria

1. WHEN league services are consolidated, `leagueInstanceService.ts` and `leagueRebalancingService.ts` SHALL be merged into a single `league/leagueService.ts` if their responsibilities overlap, or co-located in `league/` with clear separation if they remain distinct.
2. WHEN league services are consolidated, THE `league/index.ts` barrel file SHALL export only the public functions that routes and other domains need.
3. WHEN the consolidation is complete, THE tag-team league services (`tagTeamLeagueInstanceService`, `tagTeamLeagueRebalancingService`) SHALL follow the same pattern in `tag-team/`.

### Requirement 4: Backward Compatibility

**User Story:** As a backend developer, I want the service reorganization to be a pure refactoring with no behavior changes, so that all existing tests pass without modification to test logic (only import paths).

#### Acceptance Criteria

1. WHEN the reorganization is complete, THE full backend test suite (unit + integration) SHALL pass with no changes to test assertions or logic — only import path updates.
2. WHEN the reorganization is complete, ALL API endpoints SHALL return identical responses for identical requests compared to the pre-reorganization state.
3. WHEN the reorganization is complete, THE application SHALL start and serve requests without errors.
