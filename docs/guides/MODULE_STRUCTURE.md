# Armoured Souls - Module Structure

**Last Updated**: April 2, 2026

## Overview

This document breaks down the Armoured Souls system into logical modules, each with specific responsibilities. This modular approach enables independent development, testing, and scaling of components.

**Note**: For project phases and development timeline, see ROADMAP.md. This document focuses on module organization and current implementation status.

## Module Hierarchy

The project has two structural layers: the aspirational `modules/` directory (placeholder READMEs for future extraction) and the working `prototype/` directory where all implementation lives.

```
ArmouredSouls/
├── modules/                    # Future modular extraction targets (READMEs only)
│   ├── api/
│   ├── auth/
│   ├── database/
│   ├── game-engine/
│   └── ui/
├── prototype/
│   ├── backend/               # Express 5 + TypeScript backend
│   │   ├── src/
│   │   │   ├── config/        # Logger, app config
│   │   │   ├── errors/        # AppError hierarchy (domain-specific error classes)
│   │   │   ├── lib/           # Prisma client singleton
│   │   │   ├── middleware/     # Auth, error handling, validation
│   │   │   ├── routes/        # Express route handlers
│   │   │   ├── services/      # Domain-organized service layer (see below)
│   │   │   └── utils/         # Shared utilities (battleMath, etc.)
│   │   ├── generated/prisma/  # Prisma 7 generated client
│   │   ├── prisma/            # Schema and migrations
│   │   └── tests/             # Jest test files
│   └── frontend/              # React 19 + Vite + Tailwind CSS
│       └── src/
│           ├── components/    # React components
│           ├── contexts/      # React Context providers
│           ├── hooks/         # Custom hooks
│           ├── pages/         # Page components
│           ├── services/      # API client layer
│           └── types/         # TypeScript type definitions
```

### Backend Services (Domain-Organized)

All 41+ backend services are organized into 13 domain subdirectories under `prototype/backend/src/services/`. Each domain has an `index.ts` barrel file that defines its public API.

```
prototype/backend/src/services/
├── auth/           # JWT, password hashing, user management
├── battle/         # Combat simulation, strategy, post-combat, base orchestrator
├── league/         # League instances, rebalancing, league battle orchestration
├── tournament/     # Tournament service, tournament battle orchestration
├── tag-team/       # Tag-team service, matchmaking, league management, battle orchestration
├── koth/           # King of the Hill matchmaking and battle orchestration
├── economy/        # Facilities, ROI, spending, streaming revenue, repairs
├── cycle/          # Cycle scheduling, snapshots, performance monitoring, CSV export
├── common/         # Event logging, compression, data integrity, query service, reset, guide
├── analytics/      # Matchmaking, robot performance, robot stats, onboarding analytics
├── onboarding/     # Onboarding service
├── arena/          # Arena layout, movement, position tracking
└── notifications/  # Notification system
```

The battle orchestrators (league, tournament, tag-team, KotH) share a common `battle/baseOrchestrator.ts` that encapsulates the shared battle execution pipeline: pre-battle validation → combat simulation → post-combat processing → result recording. Mode-specific orchestrators live in their respective domain directories and compose the base orchestrator for shared logic.

---

## Module Specifications

### 1. Auth Domain (`services/auth/`)

**Purpose**: Handle user authentication, authorization, and session management.

**Services**:
- `jwtService.ts` — JWT token generation (`generateToken`) and validation (`verifyToken`)
- `passwordService.ts` — Bcrypt password hashing (`hashPassword`) and verification (`verifyPassword`)
- `userService.ts` — User CRUD operations (`createUser`, `findUserByUsername`, `findUserByEmail`, `findUserByIdentifier`, `findUserByStableName`)

**Key Entities**: User, Session, Role

**APIs**:
- `POST /auth/register` — Register new user
- `POST /auth/login` — User login
- `GET /auth/verify` — Verify token validity

**Dependencies**: Database (user data), Onboarding (tutorial init)

---

### 2. Battle Domain (`services/battle/`)

**Purpose**: Core combat simulation engine and shared orchestration pipeline used by all battle modes.

