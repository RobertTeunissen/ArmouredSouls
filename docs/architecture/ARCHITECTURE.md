# Armoured Souls — Architecture Overview

**Project**: Armoured Souls
**Document Type**: Technical architecture reference
**Version**: v2.3
**Last Updated**: September 21, 2026
**Status**: ✅ Current
**Owner**: Robert Teunissen

**Revision History**:

- v1.0 (Jan 24, 2026): Initial architecture design
- v2.0 (Apr 2, 2026): Updated for service consolidation, Prisma 7, React 19, and deployment architecture
- v2.1 (Apr 10, 2026): Added architecture decisions, security controls, and service/route inventory
- v2.2 (Jun 2026): Added moderation, image-upload dependencies, team-battle domains, and deployment details
- v2.3 (Sep 21, 2026): Updated package versions, service inventory, unified scheduling/schema terminology, current player routes, Finance Center, and operational alerting

---

**Related Documents**:
- [PRD_SERVICE_DIRECTORY.md](PRD_SERVICE_DIRECTORY.md) — Detailed service domain breakdown and cron schedule
- [PRD_SECURITY.md](PRD_SECURITY.md) — Security controls and exploit playbook
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — Database schema reference
- [PRD_CYCLE_SYSTEM.md](../game-systems/PRD_CYCLE_SYSTEM.md) — Cycle execution and scheduler
- [finance-center-reporting-contract.md](../implementation_notes/finance-center-reporting-contract.md) — Finance Center reporting boundaries

## System Architecture

### High-Level Design

Armoured Souls is a monolithic Node.js application with a React SPA frontend, deployed on a single VPS behind Caddy as a reverse proxy. The architecture prioritizes simplicity and rapid iteration over distributed complexity.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React 19 SPA (Vite 8)                   │   │
│  │   Zustand stores · React Context · React Router 7    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │ HTTPS
                   ┌────────▼─────────┐
                   │      Caddy       │
                   │  (Reverse Proxy  │
                   │   + Auto HTTPS)  │
                   └────────┬─────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Express 5 (Node.js 24 LTS)                   │   │
│  │                                                       │   │
│  │  36 domain service directories                       │   │
│  │  organized under app/backend/src/services             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     PostgreSQL 17 (via Prisma 7 + pg adapter)        │   │
│  │     Docker Compose (dev) · Native install (prod)     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Architectural Principles

### 1. Monolith-First
- Single Express application with domain-organized services
- No microservices overhead — all services share one process and one database
- Clear module boundaries across 36 service directories allow future extraction if needed

### 2. Server-Authoritative Game Logic
- All battle simulation, economy calculations, and league processing run server-side
- Clients are display-only for game outcomes — no client-side game state computation
- Deterministic battle engine ensures reproducible results

### 3. Scheduled Batch Processing
- Competitive events and settlement run on cron schedules via `node-cron`
- No real-time in-game WebSocket layer — players configure, then check results after processing
- Configurable schedules cover league, tournament, tag-team, team-battle, KotH, Grand Melee, and settlement events

### 4. Security by Design
- All communication over HTTPS through Caddy
- JWT-based authentication with bcrypt password hashing
- Rate limiting on auth endpoints, general API traffic, and user-owned economic operations
- Input validation at the route layer
- Domain-specific error classes prevent leaking internal details

### 5. Comprehensive Testing
- Backend: Jest 30 with unit, integration, and heavy test configurations
- Frontend: Vitest 4 with Testing Library
- E2E: Playwright
- Property-based testing: fast-check on backend and frontend
- CI blocks on backend unit, integration, heavy, frontend, and E2E gates

## Technology Stack

### Backend
- **Runtime**: Node.js 24 LTS
- **Language**: TypeScript 6.0.3 (strict mode)
- **Framework**: Express 5
- **ORM**: Prisma 7 with `@prisma/adapter-pg` driver adapter
- **Database**: PostgreSQL 17
- **Authentication**: JWT (`jsonwebtoken`) + bcrypt 6
- **Scheduling**: node-cron 4
- **Logging**: Winston 3
- **Rate Limiting**: express-rate-limit 8
- **Process Manager**: PM2 (production)
- **Testing**: Jest 30, Supertest 7, fast-check 4
- **Content Moderation**: nsfwjs and `@tensorflow/tfjs-node`
- **Image Processing**: sharp
- **File Upload**: multer

