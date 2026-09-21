---
inclusion: always
---

# Armoured Souls — Project Context

## Identity
Armoured Souls is a browser-based, turn-based robot-combat strategy game with leagues, tournaments, teams, progression, cycles, and a credit economy.

## Stack
- Backend: Node.js 24, strict TypeScript 5.8, Express 5, Prisma 7, PostgreSQL 17, JWT/bcrypt, PM2.
- Frontend: React 19, TypeScript, Vite 6, Tailwind CSS 4, Zustand, Fetch/Axios.
- Testing: Jest 30/fast-check (backend), Vitest 4/fast-check and Playwright (frontend).
- Operations: Docker Compose, Caddy, GitHub Actions, UFW, automated PostgreSQL backups.

## Repository map
- `app/backend` — API, services, game engine, persistence, scheduled cycles.
- `app/frontend` — player and admin React applications.
- `app/shared` — frontend/backend formulas and shared game types.
- `docs` — architecture, PRDs, guides, balance changes, design, and implementation notes.

## System map
Combat, leagues, tournaments, teams/tag team, KotH, Grand Melee, Booking Office subscriptions, cycles/settlement, fame/prestige, facilities, weapons, tuning, achievements, changelog, admin portal, dashboard, monitoring, seasons, guided setup, and Finance Center are implemented domains. Use the relevant service directory and PRD before changing behavior; the canonical service map is `docs/architecture/PRD_SERVICE_DIRECTORY.md`.

Important product boundaries:
- **Credits:** `User.currency` is authoritative. Current-economy mutations go through `Credit_Mutation_Service`; ledger and financial-audit pairing rules live in `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md`.
- **Finance Center:** `/income` is the player destination; `/finances` and `/cycle-summary` are compatibility redirects. The report contract is `docs/implementation_notes/finance-center-reporting-contract.md`.
- **Repairs and byes:** shared repair arithmetic is in `app/shared/utils/repairCost.ts`; bye rewards and resolution have dedicated backend modules. See `docs/architecture/PRD_BATTLE_DATA_ARCHITECTURE.md` and the relevant game-system PRDs.
- **Battle retention:** permanent battle data belongs in summaries/proper columns, not ephemeral `battle_log`.
- **Seasons:** live data is current-season scoped; cross-season history comes from archive tables only.
- **Competitive ranking:** standings are the source of truth for league/KotH/tag-team ranking data.
- **Shared formulas:** never duplicate a frontend/backend formula; put it in `app/shared/utils/`.

## Documentation map
- `docs/architecture/` — system contracts and security.
- `docs/game-systems/` — mechanics and balance behavior.
- `docs/prd_pages/` — page requirements.
- `docs/guides/` — operational and financial guidance.
- `docs/implementation_notes/` — implementation and release evidence.

Keep changes modular, secure, documented, and covered by the applicable test tier. Detailed rules are intentionally conditional in the other steering files; do not duplicate them here.
