# Armoured Souls — Architecture Overview

**Last Updated**: April 2, 2026

## System Architecture

### High-Level Design

Armoured Souls is a monolithic Node.js application with a React SPA frontend, deployed on a single VPS behind Caddy as a reverse proxy. The architecture prioritizes simplicity and rapid iteration over distributed complexity.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React 19 SPA (Vite 6)                   │   │
│  │   Zustand stores · React Context · React Router 6    │   │
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
│  │  13 Domain Services:                                  │   │
│  │  analytics · arena · auth · battle · common · cycle   │   │
│  │  economy · koth · league · notifications              │   │
│  │  onboarding · tag-team · tournament                   │   │
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
- Clear module boundaries via the 13 service directories allow future extraction if needed

### 2. Server-Authoritative Game Logic
- All battle simulation, economy calculations, and league processing run server-side
- Clients are display-only for game outcomes — no client-side game state computation
- Deterministic battle engine ensures reproducible results

### 3. Scheduled Batch Processing
- Game cycles (leagues, tournaments, tag teams, KotH) run on cron schedules via `node-cron`
- No real-time WebSocket layer — players configure, then check results after processing
- Configurable schedules per battle mode (league, tournament, tag-team, KotH, settlement)

### 4. Security by Design
- All communication over HTTPS (Caddy auto-provisions Let's Encrypt certificates)
- JWT-based authentication with bcrypt password hashing
- Rate limiting on auth endpoints (dedicated limiter) and general API (global limiter)
- Input validation at the route layer
- Domain-specific error classes prevent leaking internal details

### 5. Comprehensive Testing
- Backend: Jest 30 with ts-jest (unit, integration, and heavy test configs)
- Frontend: Vitest 4 with @testing-library/react
- E2E: Playwright
- Property-based testing: fast-check on both backend and frontend

## Technology Stack

### Backend
- **Runtime**: Node.js 24 LTS
- **Language**: TypeScript 5.8 (strict mode)
- **Framework**: Express 5
- **ORM**: Prisma 7 with `@prisma/adapter-pg` driver adapter
- **Database**: PostgreSQL 17
- **Authentication**: JWT (`jsonwebtoken`) + bcrypt 6
- **Scheduling**: node-cron 4
- **Logging**: Winston 3
- **Rate Limiting**: express-rate-limit 8
- **Process Manager**: PM2 (production)
- **Testing**: Jest 30, Supertest 7, fast-check 4

### Frontend
- **Framework**: React 19 with TypeScript 5.8
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **Routing**: React Router 6
- **State Management**: Zustand 5 (robotStore, stableStore) + React Context (AuthContext, OnboardingContext)
- **Charts**: Recharts 3
- **Markdown**: react-markdown 10 + remark-gfm
- **Testing**: Vitest 4, @testing-library/react 16, Playwright 1.58, fast-check 4

### Infrastructure
- **Hosting**: Scaleway DEV1-S VPS (2 vCPU, 2GB RAM, Ubuntu)
- **Reverse Proxy**: Caddy (automatic HTTPS, gzip/zstd compression, security headers)
- **Database (dev)**: Docker Compose — PostgreSQL 17-alpine
- **Database (prod)**: Native PostgreSQL installation
- **Process Manager**: PM2 (single instance, auto-restart, log rotation)
- **CI/CD**: GitHub Actions
- **Firewall**: UFW
- **Backups**: Automated daily PostgreSQL dumps

## Backend Service Architecture

The backend is organized into 13 domain service directories under `src/services/`:

| Service | Responsibility |
|---|---|
| `analytics` | Game metrics, player analytics, cycle snapshots |
| `arena` | Arena battle management |
| `auth` | User registration, login, JWT token management |
| `battle` | Deterministic combat simulation engine |
| `common` | Shared utilities and helpers |
| `cycle` | Cron-based cycle scheduler, batch processing orchestration |
| `economy` | Credits, facilities (14 types, levels 0–10), weapon shop, finances |
| `koth` | King of the Hill battle mode |
| `league` | League standings, promotions/relegations, matchmaking |
| `notifications` | Event notification generation |
| `onboarding` | 9-step player onboarding flow |
| `tag-team` | 2v2 tag team compositions and battles |
| `tournament` | Tournament brackets and management |

### Middleware Stack
- `auth.ts` — JWT validation for protected routes
- `errorHandler.ts` — Centralized error handling with `AppError` hierarchy
- `rateLimiter.ts` — Auth-specific and general rate limiters
- `requestLogger.ts` — Winston-based request logging

### Error Handling
Domain-specific error classes extend a base `AppError`:
- `AuthError`, `BattleError`, `EconomyError`, `KothError`, `LeagueError`
- `OnboardingError`, `RobotError`, `TagTeamError`, `TournamentError`

Each class carries typed error codes. Express 5 automatically forwards rejected promises to the error middleware — no manual try-catch wrappers needed in route handlers.

### API Routes (21 route files)

```
/api/auth              — Registration, login
/api/user              — Profile management
/api/robots            — Robot CRUD, attributes
/api/weapons           — Weapon catalog
/api/weapon-inventory  — Player weapon ownership
/api/facilities        — Facility upgrades
/api/finances          — Financial reports
/api/matches           — League match history
/api/leagues           — League standings
/api/leaderboards      — Rankings (prestige, fame, losses)
/api/records           — Hall of Records
/api/tournaments       — Tournament management
/api/tag-teams         — Tag team management
/api/koth              — King of the Hill
/api/analytics         — Game analytics
/api/onboarding        — Onboarding flow
/api/guide             — In-game guide content
/api/admin             — Admin controls, cycle management
/api/health            — Health check (DB connectivity)
```

## Database Schema

18 core models managed by Prisma 7 (PostgreSQL 17):

| Model | Purpose |
|---|---|
| `User` | Player accounts — currency, prestige, onboarding state, profile settings |
| `Robot` | 23 core attributes, combat state, league/fame tracking |
| `Facility` | 14 facility types with levels 0–10, coaching staff |
| `Weapon` | Weapon definitions — damage, cooldown, attribute bonuses |
| `WeaponInventory` | Player weapon ownership |
| `Battle` | Battle records with time-based combat logs (JSON) |
| `BattleParticipant` | Per-robot battle statistics |
| `ScheduledLeagueMatch` | Scheduled 1v1 league battles |
| `ScheduledTournamentMatch` | Tournament bracket matches |
| `Tournament` | Tournament lifecycle management |
| `TagTeam` | 2v2 team compositions |
| `ScheduledTagTeamMatch` | Scheduled 2v2 battles |
| `ScheduledKothMatch` | King of the Hill matches |
| `ScheduledKothMatchParticipant` | KotH participant tracking |
| `CycleMetadata` | Global cycle state (singleton) |
| `CycleSnapshot` | Pre-aggregated metrics for historical queries |
| `AuditLog` | Event sourcing for all game events |
| `ResetLog` | Account reset tracking |

Prisma 7 uses the `client` engine type with `@prisma/adapter-pg`. The app singleton in `src/lib/prisma.ts` handles adapter setup — standalone scripts and tests create their own adapter instances.

## Battle Simulation Architecture

### Scheduled Batch Processing

Battles run on configurable cron schedules via `node-cron`. The cycle scheduler supports independent schedules for each battle mode:

```
┌─────────────────────────────────────────────────────────────┐
│                    Battle Cycle Flow                         │
│                                                              │
│  1. Configuration Phase (Continuous)                         │
│     ├─ Players set up robots, select weapons/strategies     │
│     └─ Join matchmaking queues                              │
│                                                              │
│  2. Cycle Trigger (node-cron schedule)                      │
│     ├─ Matchmaking pairs players                            │
│     └─ Configurations locked for processing                 │
│                                                              │
│  3. Batch Processing                                        │
│     ├─ Deterministic simulation engine runs all matches     │
│     ├─ Time-based combat logs generated (stored as JSON)    │
│     ├─ League points, fame, prestige calculated             │
│     └─ Cycle snapshot captured for analytics                │
│                                                              │
│  4. Results Available                                       │
│     ├─ Rankings and stats updated                           │
│     ├─ Battle replays available (canvas-based playback)     │
│     ├─ Financial settlements processed                      │
│     └─ Audit log entries created                            │
│                                                              │
│  5. Next Cycle Begins                                       │
└─────────────────────────────────────────────────────────────┘
```

### Battle Engine Properties

- **Server-Authoritative**: All logic runs server-side. Clients never compute outcomes.
- **Deterministic**: Same inputs always produce same outputs. Enables replay and debugging.
- **Batch-Oriented**: Processes all scheduled matches in a single cycle run.
- **Multi-Mode**: Supports league (1v1), tournament (bracket), tag-team (2v2), and King of the Hill.

### Cycle Scheduler Features
- Configurable cron expressions per battle mode (league, tournament, tag-team, KotH, settlement)
- Distributed lock mechanism for multi-instance safety
- Performance monitoring and degradation detection
- CSV export for battle data
- Cycle snapshots for historical metrics

## Frontend Architecture

### Pages (27 implemented)

- **Auth**: FrontPage, LoginForm, RegistrationForm
- **Core**: DashboardPage, ProfilePage, RobotsPage, RobotDetailPage, CreateRobotPage
- **Battles**: BattleHistoryPage, BattleDetailPage, BattlePlaybackViewer
- **Leagues**: LeagueStandingsPage, LeaderboardsPrestigePage, LeaderboardsFamePage, LeaderboardsLossesPage
- **Tournaments**: TournamentsPage, TournamentDetailPage
- **Tag Teams**: TagTeamManagementPage, TagTeamStandingsPage
- **KotH**: KothStandingsPage
- **Economy**: FacilitiesPage, WeaponShopPage, FinancialReportPage
- **Admin**: AdminPage, OnboardingAnalyticsPage
- **Other**: GuidePage, HallOfRecordsPage, CycleSummaryPage

### State Management
- **Zustand stores** (`robotStore`, `stableStore`): Shared data accessed across multiple pages
- **React Context** (`AuthContext`, `OnboardingContext`): Global, rarely-changing state
- **Local component state**: UI-specific data

## Security Architecture

### Authentication Flow
1. User submits credentials → `/api/auth/login`
2. bcrypt verifies password hash
3. JWT generated with user ID and role
4. Client stores token, includes in `Authorization` header
5. `auth` middleware validates JWT on protected routes

### Protections
- Rate limiting: Dedicated auth limiter + general API limiter
- CORS: Configurable origin whitelist
- Security headers via Caddy: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`
- Role-based access control: `user` and `admin` roles
- Parameterized queries via Prisma (SQL injection prevention)
- Trust proxy configured for correct client IP behind Caddy

## Deployment Architecture

```
┌──────────────────────────────────────────────┐
│          Scaleway DEV1-S VPS                 │
│          (2 vCPU, 2GB RAM, Ubuntu)           │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  Caddy (ports 80/443)                   │ │
│  │  ├─ Auto HTTPS (Let's Encrypt)          │ │
│  │  ├─ /api/* → reverse_proxy :3001        │ │
│  │  └─ /* → static files (Vite build)      │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  PM2                                     │ │
│  │  └─ armouredsouls-backend (Node.js)     │ │
│  │     ├─ Express 5 API server (:3001)     │ │
│  │     └─ node-cron cycle scheduler        │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │  PostgreSQL 17                           │ │
│  │  └─ armouredsouls database              │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  UFW Firewall · Daily pg_dump backups        │
└──────────────────────────────────────────────┘
```

### Local Development
- Docker Compose for PostgreSQL
- `tsx watch` for backend hot-reload
- Vite dev server for frontend
- Prisma Studio for database inspection

### Production
- PM2 manages the Node.js process (auto-restart, log rotation, 1500M memory limit)
- Caddy serves the Vite-built frontend as static files and proxies API requests
- GitHub Actions for CI/CD
- Automated daily PostgreSQL backups

## Monitoring & Observability

### Current Implementation
- **Logging**: Winston (structured JSON logs to files, rotated by PM2)
- **Health Check**: `/api/health` endpoint (verifies DB connectivity)
- **Audit Log**: `AuditLog` model captures all game events (event sourcing)
- **Cycle Snapshots**: `CycleSnapshot` model stores pre-aggregated metrics per cycle
- **Performance Monitoring**: Cycle scheduler tracks processing times and detects degradation

### Not Yet Implemented
- External monitoring (Prometheus/Grafana)
- Distributed tracing
- Alerting system
- APM integration

## Future Considerations

- **Real-Time Notifications**: WebSocket layer for live battle results and cycle alerts
- **Caching Layer**: Redis for frequently accessed data (leaderboards, weapon catalog)
- **Social Authentication**: OAuth 2.0 providers (Google, etc.)
- **Mobile Client**: React Native or PWA
- **Horizontal Scaling**: Stateless backend behind load balancer (requires extracting scheduler to a separate process)
- **Advanced Monitoring**: Prometheus + Grafana, structured log aggregation
- **CDN**: Static asset delivery for global performance