### Frontend
- **Framework**: React 19 with TypeScript 6.0.3
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS 4
- **Routing**: React Router 7
- **State Management**: Zustand 5 plus React Context for authentication/onboarding
- **Charts**: Recharts 3
- **Markdown**: react-markdown 10 with remark-gfm
- **Testing**: Vitest 4, Testing Library, Playwright 1.58, fast-check 4

### Infrastructure
- **Hosting**: Scaleway DEV1-S VPS
- **Reverse Proxy**: Caddy with automatic HTTPS, compression, and security headers
- **Database (dev)**: Docker Compose with PostgreSQL 17-alpine
- **Database (prod)**: Native PostgreSQL installation
- **Process Manager**: PM2
- **CI/CD**: GitHub Actions
- **Firewall**: UFW
- **Backups**: Automated daily PostgreSQL dumps

## Backend Service Architecture

The backend currently contains 36 service directories under `app/backend/src/services/`. See [PRD_SERVICE_DIRECTORY.md](PRD_SERVICE_DIRECTORY.md) for detailed responsibilities and the production cron schedule.

| Service | Responsibility |
|---|---|
| `achievement` | Achievement definitions, progress, unlocks, and rewards |
| `admin` | Admin operations, dashboards, cycle execution, and maintenance |
| `analytics` | Cross-domain analytics and historical reporting |
| `arena` | Spatial combat, movement, range bands, and threat scoring |
| `auth` | Registration, login, password, and JWT management |
| `battle` | Combat engine, shared orchestration, post-combat updates, and byes |
| `changelog` | In-game changelog entries and image handling |
| `common` | Shared event logging, guides, queries, integrity, and resets |
| `cycle` | Cron scheduler, settlement, snapshots, and CSV exports |
| `dashboard` | Player dashboard cycle and readiness data |
| `economy` | Repairs, streaming revenue, ROI, and recommendations |
| `financial` | Financial reporting, ledger reads, and reconciliation |
| `grand-melee` | Grand Melee orchestration and rewards |
| `koth` | King of the Hill orchestration and matchmaking |
| `leaderboard` | Materialized leaderboard reads and refreshes |
| `league` | League orchestration, instances, and rebalancing |
| `match` | Battle history and scheduled-match reads |
| `matchmaking` | Shared matchmaking utilities |
| `migration` | Data migration and compatibility operations |
| `moderation` | Image validation, moderation, processing, and storage |
| `monitoring` | Health reporting and operational monitoring |
| `notifications` | Operational notification channels, including Discord webhooks |
| `onboarding` | New-player onboarding state and progression |
| `practice-arena` | Offline practice battles and daily metrics |
| `records` | Hall of Records queries and awards |
| `retention` | Battle-log retention and cleanup |
| `robot` | Robot lifecycle, ranking, repair, upgrades, and weapons |
| `scheduling` | Event scopes, cron timing, and thin-instance byes |
| `season` | Season lifecycle, rollover, archive, and purge |
| `security` | Rate-limit, authentication, and spending monitoring |
| `standings` | Authoritative competitive standings |
| `subscription` | Booking Office event subscriptions and eligibility |
| `tag-team` | Tag Team mode on the unified team-battle data model |
| `team-battle` | 2v2/3v3 simultaneous team battles and tournaments |
| `tournament` | Tournament brackets, rounds, and match execution |
| `tuning-pool` | Per-robot tactical tuning allocations |

### Middleware Stack
- `auth.ts` — JWT validation for protected routes
- `errorHandler.ts` — Centralized error handling with `AppError` hierarchy
- `rateLimiter.ts` — Auth-specific and general rate limiters
- `userRateLimiter.ts` — Per-user economic rate limiter
- `schemaValidator.ts` — Zod validation through `validateRequest`
- `ownership.ts` — Resource ownership verification
- `requestLogger.ts` — Winston-based request logging

### Error Handling
Domain-specific error classes extend a base `AppError`. Express 5 forwards rejected promises to the error middleware; route handlers do not need manual try/catch wrappers.

## API Route Modules

The complete route-module inventory is maintained in `app/backend/src/routes/`. Current modules include authentication, users, robots, weapons, weapon inventory, facilities, finances, dashboard cycle data, matches, leagues, leaderboards, records, stables, tournaments, team battles, KotH, seasons, subscriptions, tuning allocations, achievements, changelog, guide, onboarding, practice arena, analytics, images, and admin operations.

Representative public paths include:

