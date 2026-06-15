---
inclusion: always
---

# Armoured Souls Project Overview

## Project Type
Browser-based robot combat strategy game with turn-based mechanics, league systems, and economic simulation.

## Technology Stack

### Backend
- **Runtime**: Node.js 24 LTS
- **Language**: TypeScript 5.8 (strict mode)
- **Framework**: Express 5
- **ORM**: Prisma 7 (PostgreSQL)
- **Authentication**: JWT with bcrypt password hashing
- **Process Manager**: PM2 (production)
- **Testing**: Jest 30 with property-based testing (fast-check)

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS 4
- **Testing**: Vitest 4 with property-based testing (fast-check)
- **State Management**: Zustand + React Context + hooks
- **HTTP Client**: Fetch API / Axios

### Database
- **DBMS**: PostgreSQL 17
- **Containerization**: Docker Compose
- **Migrations**: Prisma Migrate
- **Connection Pooling**: Prisma connection limits

### Infrastructure
- **Reverse Proxy**: Caddy (automatic HTTPS)
- **Hosting**: Scaleway DEV1-S VPS (2 vCPU, 2GB RAM)
- **CI/CD**: GitHub Actions
- **Firewall**: UFW (Ubuntu)
- **Backups**: Automated daily PostgreSQL dumps

## Project Structure
- `/app/backend` - Main backend application (services organized into 18 domain subdirectories under src/services/)
- `/app/frontend` - React frontend application
- `/app/shared` - Shared TypeScript modules imported by both frontend and backend (game formulas, discount calculations)
- `/docs` - Comprehensive documentation organized by category (includes modular architecture migration plan in `docs/guides/`)

## Key Systems
1. **Combat System** - Turn-based robot battles with weapons, armor, and damage calculations
2. **League System** - Competitive ranking with promotions/relegations
3. **Economy** - Credits, facilities, investments, weapon shop
4. **Cycle System** - Automated daily game cycles
5. **Fame & Prestige** - Player progression 
6. **Tournament System** - Competitive events
7. **Changelog System** - In-game "What's New" feed with auto-generated drafts from deploys, admin review/publish workflow, and player notification modal
8. **Tuning Pool System** - Per-robot tactical attribute tuning with facility-gated pool size (Spec #25)
9. **Achievement System** - 77-achievement progression layer with badges, progress tracking, rarity, pinned showcase, and toast notifications (Spec #27)
10. **Admin Portal** - Dedicated admin experience with sidebar navigation, 18 route-based lazy-loaded pages, Zustand shared state (useAdminStore), AdminRoute guard, 6 analytics dashboards, shared UI component library, and server-side audit trail (Spec #28)
11. **Monitoring & Alerting** - Discord webhook alerts for disk/startup/backup/deploy failures, daily health report, UptimeRobot external probes, Scaleway Cockpit metrics (Spec #29)
12. **League History Tracking** - Persistent tier change tracking for robots and teams (entityType `'tag_team'` references TeamBattle.id for 2v2 tag team history), admin analytics dashboard with yo-yo detection, player-facing timeline visualizations, achievement data support (Spec #32)
13. **Booking Office / Event Subscription System** - Per-robot subscription model gating participation in all battle events (league_1v1, tournament_1v1, tag_team, koth, league_2v2, league_3v3, tournament_2v2, tournament_3v3) through a single extensible Event Registry, with facility-level-driven cap curve (3 base + 1 per level), free switching, and per-robot lock-on-queued-battle rule (Spec #35)
14. **Daily Cron Schedule** - 10-slot daily schedule with heavy-mode spacing (1v1 League 08:00, 2v2 League 09:00, 3v3 League 14:00, KotH 13:00), team2v2Tournament at 15:00 UTC, team3v3Tournament at 18:00 UTC, and midnight settlement. All events run daily; subscriptions gate participation. Canonical slot map in `docs/architecture/PRD_SERVICE_DIRECTORY.md` § Cron Schedule (Spec #36)
15. **Team Battle Mode (2v2 and 3v3 League + Tag Team)** - Persistent Teams with multiple combat modes. 2v2 teams participate in both simultaneous 2v2 League combat and sequential Tag Team combat (1v1 with tag-out mechanics, Active/Reserve slot roles, separate `tagTeamLp` track and tag team league tiers). 3v3 teams participate in simultaneous 3v3 League combat. All modes share the `TeamBattle` model with per-mode LP and stats isolation (`teamLp`/`totalLeagueWins` for league, `tagTeamLp`/`totalTagTeamWins` for tag team). Tag team is a combat mode on 2v2 TeamBattle, not a separate entity. Team Coordination ally effects (focus fire, shield regen, formation defence), shared LP-primary matchmaking, N× reward multiplier, daily cadence (2v2 at 09:00, 3v3 at 14:00 UTC), subscription-gated participation via Booking Office using `hasSubscription()` per mode (`league_2v2`, `tag_team`, `league_3v3`), eligibility feedback with `ineligibilityReason`/`ineligibilityDetail` shown on Dashboard and Team Management page (Specs #37, Tag Team System Unification)
16. **Team Battle Tournaments (2v2 and 3v3)** - Single-elimination bracketed tournaments for persistent teams, entity-agnostic tournament schema with participantType discriminator, Team Battle Engine combat with coordination effects, daily round cadence (2v2 at 15:00 UTC, 3v3 at 18:00 UTC), subscription-gated via tournament_2v2/tournament_3v3 events, per-type championship title tracking, stepped prestige curve with championship bonus (Spec #38)

## Documentation Organization
- `docs/architecture/` - System architecture, schema, combat engine, security
- `docs/game-systems/` - Game design and system specifications
- `docs/prd_pages/` - Page-specific requirements
- `docs/guides/` - Setup, deployment, maintenance guides
- `docs/analysis/` - Feature analysis and planning
- `docs/balance_changes/` - Game balance modifications
- `docs/design_ux/` - Design system and brand guidelines
- `docs/implementation_notes/` - Technical implementation details

## Development Principles
- Modular architecture for maintainability
- Comprehensive documentation for all features
- Security-first approach (see docs/architecture/PRD_SECURITY.md)
- Database-driven game state management
- RESTful API design
