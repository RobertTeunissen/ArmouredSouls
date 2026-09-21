---
inclusion: manual
---

# Performance Guidelines

## Decision rule
Measure first, identify the bottleneck, set a target, optimize, and measure again. Do not optimize code that is already adequate or add speculative infrastructure without an owner and measurement path.

## Database and backend
`database-best-practices.md` owns persistence/query rules. Apply its requirements: parameterized queries, indexes for real access paths, set-based queries instead of N+1 loops, selected fields, stable pagination, short transactions, and `EXPLAIN` for measured slow plans.

For expensive game cycles, preserve background execution and bounded work. Finance Center query-growth and response budgets are owned by `testing-strategy.md` and `docs/implementation_notes/finance-center-reporting-contract.md`. Do not introduce generic queues, caches, retries, or idempotency schemes without a domain-specific design.

## Frontend
`frontend-standards.md` owns lazy loading, derivation, memoization, responsive behavior, image handling, and accessibility. Optimize only when profiling or a measured bundle/query/render budget identifies a bottleneck.

## Operations and measurement
- Deployment readiness has a bounded health-check deadline; do not weaken it to hide slow startup.
- Monitoring and logging ownership is in `monitoring-observability.md` and `error-handling-logging.md`.
- Performance targets are valid only when a source, fixture, measurement command, and acceptance threshold exist. Do not present aspirational p95/p99, FCP, bundle, or API budgets as enforced project facts.
- Use the relevant test/performance fixture and `EXPLAIN` output as evidence. Avoid unbounded load commands against shared environments.

## Review checklist
- [ ] Measured the bottleneck and captured a before value.
- [ ] Chosen the narrowest change and checked query/render/network effects.
- [ ] Preserved authorization, transaction, cache, and idempotency semantics.
- [ ] Added or updated focused tests and the applicable performance fixture/budget.
- [ ] Measured after the change and documented any new durable target.