```
/api/auth              — Registration and login
/api/user              — Profile management
/api/robots            — Robot CRUD and attributes
/api/weapons           — Weapon catalog
/api/weapon-inventory  — Player weapon ownership
/api/facilities        — Facility upgrades
/api/finances          — Compatibility finance endpoints
/api/matches           — Battle history
/api/leagues           — League standings
/api/leaderboards      — Rankings
/api/records           — Hall of Records
/api/stables           — Public stable viewing
/api/tournaments       — Tournament management
/api/team-battles      — Team Battle management
/api/koth              — King of the Hill
/api/seasons           — Season archive and state
/api/subscriptions     — Booking Office subscriptions
/api/achievements      — Achievement progression
/api/changelog         — In-game changelog
/api/guide             — In-game guide content
/api/dashboard         — Dashboard cycle/readiness data
/api/admin              — Admin controls and analytics
/api/health             — Health check
```

## Database Schema

The Prisma schema contains the current live and archive models. Key models include:

| Model | Purpose |
|---|---|
| `User` | Player accounts, currency, prestige, onboarding, and profile settings |
| `Robot` | Robot attributes, combat state, and player-owned robot data |
| `Facility` | The 13 configured facility types and levels 0–10 |
| `Weapon` / `WeaponInventory` | Weapon definitions and player ownership |
| `WeaponRefinement` | Per-instance weapon refinement upgrades |
| `Battle` / `BattleParticipant` / `BattleSummary` | Durable battle identity, per-robot results, and retained summaries |
| `Tournament` / `ScheduledTournamentMatch` | Tournament lifecycle and bracket matches |
| `TeamBattle` / `TeamBattleMember` | Unified 2v2/3v3 teams, including Tag Team mode |
| `ScheduledMatch` / `ScheduledMatchParticipant` | Unified scheduling across competitive modes |
| `Standing` | Authoritative competitive standings for robots and teams |
| `CycleMetadata` / `CycleSnapshot` | Global cycle state and historical aggregates |
| `AuditLog` / `AdminAuditLog` | Game-event and administrative audit trails |
| `FinancialLedger` | Append-only current-economy accounting records |
| `LeaderboardCache` | Materialized leaderboard results |
| `Season` and archive models | Current season state and cross-season history |
| `Subscription` | Booking Office event subscriptions |
| `ChangelogEntry`, `UserAchievement`, and `TuningAllocation` | Current progression and player-facing systems |

Prisma 7 uses the `client` engine type with `@prisma/adapter-pg`. The singleton in `src/lib/prisma.ts` handles adapter setup; standalone scripts and tests create their own adapter instances.

## Battle Simulation Architecture

### Scheduled Batch Processing

Battles run on configurable cron schedules via `node-cron`. The cycle scheduler supports independent schedules for league, tournament, Tag Team, team league, team tournament, KotH, Grand Melee, settlement, retention, health reporting, and backup operations.

### Battle Engine Properties

- **Server-Authoritative**: All logic runs server-side. Clients never compute outcomes.
- **Deterministic**: Same inputs produce the same outputs where deterministic seeds and inputs are supplied.
- **Batch-Oriented**: Processes scheduled matches during cycle jobs.
- **Multi-Mode**: Supports nine scheduled modes: 1v1 league, 1v1 tournament, Tag Team, 2v2/3v3 league, 2v2/3v3 tournament, KotH, and Grand Melee.
- **Unified Scheduling**: Current scheduling uses `ScheduledMatch` and `ScheduledMatchParticipant`; Tag Team is discriminated by its match mode on the unified team model.

### Cycle Scheduler Features
- Configurable cron expressions per battle event
- In-memory mutex and serialized cycle cutover behavior
- Performance monitoring and degradation detection
- CSV export for battle data
- Cycle snapshots for historical metrics
- Season preparation and rollover gates

## Frontend Architecture

The frontend route declarations live in `app/frontend/src/App.tsx`. Current player-facing destinations include:

- **Auth and onboarding**: FrontPage, login/registration, OnboardingPage
- **Core**: DashboardPage, ProfilePage, RobotsPage, RobotDetailPage, CreateRobotPage, RobotSetupWizardPage
- **Battles**: BattleHistoryPage, BattleDetailPage, PracticeArenaPage
- **Competition**: LeagueStandingsPage, Leaderboards pages, TournamentsPage, TeamBattlesPage, SeasonArchivePage, StableViewPage
- **Economy and progression**: FacilitiesPage, WeaponShopPage, FinanceCenterPage, BookingOfficePage, AchievementsPage, HallOfRecordsPage
- **Guide and history**: GuidePage, ChangelogPage
- **Administration**: Admin dashboard, cycle, battle, player, economy, security, upload, changelog, achievement, tuning, refinement, repair, audit, league-history, subscription, tournament, and season pages