**Services**:
- `baseOrchestrator.ts` — Shared battle pipeline utilities: `getCurrentCycleNumber()`, common `BattleContext` and `BattleRecordRef` types. Mode-specific orchestrators compose these building blocks.
- `combatSimulator.ts` — Time-based combat simulation with 2D spatial arena. Exports `simulateBattle()` (1v1) and `simulateBattleMulti()` (N-robot). Handles hit chance, critical hits, energy shields, penetration, yield thresholds, cooldowns, and AI decision-making.
- `battleStrategy.ts` — Strategy/processor pattern (`BattleProcessor`) for plugging in new battle modes with custom participant loading, simulation, reward calculation, and DB recording.
- `battlePostCombat.ts` — Post-combat processing: `calculateELOChange`, `awardStreamingRevenueForParticipant`, `logBattleAuditEvent`, `updateRobotCombatStats`, `awardCreditsToUser`, `awardPrestigeToUser`, `awardFameToRobot`.
- `combatMessageGenerator.ts` — Generates structured battle logs from combat events: `convertBattleEvents()`, `buildKothBattleLog()`, `generateTagOut()`, `generateTagIn()`.

**Key Entities**: Battle, BattleParticipant, BattleAction, BattleLog, BattleOutcome, CombatEvent, CombatResult

**Dependencies**: Arena (spatial mechanics), Economy (streaming revenue), Database (battle records)

---

### 3. League Domain (`services/league/`)

**Purpose**: Competitive league system with tiered instances, promotion/relegation, and league battle orchestration.

**Services**:
- `leagueInstanceService.ts` — League tier management: `getInstancesForTier()`, `assignLeagueInstance()`, `rebalanceInstances()`, `getRobotsInInstance()`, `moveRobotToInstance()`. Constants: `LEAGUE_TIERS`, `MAX_ROBOTS_PER_INSTANCE`.
- `leagueRebalancingService.ts` — Promotion/demotion logic: `determinePromotions()`, `determineDemotions()`, `promoteRobot()`, `demoteRobot()`, `rebalanceLeagues()`.
- `leagueBattleOrchestrator.ts` — League-specific battle execution: `processBattle()`, `executeScheduledBattles()`. Handles LP updates, ELO changes, prestige/fame awards, bye matches.

**Key Entities**: LeagueInstance, LeagueTier (bronze/silver/gold/platinum/diamond), ScheduledLeagueMatch

**APIs**:
- `GET /leagues/:tier` — Get league standings
- `POST /admin/cycle/battles` — Execute scheduled league battles

**Dependencies**: Battle (combat simulation), Economy (rewards), Database

---

### 4. Tournament Domain (`services/tournament/`)

**Purpose**: Single-elimination tournament system with seeding, bracket advancement, and auto-creation.

**Services**:
- `tournamentService.ts` — Tournament lifecycle: `createSingleEliminationTournament()`, `getActiveTournaments()`, `getCurrentRoundMatches()`, `advanceWinnersToNextRound()`, `autoCreateNextTournament()`, `computeSeedings()`, `getEligibleRobotsForTournament()`.
- `tournamentBattleOrchestrator.ts` — Tournament-specific battle execution: `processTournamentBattle()`. Handles bracket advancement, round completion, HP tiebreakers for draws.

**Key Entities**: Tournament, TournamentMatch, TournamentRound, SeedEntry

**APIs**:
- `GET /tournaments` — Get active tournaments
- `POST /admin/tournaments/:id/round` — Execute tournament round

**Dependencies**: Battle (combat simulation), League (ELO data), Database

---

### 5. Tag-Team Domain (`services/tag-team/`)

**Purpose**: Two-robot team battles with tag-out mechanics, team-specific leagues, and matchmaking.

**Services**:
- `tagTeamService.ts` — Team management: creation, validation, roster management.
- `tagTeamMatchmakingService.ts` — Tag-team specific matchmaking: `runTagTeamMatchmaking()`, `shouldRunTagTeamMatchmaking()`.
- `tagTeamLeagueInstanceService.ts` — Tag-team league tier management (mirrors league domain pattern).
- `tagTeamLeagueRebalancingService.ts` — Tag-team promotion/demotion: `rebalanceTagTeamLeagues()`.
- `tagTeamBattleOrchestrator.ts` — Multi-phase battle execution: `executeTagTeamBattle()`, `executeScheduledTagTeamBattles()`. Handles tag-out/tag-in mechanics, reserve robot activation, multi-phase combat, team scoring.

**Key Entities**: TagTeam, TagTeamWithRobots, ScheduledTagTeamMatch, TagOutEvent, TagInEvent

**APIs**:
- `GET /tag-teams` — Get user's tag teams
- `POST /admin/cycle/tag-team-battles` — Execute scheduled tag-team battles

**Dependencies**: Battle (combat simulation), League (shared patterns), Database

---

### 6. KotH Domain (`services/koth/`)

**Purpose**: King of the Hill multi-robot battle mode with zone scoring and placement calculation.

