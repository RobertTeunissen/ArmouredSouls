---
inclusion: always
---

# Coding Baseline

Cross-cutting rules only; domain rules live in conditional steering files.

## TypeScript
- Strict, explicit types; no `any`. Declare return types, interfaces for object shapes, and union/intersection types where they fit.
- kebab-case files, PascalCase classes/interfaces, camelCase functions/variables, UPPER_SNAKE_CASE constants.
- Focused modules, short functions, one primary class/interface per file unless types are tightly coupled.
- Prisma JSON → typed: `as unknown as SpecificType`, with stored JSON shapes defined in `src/types/` and imported from the barrel. Prisma Decimal → `Number(value)`.

## Backend
- Shared game formulas live only in `app/shared/utils/`; never duplicate them in frontend or backend. `app/backend/src/shared/utils` is a symlink to it: never delete through it or count it twice.
- Import Prisma from the project-local generated client via the `src/lib/prisma.ts` singleton (Prisma 7 needs the configured driver adapter). Regenerate after schema changes.
- Thin routes: validate, authorize ownership, call a service, respond. Business logic, helpers, and complex queries go in services.
- Parameterized Prisma queries, transactions for multi-step mutations, appropriate indexes and pagination.
- `standings` is the source of truth for league/KotH/tag-team ranking; never read ranking stats from entity models.
- Battle orchestrators use the shared post-combat update and summary modules. Permanent battle data goes in summaries/proper columns, never ephemeral `battle_log`.

## API and errors
- RESTful methods/status codes; error shape `{ error, code, details? }`.
- Every route validates params/query/body with `validateRequest` + Zod using shared primitives; no inline regex in routes.
- Mutations of user-owned resources verify ownership (inside the transaction when applicable); failures stay a generic `403 Access denied`.
- Throw domain `AppError` classes with error codes; Express 5 forwards them to `errorHandler`. Routes never reformat errors.
- Never expose secrets, tokens, passwords, submitted values, or internal details.

## Frontend
- Functional components with typed props and React 19 conventions (`ref` is a regular prop; parameters instead of `defaultProps`).
- Local state for local UI, Context only for stable global state, Zustand for shared state, always read through selectors.
- Accessible, responsive, focused components consistent with `docs/design_ux/`.

## Security
- Validate at boundaries, hash passwords, expire JWTs, whitelist CORS, and apply the correct auth, authorization, rate-limit, and spending-lock middleware. Details: `docs/architecture/PRD_SECURITY.md`.
- Never commit secrets or weaken security, lint, or test gates.

## Quality gates
- Add or update focused tests for behavior changes and run the applicable tier.
- Run diagnostics/lint/build for changed code. Keep docs and player-guide content aligned with behavior changes.
- No bypasses: no `continue-on-error`, `|| true`, or unguarded CI pipes.
