---
inclusion: fileMatch
fileMatchPattern: "**/prisma/**,**/schema.prisma,**/migrations/**,**/db/**,**/database/**,**/*migration*"
---

# Database and Prisma Standards

## Schema
- Use normalized relational models unless measured query needs justify denormalization.
- Use snake_case table/column names, stable `id` keys, explicit foreign keys, appropriate `Decimal` types for precise amounts, timestamps, and booleans.
- Define indexes for foreign keys and recurring `WHERE`, `JOIN`, `ORDER BY`, and pagination access paths. Add composite indexes only for real query shapes.
- Do not place Credits on robots: `User.currency` is authoritative. Financial mutation rules belong to `backend-finance.md` and `docs/guides/FINANCIAL_LEDGER_AUDIT_GUIDE.md`.

## Prisma 7 and queries
- Application code imports the generated client through `src/lib/prisma.ts`; Prisma 7 requires the configured driver adapter. Regenerate after schema changes.
- Use parameterized Prisma queries. For raw SQL, use parameterized tagged templates only; never interpolate user input.
- Select only fields needed by the response, avoid N+1 queries with relation includes/set-based queries, and paginate large result sets with a stable order.
- Keep expensive query plans measurable with `EXPLAIN`; use `performance-guidelines.md` for broader performance work.

## Transactions and integrity
- Use a transaction when related writes must commit or roll back together. Keep it short, avoid external calls/user input, and do not nest unnecessarily.
- Current-economy balance, ledger, audit, financial breakdown, sequence, repair, settlement, and prestige rules are canonical in `backend-finance.md`; do not create alternate writers here.
- Allocate audit sequence numbers only through `withAuditSequence`; never read max-plus-one.
- Choose deletion behavior deliberately: membership rows without their robot have no meaning and cascade; durable battle rows outlive participants; polymorphic `standings` has no foreign key and must be deleted explicitly before the entities it references.

## Migrations
- Review impact, data preservation, indexes, constraints, and rollback before migration. Update fixtures/mocks and regenerate the client afterward.
- Use descriptive snake_case migration names and test migrations against a disposable database before deployment.
- If a column or relationship moves, migrate every read, write, predicate, and fixture to the new source; do not merely remove the old predicate.
- Update the relevant schema/API documentation. Deployment, backups, and rollback procedures belong to `environments-and-deployment.md` and `pre-deployment-checklist.md`.

## JSON fields
- Define explicit interfaces for every Prisma `Json` shape in `app/backend/src/types/` and import them from the barrel.
- Read JSON with `as unknown as SpecificType`; write typed values through `Prisma.InputJsonValue` using the same explicit cast pattern.
- Use `Record<string, unknown>` for intentionally flexible objects; validate untrusted JSON at the boundary.

## Operational boundaries
- Configure connection limits from environment settings appropriate to the deployment; do not hardcode environment-specific limits in code.
- Backup, restore, monitoring, slow-query operations, and secret handling are owned by the deployment/monitoring/security steering files. Do not put credentials or environment snapshots in schema guidance.
