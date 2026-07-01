# Armoured Souls

A strategy simulation game where players manage a stable of battle robots, competing in automated leagues, tournaments, tag team matches, King of the Hill events, and Grand Melee. Inspired by Football Manager — you configure, the engine simulates.

## Quick Start

See [docs/guides/operations/LOCAL_SETUP.md](docs/guides/operations/LOCAL_SETUP.md) for the full setup guide and troubleshooting.

```bash
# Clone and navigate
git clone https://github.com/RobertTeunissen/ArmouredSouls.git
cd ArmouredSouls/app

# Start database
docker compose up -d

# Backend
cd backend
cp .env.example .env
pnpm install
pnpm run prisma:generate
pnpm run prisma:migrate
pnpm exec tsx prisma/seed.ts
pnpm run dev  # Terminal 1

# Frontend (new terminal)
cd ../frontend
pnpm install
pnpm run dev  # Terminal 2
```

Open http://localhost:3000 — test credentials are in [LOCAL_SETUP.md](docs/guides/operations/LOCAL_SETUP.md).

If you see "Environment variable not found: DATABASE_URL", you forgot to create the `.env` file — run `cp .env.example .env` in `app/backend/`.

## What's Built

Armoured Souls is deployed to a production VPS with a full game loop: create robots, configure loadouts, compete in automated daily cycles, view battle replays, and progress through leagues.

### Game Systems
- 6 battle modes: League (1v1), Tournament (bracket), Tag Team (2v2 sequential), Team Battle (2v2/3v3 simultaneous), King of the Hill (5-6 robot FFA), Grand Melee (20-robot elimination)
- 23 robot attributes across 5 categories, all upgradeable
- 47 weapons (41 weapons + 6 shields) across 4 range bands
- 13 stable facilities with 10 levels each
- 6-tier league system (Bronze → Champion) with LP-primary matchmaking
- Economy: credits, prestige (stable-level), fame (robot-level), streaming revenue
- Tuning Pool system for per-robot tactical attribute allocation
- 77-achievement progression layer with badges and toast notifications
- Booking Office event subscription system gating battle participation
- 5-step new player onboarding tutorial
- Deterministic tick-based combat engine with battle replay viewer
- In-game guide system
- Admin portal with cycle management, battle viewer, analytics, and 6 dashboards
- Monitoring & alerting via Discord webhooks

### Tech Stack
- Backend: Node.js 24, TypeScript 5.8, Express 5, Prisma 7, PostgreSQL 17
- Frontend: React 19, Vite 6, Tailwind CSS 4, Zustand 5, React Router 6
- Testing: Jest 30 (backend), Vitest 4 (frontend), Playwright (E2E), fast-check (property-based)
- Infrastructure: Scaleway VPS, Caddy (auto HTTPS), PM2, GitHub Actions CI/CD

## Repository Structure

```
ArmouredSouls/
├── docs/                    # Documentation (organized by category)
│   ├── architecture/        # System architecture, schema, combat engine, security
│   ├── game-systems/        # Game design, economy, leagues, weapons, onboarding
│   ├── prd_pages/           # Page-specific requirements
│   ├── guides/              # Setup, deployment, maintenance
│   ├── design_ux/           # Design system and brand guidelines
│   ├── balance_changes/     # Game balance modifications
│   └── analysis/            # Feature analysis and planning
├── app/
│   ├── backend/             # Express 5 API (20 domain service directories)
│   ├── frontend/            # React 19 SPA
│   ├── shared/              # Shared utilities (game formulas)
│   ├── docker-compose.yml   # PostgreSQL for local dev
│   ├── Caddyfile            # Reverse proxy config (production)
│   └── ecosystem.config.js  # PM2 config (production)
└── .kiro/
    ├── specs/               # Feature specs (done + to-do)
    ├── steering/            # AI assistant context files
    └── hooks/               # Automated agent hooks
```

## Documentation

See [docs/README.md](docs/README.md) for the full documentation index.

### Getting Started
- [Setup Guide](docs/guides/operations/LOCAL_SETUP.md) — Local development setup
- [Architecture](docs/architecture/ARCHITECTURE.md) — System architecture and deployment
- [Game Design](docs/game-systems/GAME_DESIGN.md) — Core game concept and mechanics

### Core Systems
- [Database Schema](docs/architecture/DATABASE_SCHEMA.md) — Schema reference
- [Battle Simulation](docs/architecture/BATTLE_SIMULATION_ARCHITECTURE.md) — Combat engine and orchestrators
- [Combat Formulas](docs/architecture/COMBAT_FORMULAS.md) — Hit chance, damage, crits, counters
- [Economy System](docs/game-systems/PRD_ECONOMY_SYSTEM.md) — Credits, facilities, rewards
- [Matchmaking](docs/game-systems/PRD_MATCHMAKING.md) — LP-primary matching algorithm
- [Service Directory](docs/architecture/PRD_SERVICE_DIRECTORY.md) — Backend service organization

### Operations
- [Deployment Guide](docs/guides/operations/DEPLOYMENT.md) — VPS deployment and maintenance
- [Security](docs/architecture/PRD_SECURITY.md) — Security strategy and practices
- [Error Codes](docs/guides/ERROR_CODES.md) — Domain-specific error reference

## License

Unlicensed — proprietary.
