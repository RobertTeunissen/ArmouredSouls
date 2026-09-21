---
inclusion: manual
---

# Common Tasks and Workflows

## Start here
- Local setup and commands: `docs/guides/operations/LOCAL_SETUP.md`.
- Service ownership: `docs/architecture/PRD_SERVICE_DIRECTORY.md`.
- Intended behavior: the relevant architecture, game-system, page PRD, balance note, or implementation note.
- Apply the matching steering owner; do not copy its rules into this file.

## Feature or behavior change
1. Identify affected services/routes/pages, data boundaries, and player-facing behavior.
2. Read the relevant PRD and owner steering; keep route handlers thin and business logic in services.
3. Implement with validation, ownership, financial, scheduling, or shared-formula boundaries as applicable.
4. Add focused tests to the correct tier and run the blocking gates in `testing-strategy.md`.
5. Update PRDs, implementation notes, API docs, and in-game guides required by `documentation-workflow.md` and `guide-content-maintenance.md`.

## Schema or persistence change
Use `docs/architecture/DATABASE_SCHEMA.md` and `database-best-practices.md`. Update the Prisma schema/migration, generated client, fixtures/mocks, affected documentation, and any moved predicates together; run the affected integration/heavy tier. Never put secrets in `.env` or source control.

## API change
Use `api-versioning.md`, `backend-security.md`, and `error-handling-logging.md`. Add Zod validation, ownership checks for mutations, standard `{ error, code, details? }` responses, typed API documentation, and tests. Keep services reusable across routes.

## Mechanics or balance change
Read the relevant game-system PRD and `game-mechanics-reference.md`; record balance rationale in `docs/balance_changes/`, update affected player-guide content, and test cross-system effects.

## Debugging or operations
Use `docs/guides/operations/TROUBLESHOOTING.md`, `MAINTENANCE.md`, and `MONITORING.md`; inspect `app/backend/cycle_logs/` for cycle issues. Do not use destructive database, Git, or process commands as generic first steps.

## Deployment
Use `environments-and-deployment.md`, `docs/guides/operations/DEPLOYMENT.md`, and the workflow files. Follow `pre-deployment-checklist.md`; do not duplicate deployment commands here.
