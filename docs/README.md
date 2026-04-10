# Armoured Souls Documentation

## Quick Start

1. Read `ROADMAP.md` for project overview and current status
2. Check `guides/operations/LOCAL_SETUP.md` for development environment setup
3. Review `architecture/ARCHITECTURE.md` for system architecture
4. Explore `design_ux/DESIGN_SYSTEM_README.md` for design guidelines

## Documentation Structure

```
docs/
├── ROADMAP.md              # Forward-looking roadmap
├── CHANGELOG.md            # Development history
├── BACKLOG.md              # Prioritized ideas to be specced
│
├── architecture/           # How the system works (technical reference)
│   ├── ARCHITECTURE.md         System overview, tech stack, deployment
│   ├── DATABASE_SCHEMA.md      Complete Prisma schema reference
│   ├── PRD_SERVICE_DIRECTORY.md 18 backend service domains
│   ├── PRD_SECURITY.md         Security controls and exploit playbook
│   ├── BATTLE_SIMULATION_ARCHITECTURE.md  Combat engine deep dive
│   ├── COMBAT_FORMULAS.md      Hit chance, damage, crits, counters
│   └── ...
│
├── game-systems/           # What the game does (rules, rewards, mechanics)
│   ├── GAME_DESIGN.md          Core game concept
│   ├── PRD_ECONOMY_SYSTEM.md   Credits, facilities, repair costs
│   ├── PRD_LEAGUE_SYSTEM.md    6-tier league system
│   ├── PRD_MATCHMAKING.md      LP-primary matchmaking
│   ├── PRD_WEAPONS_LOADOUT.md  47 weapons, 4 loadout types
│   └── ...
│
├── prd_pages/              # Page-specific PRDs
├── guides/                 # Operational guides
│   ├── operations/             Terminal guides (setup, deploy, maintain)
│   └── ...                     Feature guides, error codes
├── features/               # Feature documentation
├── design_ux/              # Brand, design system, UX
├── balance_changes/        # Game balance history
├── analysis/               # Design analysis and audits
└── api/                    # OpenAPI specs
```

## Finding What You Need

| I want to... | Go to |
|---|---|
| Set up development | `guides/operations/LOCAL_SETUP.md` |
| Understand the architecture | `architecture/ARCHITECTURE.md` |
| See the database schema | `architecture/DATABASE_SCHEMA.md` |
| Find a backend service | `architecture/PRD_SERVICE_DIRECTORY.md` |
| Understand combat math | `architecture/COMBAT_FORMULAS.md` |
| Check security controls | `architecture/PRD_SECURITY.md` |
| Understand the economy | `game-systems/PRD_ECONOMY_SYSTEM.md` |
| See league rules | `game-systems/PRD_LEAGUE_SYSTEM.md` |
| Check weapon stats | `game-systems/PRD_WEAPON_ECONOMY.md` |
| Deploy to VPS | `guides/operations/DEPLOYMENT.md` |
| Troubleshoot production | `guides/operations/TROUBLESHOOTING.md` |
| See what's planned | `ROADMAP.md` and `BACKLOG.md` |
