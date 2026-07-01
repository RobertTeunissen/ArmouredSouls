# Armoured Souls Documentation

## Quick Start

1. Check `guides/operations/LOCAL_SETUP.md` for development environment setup
2. Review `architecture/ARCHITECTURE.md` for system architecture
3. Explore `design_ux/DESIGN_SYSTEM_README.md` for design guidelines
4. See `BACKLOG.md` for planned work

## Documentation Structure

```
docs/
├── BACKLOG.md              # Prioritized ideas to be specced
├── CHANGELOG.md            # Development history
│
├── architecture/           # How the system works (technical reference)
│   ├── ARCHITECTURE.md              System overview, tech stack, deployment
│   ├── DATABASE_SCHEMA.md           Complete Prisma schema reference
│   ├── PRD_SERVICE_DIRECTORY.md     18 backend service domains + cron schedule
│   ├── PRD_SECURITY.md              Security controls and exploit playbook
│   ├── PRD_BATTLE_DATA_ARCHITECTURE.md  Battle summaries, retention, data model
│   ├── BATTLE_SIMULATION_ARCHITECTURE.md  Combat engine deep dive
│   ├── COMBAT_FORMULAS.md           Hit chance, damage, crits, counters
│   ├── COMBAT_MESSAGES.md           Battle log message generation
│   ├── PRD_AUDIT_SYSTEM.md          Audit trail and event logging
│   └── SEED_DATA_SPECIFICATION.md   Dev/test seed data
│
├── game-systems/           # What the game does (rules, rewards, mechanics)
│   ├── GAME_DESIGN.md              Core game concept
│   ├── PRD_ECONOMY_SYSTEM.md       Credits, facilities, repair costs
│   ├── PRD_LEAGUE_SYSTEM.md        6-tier league system
│   ├── PRD_MATCHMAKING.md          LP-primary matchmaking
│   ├── PRD_WEAPONS_LOADOUT.md      47 weapons, 4 loadout types
│   ├── PRD_WEAPON_ECONOMY.md       Weapon pricing and balance
│   ├── PRD_TOURNAMENT_SYSTEM.md    Single-elimination brackets
│   ├── PRD_ROBOT_ATTRIBUTES.md     23 attributes, categories, caps
│   ├── PRD_PRESTIGE_AND_FAME.md    Progression and reputation
│   ├── PRD_CYCLE_SYSTEM.md         Daily cycle schedule and processing
│   ├── PRD_ACHIEVEMENT_SYSTEM.md   77-achievement progression layer
│   ├── PRD_ONBOARDING_SYSTEM.md    New player flow
│   ├── PRD_AUTO_USER_GENERATION.md Auto-generated opponents
│   ├── STABLE_SYSTEM.md            Facilities and stable mechanics
│   └── TUNING_BAY_SYSTEM.md        Per-robot tactical tuning
│
├── prd_pages/              # Page-specific PRDs (UI/UX requirements)
│   ├── PRD_DASHBOARD_PAGE.md
│   ├── PRD_ROBOT_DETAIL_PAGE.md
│   ├── PRD_BATTLE_HISTORY_PAGE.md
│   ├── PRD_BATTLE_REPORT_PAGE.md
│   ├── PRD_LEAGUE_STANDINGS.md
│   ├── PRD_WEAPON_SHOP.md
│   ├── PRD_FACILITIES_PAGE.md
│   ├── PRD_PRACTICE_ARENA.md
│   ├── PRD_ADMIN_PAGE.md
│   ├── PRD_STABLE_VIEW_PAGE.md
│   ├── PRD_HALL_OF_RECORDS.md
│   ├── PRD_INCOME_DASHBOARD.md
│   ├── PRD_LOGIN_PAGE.md
│   ├── PRD_ROBOTS_LIST_PAGE.md
│   └── PRD_BATTLE_STANCES_AND_YIELD.md
│
├── guides/                 # Operational and feature guides
│   ├── operations/
│   │   ├── LOCAL_SETUP.md           Dev environment setup
│   │   ├── DEPLOYMENT.md           Deploy to VPS
│   │   ├── VPS_SETUP.md            Initial VPS provisioning
│   │   ├── VPS_PROVISIONING_PRD.md  VPS requirements
│   │   ├── MAINTENANCE.md          Routine maintenance tasks
│   │   ├── MONITORING.md           Monitoring and alerting
│   │   └── TROUBLESHOOTING.md      Common issues and fixes
│   ├── ADMIN_PANEL_GUIDE.md         Admin portal usage
│   ├── ERROR_CODES.md               Error code reference
│   ├── ONBOARDING_ANALYTICS_GUIDE.md
│   └── ONBOARDING_TROUBLESHOOTING.md
│
├── design_ux/              # Brand, design system, UX
│   ├── DESIGN_SYSTEM_README.md      Entry point
│   ├── DESIGN_SYSTEM_AND_UX_GUIDE.md  Full design system
│   ├── DESIGN_SYSTEM_QUICK_REFERENCE.md  Token quick-ref
│   ├── 1_brand_&_logo_design_foundations.md
│   ├── 2_brand_type_system.md
│   ├── 2a_logo_geometry_&_construction.md
│   ├── 3_brand_usage_system.md
│   └── 4_motion_micro_animation_system.md
│
├── analysis/               # Design explorations and technical audits
│   ├── BATTLE_EXECUTION_AUDIT.md        Cross-type battle reference
│   ├── FREE_FOR_ALL_BATTLE_ROYALE_MODE.md  Grand Melee scaling analysis
│   ├── PRESTIGE_FAME_DESIGN_EXPLORATION.md  Fame cosmetics roadmap
│   └── ROBOT_DETAIL_PAGE_SPLIT_ANALYSIS.md  Profile/Workshop split design
│
├── balance_changes/        # Game balance modification history
│   ├── COUNTER_ATTACK_SYSTEM_REWORK.md
│   ├── RANGED_VS_MELEE_REBALANCE.md
│   ├── STARTING_ECONOMY_REBALANCE.md
│   ├── TRAINING_FACILITY_REBALANCE.md
│   ├── KOTH_LINEARIZED_SCALING.md
│   └── ... (11 entries)
│
├── features/               # Feature specifications
│   ├── AT_RISK_USERS_FEATURE.md
│   ├── user-registration.md
│   └── user-registration-error-reference.md
│
├── api/                    # API specifications
│   └── authentication.yaml
│
└── implementation_notes/   # (empty — candidates for removal)
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
| See achievement details | `game-systems/PRD_ACHIEVEMENT_SYSTEM.md` |
| Deploy to VPS | `guides/operations/DEPLOYMENT.md` |
| Troubleshoot production | `guides/operations/TROUBLESHOOTING.md` |
| Check monitoring/alerts | `guides/operations/MONITORING.md` |
| Understand design system | `design_ux/DESIGN_SYSTEM_README.md` |
| See what's planned | `BACKLOG.md` |
| See what's been built | `CHANGELOG.md` |
| Review battle engine details | `analysis/BATTLE_EXECUTION_AUDIT.md` |
