---
inclusion: always
---

# Armoured Souls — Coding Baseline

This file contains only cross-cutting rules. Domain-specific guidance is loaded from the conditional steering files listed below.

## TypeScript
- Use strict, explicit types; avoid `any`.
- Define return types and interfaces for object shapes; use union/intersection types where appropriate.
- Use kebab-case filenames, PascalCase classes/interfaces, camelCase functions/variables, and UPPER_SNAKE_CASE constants.
- Keep modules focused, functions short, and one primary class/interface per file unless types are tightly coupled.
- Use `as unknown as SpecificType` for Prisma JSON → typed casts; define stored JSON shapes in `src/types/` and import them from the barrel.
- Use `Number(value)` for Prisma Decimal conversion.

## Shared and backend architecture
- Shared game formulas belong in `app/shared/utils/`; do not duplicate them in frontend or backend code. `app/backend/src/shared/utils` is a symlink to that directory—never delete through the symlink or count it twice.
- Application code imports Prisma from the project-local generated client and the singleton in `src/lib/prisma.ts`; Prisma 7 clients require the configured driver adapter. Regenerate after schema changes.
- Route handlers are thin: validate input, authorize ownership, call a service, and return the response. Put business logic, helpers, and complex queries in services.
- Use parameterized Prisma queries, transactions for multi-step mutations, and appropriate indexes/pagination.
- `standings` is the source of truth for competitive ranking; do not read league/KotH/tag-team ranking stats from entity models.
- Battle orchestrators use the shared post-combat update and summary modules; permanent battle data must not depend on ephemeral `battle_log`.

## API and errors
- Use RESTful methods/status codes and the standard response shape `{ error, code, details? }`.
- Every route validates params/query/body with `validateRequest` and Zod. Use shared primitives; never put inline regex validation in routes.
- Every mutation of a user-owned resource verifies ownership inside the transaction when applicable; failures remain generic `403 Access denied`.
- Use domain `AppError` classes and error codes. Let Express 5 forward service errors to `errorHandler`; do not reformat errors in routes.
- Do not expose secrets, tokens, passwords, submitted values, or internal implementation details.

## Frontend
- Use functional React components with typed props and React 19 conventions (`ref` is a regular prop; use parameters instead of `defaultProps`).
- Prefer local state for local UI, Context only for truly global stable state, and Zustand for shared state. Always use store selectors. Full state guidance is in `frontend-state-management.md`.
- Keep components accessible, responsive, focused, and consistent with `docs/design_ux/`.

## Security baseline
- Validate at boundaries, hash passwords, use JWT expiry, whitelist CORS, and apply the correct authentication, authorization, rate-limit, and spending-lock middleware.
- Never commit secrets or weaken security/lint/test gates. Detailed backend security rules are in `backend-security.md` and `docs/architecture/PRD_SECURITY.md`.

## Quality gates
- Add or update focused tests for behavior changes and run the applicable tier. The test partition and blocking commands are canonical in `testing-strategy.md`.
- Run diagnostics/lint/build checks for changed code. Keep documentation and player-guide content aligned with behavior changes.
- Never use bypasses such as `continue-on-error`, `|| true`, or unguarded CI pipes. Shell and GitHub Actions rules are in `shell-ci-standards.md`.

## Domain references
- Persistence, deletion, sequence allocation, JSON, and financial atomicity: `database-best-practices.md` and `backend-finance.md`.
- Battle, season, repair, bye, scheduling, and post-combat invariants: `battle-data-architecture.md` and `game-mechanics-reference.md`.
- API/error/logging details: `api-versioning.md` and `error-handling-logging.md`.
- Frontend implementation: `frontend-standards.md` and `frontend-state-management.md`.
