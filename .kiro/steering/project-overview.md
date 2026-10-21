---
inclusion: always
---

# Armoured Souls — Project Context

Browser-based, turn-based robot-combat strategy game with leagues, tournaments, teams, progression, cycles, and a credit economy.

## Stack
- Backend: Node.js 24, strict TypeScript 6.0.3, Express 5, Prisma 7, PostgreSQL 17, JWT/bcrypt, PM2.
- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS 4, Zustand, React Router 7, Fetch/Axios.
- Testing: Jest 30/fast-check (backend), Vitest 5/fast-check and Playwright (frontend).
- Operations: Docker Compose, Caddy, GitHub Actions, UFW, automated PostgreSQL backups.

## Repository map
- `app/backend` — API, services, game engine, persistence, scheduled cycles.
- `app/frontend` — player and admin React applications.
- `app/shared` — shared formulas and game types.
- `docs/` — `architecture/` (system contracts, security), `game-systems/` (mechanics, balance), `prd_pages/` (page requirements), `guides/` (operations, finance), `implementation_notes/` (implementation and release evidence), plus `balance_changes/` and `design_ux/`.

## System map
Implemented domains: combat, leagues, tournaments, teams/tag team, KotH, Grand Melee, Booking Office subscriptions, cycles/settlement, fame/prestige, facilities, weapons, tuning, achievements, changelog, admin portal, dashboard, monitoring, seasons, guided setup, Finance Center, Automaton stables. Read the relevant service directory and PRD before changing behavior; the service map is `docs/architecture/PRD_SERVICE_DIRECTORY.md`.

Product boundaries:
- **Credits:** `User.currency` is authoritative; current-economy mutations go through `Credit_Mutation_Service`. Pairing rules: `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md`.
- **Finance Center:** `/income` is the player destination; `/finances` and `/cycle-summary` redirect. Contract: `docs/implementation_notes/finance-center-reporting-contract.md`.
- **Repairs and byes:** repair arithmetic is `app/shared/utils/repairCost.ts`; bye rewards and resolution have dedicated backend modules. See `docs/architecture/PRD_BATTLE_DATA_ARCHITECTURE.md`.
- **Seasons:** live data is current-season scoped; cross-season history comes only from archive tables.
- **Stable types:** `User.stableType` is `human`, `generated` (`isGenerated` bots, deleted at rollover), or `automaton` (persistent computer-run stables; no login, grants, or Manual_Repair; turns run after settlement). See `docs/game-systems/PRD_AUTOMATON_STABLES.md`.

Keep changes modular, secure, documented, and tested at the applicable tier. Detailed rules live in conditional steering files; do not duplicate them here.