Legacy `/finances`, `/cycle-summary`, and `/tag-teams` paths redirect to their current destinations for compatibility. There is no in-game friends, guild, chat, marketplace, customization, blueprint, prestige-store, or robot-comparison surface on the current branch.

### State Management
- **Zustand stores**: Shared robot and stable data accessed across multiple pages
- **React Context**: Authentication and onboarding state
- **Local component state**: UI-specific data

## Security Architecture

### Authentication Flow
1. User submits credentials → `/api/auth/login`
2. bcrypt verifies the password hash
3. JWT generated with user ID and role
4. Client stores the token and includes it in `Authorization` headers
5. `auth` middleware validates the JWT on protected routes

### Protections
- Rate limiting: auth, general API, and user-economic limiters
- CORS: Configurable origin whitelist
- Security headers through Caddy
- Role-based access control: `user` and `admin` roles
- Parameterized queries through Prisma
- Trust proxy configured for Caddy
- Zod validation and ownership checks at API boundaries

## Deployment Architecture

```
┌──────────────────────────────────────────────┐
│          Scaleway DEV1-S VPS                 │
│          (2 vCPU, 2GB RAM, Ubuntu)           │
│                                               │
│  Caddy (ports 80/443)                         │
│  ├─ Auto HTTPS and security headers           │
│  ├─ /api/* → reverse_proxy :3001              │
│  └─ /* → Vite-built static frontend           │
│                                               │
│  PM2 → Express API (:3001) + node-cron        │
│  PostgreSQL 17 → armouredsouls database       │
│  UFW Firewall · Daily pg_dump backups          │
└──────────────────────────────────────────────┘
```

### Local Development
- Docker Compose for PostgreSQL 17
- `tsx watch` for backend hot reload
- Vite dev server for frontend
- Prisma Studio for database inspection

### Production
- PM2 manages the Node.js process with auto-restart and log rotation
- Caddy serves the Vite-built frontend and proxies API requests
- GitHub Actions deploys Acceptance on pushes to `main`
- Production deployment is a manual `workflow_dispatch` promotion
- Automated daily PostgreSQL backups

## Monitoring & Observability

### Current Implementation
- **Logging**: Winston structured logs with PM2 rotation
- **Health Check**: `/api/health` endpoint with database connectivity
- **Audit Log**: `AuditLog` captures game and financial events
- **Cycle Snapshots**: `CycleSnapshot` stores pre-aggregated metrics
- **Performance Monitoring**: Cycle processing-time and degradation detection
- **Operational alerting**: Discord webhook notifications and scheduled daily health reports

### Not Yet Implemented
- External monitoring dashboards such as Prometheus/Grafana
- Distributed tracing
- APM integration
- In-game notification inbox, friends, guilds, and chat

## Future Considerations

- **Real-Time In-Game Notifications**: WebSocket/SSE layer for a player notification inbox
- **Caching Layer**: Redis for frequently accessed data
- **Social Authentication**: OAuth 2.0 providers
- **Mobile Client**: React Native or PWA
- **Horizontal Scaling**: Stateless backend behind a load balancer, with scheduler extraction
- **Advanced Monitoring**: Prometheus, Grafana, structured log aggregation, and tracing
- **CDN**: Static asset delivery for global performance

---

## Architecture Decisions

### Retain `app/` Directory Structure

**Status**: Accepted (February 2026)

The entire codebase lives under `app/` — backend, frontend, Docker Compose, and infrastructure configs. CI/CD workflows, import paths, Prisma configuration, and TypeScript path mappings assume this structure.

---

## Risk Register

### HIGH: Single VPS = Single Point of Failure

The application runs on a single Scaleway DEV1-S instance. If the VPS goes down, the entire application is unavailable.

**Mitigation**: Automated daily backups, documented restore procedure, VPS provisioning guide, health endpoint, and CI/CD smoke tests.

### MEDIUM: No Horizontal Scaling

The DEV1-S instance cannot scale horizontally.

**Mitigation**: Sufficient for current scale. Scaleway allows in-place upgrades, and the backend is structured for future scheduler extraction and horizontal scaling.

**Upgrade path**: Vertical scaling first. Horizontal scaling remains deferred.

### LOW: Manual Production Promotion

Production deployments require a manual GitHub Actions trigger.

**Mitigation**: Intentional gate preventing accidental production deployment. Acceptance auto-deploys on pushes to `main`, and production is promoted only after the blocking CI/deployment prerequisites pass.
