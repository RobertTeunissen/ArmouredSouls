# Armoured Souls

A strategy simulation game where players manage a stable of battle robots, competing in automated leagues, tournaments, tag team matches, and King of the Hill events. Inspired by Football Manager — you configure, the engine simulates.

## Quick Start

See [docs/guides/operations/LOCAL_SETUP.md](docs/guides/operations/LOCAL_SETUP.md) for the full setup guide and troubleshooting.

```bash
# Clone and navigate
git clone https://github.com/RobertTeunissen/ArmouredSouls.git
cd ArmouredSouls/prototype

# Start database
docker compose up -d

# Backend
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npx tsx prisma/seed.ts
npm run dev  # Terminal 1

# Frontend (new terminal)
cd ../frontend
npm install
npm run dev  # Terminal 2
```

Open http://localhost:3000 — test credentials are in [LOCAL_SETUP.md](docs/guides/operations/LOCAL_SETUP.md).

If you see "Environment variable not found: DATABASE_URL", you forgot to create the `.env` file — run `cp .env.example .env` in `app/backend/`.

## What's Built

Armoured Souls is a fully functional prototype deployed to a production VPS. The core game loop is complete: create robots, configure loadouts, compete in automated daily cycles, view battle replays, and progress through leagues.

### Game Systems
- 4 battle modes: League (1v1), Tournament (bracket), Tag Team (2v2), King of the Hill (5-6 robot FFA)
- 23 robot attributes across 5 categories, all upgradeable
- 47 weapons (41 weapons + 6 shields) across 4 range bands
- 14 stable facilities with 10 levels each
- 6-tier league system (Bronze → Champion) with ELO-based matchmaking
- Economy: credits, prestige (stable-level), fame (robot-level), streaming revenue
- 5-step new player onboarding tutorial
- Deterministic tick-based combat engine with battle replay viewer
- In-game guide system
- Admin portal with cycle management, battle viewer, and analytics

### Tech Stack
- Backend: Node.js 24, TypeScript 5.8, Express 5, Prisma 7, PostgreSQL 17
- Frontend: React 19, Vite 6, Tailwind CSS 4, Zustand 5, React Router 6
- Testing: Jest 30 (backend), Vitest 4 (frontend), Playwright (E2E), fast-check (property-based)
- Infrastructure: Scaleway VPS, Caddy (auto HTTPS), PM2, GitHub Actions CI/CD

## Repository Structure

```
ArmouredSouls/
├── docs/                    # Documentation (organized by category)
│   ├── prd_core/            # Core game design, architecture, schema, combat
│   ├── prd_pages/           # Page-specific requirements
│   ├── guides/              # Setup, deployment, maintenance, security
│   ├── design_ux/           # Design system and brand guidelines
│   ├── balance_changes/     # Game balance modifications
│   ├── analysis/            # Feature analysis and planning
│   ├── implementation_notes/# Technical implementation details
│   ├── migrations/          # Database migration notes
│   └── troubleshooting/     # Debugging guides
├── app/
│   ├── backend/             # Express 5 API (13 domain service directories)
│   ├── frontend/            # React 19 SPA (27 pages)
│   ├── docker-compose.yml   # PostgreSQL for local dev
│   ├── Caddyfile            # Reverse proxy config (production)
│   └── ecosystem.config.js  # PM2 config (production)
└── .kiro/
    ├── specs/               # Feature specs (done + to-do)
    ├── steering/            # AI assistant context files
    └── hooks/               # Automated agent hooks
```

## Documentation

### Getting Started
- [Setup Guide](docs/guides/operations/LOCAL_SETUP.md) — Local development setup, testing, troubleshooting
- [Architecture](docs/architecture/ARCHITECTURE.md) — System architecture and deployment
- [Game Design](docs/game-systems/GAME_DESIGN.md) — Core game concept and mechanics

### Core Systems
- [Database Schema](docs/prd_core/DATABASE_SCHEMA.md) — Complete schema reference (18 models)
- [Battle Simulation](docs/prd_core/BATTLE_SIMULATION_ARCHITECTURE.md) — Combat engine, orchestrators, cycle scheduler
- [Combat Formulas](docs/prd_core/COMBAT_FORMULAS.md) — Hit chance, damage, crits, counters
- [Economy System](docs/prd_core/PRD_ECONOMY_SYSTEM.md) — Credits, facilities, rewards
- [Prestige & Fame](docs/prd_core/PRD_PRESTIGE_AND_FAME.md) — Dual reputation systems
- [Matchmaking](docs/prd_core/PRD_MATCHMAKING.md) — LP-primary matching algorithm
- [Weapons & Loadout](docs/prd_core/PRD_WEAPONS_LOADOUT.md) — 47 weapons, 4 loadout types
- [Onboarding](docs/prd_core/PRD_ONBOARDING_SYSTEM.md) — 5-step tutorial system

### Operations
- [Deployment Guide](docs/guides/DEPLOYMENT.md) — VPS deployment and maintenance
- [Security](docs/architecture/PRD_SECURITY.md) — Security strategy and practices
- [Error Codes](docs/guides/ERROR_CODES.md) — Domain-specific error reference
- [Service Directory](docs/architecture/PRD_SERVICE_DIRECTORY.md) — Backend service organization

### Development
- [Roadmap](docs/ROADMAP.md) — Development phases and completed specs
- [Contributing](CONTRIBUTING.md) — Development guidelines

## Project Status

The prototype is feature-complete and deployed to production. See the [Roadmap](docs/ROADMAP.md) for what's been shipped and what's planned next.

## License

Unlicensed — proprietary.

## Contact

Robert Teunissen — Project Owner
