# Design Document: Backend Service Consolidation

## Overview

Reorganize the 41 backend services from a flat `services/` directory into domain-based subdirectories, then consolidate the 4 battle orchestrators into a shared base + mode-specific extensions. This is a pure refactoring — no behavior changes, only file moves, import updates, and extraction of shared logic.

### Key Research Findings

- 41 service files in a flat directory, plus 2 existing subdirectories (`arena/`, `notifications/`).
- 4 battle orchestrators (`leagueBattleOrchestrator`, `tournamentBattleOrchestrator`, `tagTeamBattleOrchestrator`, `kothBattleOrchestrator`) share a common pipeline: validate participants → run combat simulation → process post-combat → record results.
- 5 tag-team services mirror the league services almost 1:1 (`tagTeamLeagueInstanceService` ↔ `leagueInstanceService`, etc.).
- `combatSimulator`, `battleStrategy`, `battlePostCombat`, `combatMessageGenerator` form a cohesive battle execution core.
- Cycle services (`cycleScheduler`, `cycleSnapshotService`, `cyclePerformanceMonitoringService`, `cycleCsvExportService`) are tightly coupled.
- Auth-adjacent services (`jwtService`, `passwordService`, `userService`) are a natural group.
- Utility services (`eventLogger`, `eventCompression`, `dataIntegrityService`, `queryService`, `markdown-parser`, `guide-service`) are cross-cutting.

## Visual Overview

### Domain Map and Dependency Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Express Routes                                │
│  auth  admin  leagues  tournaments  koth  tagTeams  facility  robots …  │
└──┬───────┬───────┬─────────┬────────┬───────┬─────────┬────────┬───────┘
   │       │       │         │        │       │         │        │
   ▼       ▼       ▼         ▼        ▼       ▼         ▼        ▼
┌──────┐ ┌─────────────────────────────────────────┐  ┌──────────────────┐
│ auth/│ │          Mode-Specific Orchestrators     │  │    economy/      │
│      │ │  ┌──────────┐ ┌────────────┐            │  │                  │
│ jwt  │ │  │ league/  │ │tournament/ │            │  │ facilityRec…     │
│ pass │ │  │ Battle   │ │ Battle     │            │  │ roiCalculator    │
│ user │ │  │ Orch.    │ │ Orch.      │            │  │ spendingTracker  │
│      │ │  └────┬─────┘ └─────┬──────┘            │  │ streamingRev…    │
└──────┘ │       │              │                   │  │ repairService    │
         │  ┌────┴──────┐ ┌────┴──────┐            │  └──────────────────┘
         │  │ tag-team/  │ │  koth/    │            │
         │  │ Battle     │ │  Battle   │            │  ┌──────────────────┐
         │  │ Orch.      │ │  Orch.    │            │  │   analytics/     │
         │  └────┬───────┘ └────┬──────┘            │  │                  │
         │       │              │                   │  │ robotPerf…       │
         │       ▼              ▼                   │  │ robotStatsView   │
         │  ┌───────────────────────────────────┐   │  │ onboardingAna…   │
         │  │     battle/baseOrchestrator (NEW)  │   │  │ matchmaking      │
         │  │                                    │   │  └──────────────────┘
         │  │  validate → simulate → postCombat  │   │
         │  │              → record              │   │
         │  └──────────────┬─────────────────────┘   │
         │                 │                         │
         │                 ▼                         │
         │  ┌────────────────────────────────────┐   │
         │  │     battle/ (core services)        │   │
         │  │                                    │   │
         │  │  combatSimulator                   │   │
         │  │  battleStrategy                    │   │
         │  │  battlePostCombat                  │   │
         │  │  combatMessageGenerator            │   │
         │  └────────────────────────────────────┘   │
         └───────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    cycle/        │  │   onboarding/    │  │    common/       │
│                  │  │                  │  │                  │
│ cycleScheduler   │  │ onboarding       │  │ eventLogger      │
│ cycleSnapshot    │  │ Service          │  │ eventCompression │
│ cyclePerfMon…    │  │                  │  │ dataIntegrity    │
│ cycleCsvExport   │  └──────────────────┘  │ queryService     │
└──────────────────┘                        │ resetService     │
                                            │ markdown-parser  │
┌──────────────────┐  ┌──────────────────┐  │ guide-service    │
│ arena/ (exists)  │  │notifications/    │  └──────────────────┘
│   (unchanged)    │  │   (unchanged)    │
└──────────────────┘  └──────────────────┘
```

### Key Relationships

```
                    ┌─────────────────────────────────────────┐
                    │        Shared Dependencies              │
                    │                                         │
                    │  All 4 orchestrators currently import:  │
                    │  • combatSimulator (simulateBattle)     │
                    │  • combatMessageGenerator               │
                    │  • battlePostCombat (ELO, rewards,      │
                    │    prestige, streaming revenue)          │
                    │                                         │
                    │  This duplicated pipeline becomes       │
                    │  baseOrchestrator.executeBattlePipeline │
                    └─────────────────────────────────────────┘

  Before (flat):                    After (domain-organized):

  services/                         services/
  ├── leagueBattle…    ─┐           ├── battle/
  ├── tournamentBattle… │ shared    │   ├── baseOrchestrator.ts (NEW)
  ├── tagTeamBattle…    │ pipeline  │   ├── combatSimulator.ts
  ├── kothBattle…      ─┘           │   ├── battlePostCombat.ts
  ├── combatSimulator.ts            │   ├── battleStrategy.ts
  ├── battlePostCombat.ts           │   └── combatMessageGenerator.ts
  ├── battleStrategy.ts             ├── league/
  ├── combatMessage…                │   ├── leagueService.ts (merged)
  ├── leagueInstance…               │   └── leagueBattleOrchestrator.ts
  ├── leagueRebalancing…            ├── tournament/
  ├── tagTeamService.ts             │   └── tournamentBattleOrchestrator.ts
  ├── tagTeamMatchmaking…           ├── tag-team/
  ├── tagTeamLeagueInstance…        │   └── tagTeamBattleOrchestrator.ts
  ├── tagTeamLeagueRebalancing…     ├── koth/
  ├── kothMatchmaking…              │   └── kothBattleOrchestrator.ts
  └── ... (41 files total)          └── ... (11 domains)