**Services**:
- `kothMatchmakingService.ts` — KotH-specific matchmaking: `runKothMatchmaking()`.
- `kothBattleOrchestrator.ts` — N-robot battle execution: `executeScheduledKothBattles()`, `processKothBattle()`, `calculateKothRewards()`. Uses `simulateBattleMulti()` for multi-participant combat. Handles zone scoring, placement calculation, batched DB updates with throttling.

**Key Entities**: KothMatch, PreparedParticipant, KothBattleExecutionSummary

**APIs**:
- `POST /admin/cycle/koth-battles` — Execute scheduled KotH battles

**Dependencies**: Battle (multi-robot simulation), Economy (streaming revenue), Database

---

### 7. Economy Domain (`services/economy/`)

**Purpose**: Financial systems including facilities, ROI calculations, spending tracking, streaming revenue, and repairs.

**Services**:
- `facilityRecommendationService.ts` — AI-driven facility upgrade recommendations based on player state and ROI analysis.
- `roiCalculatorService.ts` — Return-on-investment calculations for facility upgrades, considering payback periods and income projections.
- `spendingTracker.ts` — Tracks player spending across categories: `trackSpending()`.
- `streamingRevenueService.ts` — Calculates streaming studio revenue: `calculateStreamingRevenue()` based on facility level, robot fame, and battle participation.
- `repairService.ts` — Robot repair cost calculations and batch repair: `repairAllRobots()`. Repair costs scale with damage taken and facility discounts.

**Key Entities**: Facility (14 types, 10 levels each), Revenue Streams (merchandising, streaming, sponsorships)

**APIs**:
- `POST /facility/upgrade` — Upgrade a facility
- `GET /finances/report` — Get financial report

**Dependencies**: Database, Config (facility definitions)

---

### 8. Cycle Domain (`services/cycle/`)

**Purpose**: Automated daily game cycle management — scheduling, execution monitoring, snapshots, and data export.

**Services**:
- `cycleScheduler.ts` — Cron-based cycle scheduling: `initScheduler()`, `getSchedulerState()`, `resetScheduler()`. Orchestrates the daily cycle pipeline (matchmaking → battles → settlements → rebalancing).
- `cycleSnapshotService.ts` — Captures cycle state snapshots for analytics: `CycleSnapshotService` class with robot metrics, stable metrics, step durations.
- `cyclePerformanceMonitoringService.ts` — Monitors cycle execution performance: `CyclePerformanceMonitoringService` with degradation alerts and performance metrics.
- `cycleCsvExportService.ts` — Exports cycle battle data to CSV: `exportCycleBattlesToCSV()`, `exportCycleBattlesToFile()`.

**Key Entities**: CycleMetadata, CycleSnapshot, PerformanceDegradationAlert

**Dependencies**: League, Tournament, Tag-Team, KotH (all battle modes), Analytics, Database

---

### 9. Common Domain (`services/common/`)

**Purpose**: Cross-cutting utilities used by multiple domains. No domain-specific business logic.

**Services**:
- `eventLogger.ts` — Structured event logging: `EventLogger` class with `EventType` enum, sequence tracking, `clearSequenceCache()`.
- `eventCompression.ts` — Battle event compression for storage: `compressEventsForStorage()`, `stripDebugFields()`, `estimateEventSize()`.
- `dataIntegrityService.ts` — Data consistency checks: `DataIntegrityService` with `IntegrityReport` and `IntegrityIssue` types.
- `queryService.ts` — Generic query builder: `QueryService` with event filtering, audit log queries.
- `resetService.ts` — Account reset functionality: `validateResetEligibility()`, `performAccountReset()`, `getResetHistory()`.
- `markdown-parser.ts` — Markdown processing: `parseMarkdown()`, `extractHeadings()`, `stripMarkdown()`, `validateFrontmatter()`.
- `guide-service.ts` — In-game guide system: `GuideService` class serving articles, sections, search index.

**Dependencies**: Database (for query/reset/integrity services)

---

### 10. Analytics Domain (`services/analytics/`)

**Purpose**: Matchmaking analytics, robot performance tracking, and stats aggregation.

**Services**:
- `matchmakingService.ts` — Skill-based matchmaking: `runMatchmaking()`. Pairs robots by ELO within league tiers.
- `robotPerformanceService.ts` — Robot performance metrics: `robotPerformanceService` with per-robot win rates, ELO history, battle statistics.
- `robotStatsViewService.ts` — Aggregated robot stats views for leaderboards and comparisons.
- `onboardingAnalyticsService.ts` — Tracks onboarding funnel events: `recordEvents()` with `OnboardingAnalyticsEvent` type.

**APIs**:
- `GET /analytics/robots/:id/performance` — Robot performance data
- `GET /leaderboards` — Global leaderboards
- `POST /onboarding-analytics/events` — Record onboarding events

**Dependencies**: Database, League (tier data)

---

### 11. Onboarding Domain (`services/onboarding/`)

**Purpose**: New player onboarding flow — tutorial state management and guided first steps.

**Services**:
- `onboardingService.ts` — Tutorial lifecycle: `initializeTutorialState()`, step completion tracking, onboarding status queries.

**Key Entities**: OnboardingState, TutorialStep

**APIs**:
- `GET /onboarding/status` — Get onboarding progress
- `POST /onboarding/complete-step` — Mark step complete

**Dependencies**: Auth (user creation triggers), Database

---

### 12. Arena Domain (`services/arena/`) — Pre-existing

**Purpose**: 2D spatial arena mechanics for combat simulation.

**Responsibilities**:
- Arena layout generation (`arenaLayout.ts`)
- Movement AI with patience-based engagement (`movementAI.ts`)
- Position tracking and facing/backstab detection (`positionTracker.ts`)
- Range band classification and penalties (`rangeBands.ts`)
- Threat scoring and target selection (`threatScoring.ts`)
- Counter-attack resolution (`counterAttack.ts`)
- Team coordination (sync volleys, shield support, formation defense) (`teamCoordination.ts`)
- Servo strain and movement speed (`servoStrain.ts`)
- Adaptation tracking (`adaptationTracker.ts`)
- Pressure system (`pressureSystem.ts`)
- 2D vector math (`vector2d.ts`)

**Dependencies**: None (pure computation, consumed by Battle domain)

---

### 13. Notifications Domain (`services/notifications/`) — Pre-existing

**Purpose**: In-app notification system for battle results, cycle events, and system messages.

**Dependencies**: Database, Auth (user targeting)

---

## Module Dependencies Graph

```
                    ┌──────────┐
                    │   Auth   │
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │ Player  │    │  Robot  │    │ Stable  │
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         └───────┬───────┴───────┬───────┘
                 │               │
            ┌────▼────┐    ┌────▼────────┐
            │  Battle │◄───┤ Matchmaking │
            └────┬────┘    └─────────────┘
                 │
            ┌────▼────────┐
            │ Game Engine │
            └────┬────────┘
                 │
         ┌───────┴────────┬─────────────┐
         │                │             │
    ┌────▼────┐      ┌───▼────┐   ┌───▼──────────┐
    │   API   │      │   UI   │   │Notifications │
    └────┬────┘      └────────┘   └──────────────┘
         │
    ┌────▼────────┐
    │  Database   │
    └─────────────┘
```

## Module Development Strategy

**Note**: For the complete implementation timeline and phase breakdown (Phase 0-9), refer to **ROADMAP.md** which contains the authoritative development plan. This section provides a logical overview of module dependencies.

### Development Layers

The modules are organized in layers, where each layer depends on the layers below it:

**Layer 1: Foundation** (No dependencies)
- Database (Prisma + PostgreSQL)

**Layer 2: Core Infrastructure** (Depends on Layer 1)
- Auth (JWT + username/password)
- API (Express-based REST)

**Layer 3: Game Entities** (Depends on Layers 1-2)
- Player (user profiles, stats)
- Robot (23 attributes, state tracking)
- Stable (14 facilities, prestige system)

**Layer 4: Game Logic** (Depends on Layers 1-3)
- Game Engine (rules, validation)
- Battle (time-based combat simulation)

**Layer 5: User Experience** (Depends on Layers 1-4)
- UI (React + Tailwind CSS for web)
- Notifications (WebSockets/Web Push)

**Layer 6: Advanced Features** (Post-MVP)
- Matchmaking
- Admin tools
- UI (Mobile - React Native)

**Implementation Priority**: See ROADMAP.md Phase 1 for actual development priorities and detailed breakdown (Phase 1a: Core, 1b: Weapons, 1c: Stable)

## Inter-Module Communication

### Synchronous Communication
- REST API calls for immediate responses
- Direct function calls within same process

### Asynchronous Communication
- Message queue for non-blocking operations (future)
- Event bus for loosely coupled events (future)
- WebSockets for real-time notifications and cross-platform data synchronization

## Module Testing Strategy

Each module should have:
- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test module interactions
- **Contract Tests**: Verify API contracts
- **Load Tests**: Validate performance under load

## Module Documentation Standard

Each module directory should contain:
- `README.md` - Module overview and quick start
- `API.md` - Detailed API documentation
- `SCHEMA.md` - Database schema (if applicable)
- `TESTS.md` - Testing guide and coverage
- `DEPLOYMENT.md` - Deployment instructions