```

## Architecture

### Target Directory Structure

```
src/services/
├── auth/
│   ├── index.ts
│   ├── jwtService.ts
│   ├── passwordService.ts
│   └── userService.ts
├── battle/
│   ├── index.ts
│   ├── baseOrchestrator.ts        # NEW: shared orchestration pipeline
│   ├── combatSimulator.ts
│   ├── battleStrategy.ts
│   ├── battlePostCombat.ts
│   └── combatMessageGenerator.ts
├── league/
│   ├── index.ts
│   ├── leagueService.ts           # Merged from leagueInstanceService + leagueRebalancingService
│   └── leagueBattleOrchestrator.ts # Uses baseOrchestrator
├── tournament/
│   ├── index.ts
│   ├── tournamentService.ts
│   └── tournamentBattleOrchestrator.ts  # Uses baseOrchestrator
├── tag-team/
│   ├── index.ts
│   ├── tagTeamService.ts
│   ├── tagTeamMatchmakingService.ts
│   ├── tagTeamLeagueService.ts    # Merged from tagTeamLeagueInstanceService + tagTeamLeagueRebalancingService
│   └── tagTeamBattleOrchestrator.ts  # Uses baseOrchestrator
├── koth/
│   ├── index.ts
│   ├── kothMatchmakingService.ts
│   └── kothBattleOrchestrator.ts  # Uses baseOrchestrator
├── economy/
│   ├── index.ts
│   ├── facilityRecommendationService.ts
│   ├── roiCalculatorService.ts
│   ├── spendingTracker.ts
│   ├── streamingRevenueService.ts
│   └── repairService.ts
├── cycle/
│   ├── index.ts
│   ├── cycleScheduler.ts
│   ├── cycleSnapshotService.ts
│   ├── cyclePerformanceMonitoringService.ts
│   └── cycleCsvExportService.ts
├── common/
│   ├── index.ts
│   ├── eventLogger.ts
│   ├── eventCompression.ts
│   ├── dataIntegrityService.ts
│   ├── queryService.ts
│   ├── resetService.ts
│   ├── markdown-parser.ts
│   └── guide-service.ts
├── analytics/
│   ├── index.ts
│   ├── robotPerformanceService.ts
│   ├── robotStatsViewService.ts
│   ├── onboardingAnalyticsService.ts
│   └── matchmakingService.ts
├── onboarding/
│   ├── index.ts
│   └── onboardingService.ts
├── arena/                          # Existing subdirectory (unchanged)
└── notifications/                  # Existing subdirectory (unchanged)
```

### Base Orchestrator Pattern

```typescript
// battle/baseOrchestrator.ts
export interface BattleContext {
  participants: BattleParticipant[];
  battleType: string;
  metadata: Record<string, unknown>;
}

export interface BattleResult {
  battleId: number;
  winnerId: number | null;
  // ... common result fields
}

export async function executeBattlePipeline(context: BattleContext): Promise<BattleResult> {
  // 1. Validate participants (HP > 0, not destroyed, etc.)
  // 2. Run combat simulation
  // 3. Process post-combat (ELO, rewards, repairs)
  // 4. Record battle result
  // Returns the common result; mode-specific orchestrators handle the rest
}
```

Mode-specific orchestrators call `executeBattlePipeline()` and then handle their own concerns:
- League: LP updates, promotion/relegation checks
- Tournament: bracket advancement, round completion
- Tag-team: tag-out mechanics, team scoring
- KotH: zone scoring, placement calculation

## Components and Interfaces

### Barrel Files

Each domain's `index.ts` re-exports only the public API:

```typescript
// league/index.ts
export { getLeagueStandings, promoteRobots, relegateRobots } from './leagueService';
export { executeLeagueBattle } from './leagueBattleOrchestrator';
```

Routes and other domains import from the barrel:
```typescript
import { getLeagueStandings } from '../services/league';
```

## Data Models

No data model changes. This is a pure code reorganization.

## Correctness Properties

### Property 1: Import resolution

For any route or test file that imports a service function, the import must resolve to the same function implementation as before the reorganization (verified by TypeScript compilation and test suite).

### Property 2: API response equivalence

For any API endpoint, the response for a given request must be byte-identical before and after the reorganization.

## Documentation Impact

The following existing documentation and steering files will need updating:

- `docs/guides/MODULE_STRUCTURE.md` — Must be updated to reflect the new domain-based service directory structure.
- `.kiro/steering/project-overview.md` — Project Structure section should mention the domain-organized services under `/prototype/backend`.

## Testing Strategy

### Verification Approach
- Run full backend test suite after each domain move
- Import path updates are the only changes to test files (no logic changes)
- Build must succeed after each move

### Migration Order
1. Create subdirectories and barrel files
2. Move `auth/` services (smallest, lowest risk)
3. Move `common/` utilities
4. Move `battle/` core services
5. Create `baseOrchestrator` and refactor orchestrators
6. Move remaining domains one at a time
7. Final full test suite run
