---
inclusion: always
---

# Coding Standards for Armoured Souls

## TypeScript Standards

### Type Safety
- Always use explicit types, avoid `any` unless absolutely necessary
- Use interfaces for object shapes, types for unions/intersections
- Leverage TypeScript's strict mode features
- Define return types for all functions
- Use `Prisma.{Model}GetPayload<{ include: {...} }>` for typed query results with includes (e.g., `Prisma.BattleGetPayload<{ include: { participants: true } }>`)
- Use `Number(value)` instead of `(value as any).toNumber()` for Prisma Decimal conversion
- Use `as unknown as TypedInterface[]` for casting Prisma JSON fields to typed arrays (e.g., `snapshot.metrics as unknown as StableMetric[]`)
- Define explicit interfaces in `src/types/` for all JSON payload structures stored in Prisma `Json` fields (e.g., `CycleSnapshot.stableMetrics`, `AuditLog.payload`, `Battle.battleLog`)
- Import shared types from `src/types/` barrel export — never define local copies of `StableMetric`, `RobotMetric`, `BattleLogData`, etc.
- For Prisma `Json` → typed object casts, use `as unknown as SpecificType` (two-step cast through `unknown`)

### Naming Conventions
- **Files**: kebab-case (e.g., `robot-service.ts`)
- **Classes**: PascalCase (e.g., `RobotService`)
- **Functions/Variables**: camelCase (e.g., `calculateDamage`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_WEAPON_SLOTS`)
- **Interfaces**: PascalCase with descriptive names (e.g., `RobotAttributes`)
- **Database tables**: snake_case (e.g., `robot_weapons`)

### Code Organization
- One class/interface per file (with exceptions for tightly coupled types)
- Group related functionality into services
- Keep functions focused and single-purpose
- Maximum function length: ~50 lines (guideline, not strict rule)
- Game formulas shared between frontend and backend (upgrade costs, academy caps, discount calculations, **repair costs**) must live in `app/shared/utils/` — never inline or locally redefine a formula that already exists there
- **Repair cost is the worked example of what happens when this rule is ignored.** The rule was in this file the whole time, and for as long as the duplicate stood it was violated: `app/shared/utils/repairCost.ts` held the shared declaration, `app/backend/src/utils/robotCalculations.ts` held a second one that was the one both repair paths actually executed, and `YieldThresholdSlider.tsx` held a third inline copy driving the on-screen estimate. The shared module's own header comment asked for the migration and nothing enforced it, so the number a player was charged came from the declaration that was not shared. Spec #48 collapsed all three into `calculateRepairQuote` in `app/shared/utils/repairCost.ts`. A duplicate that "agrees today" is not a duplicate that agrees tomorrow.
- **`app/backend/src/shared/utils` is a symlink to `app/shared/utils`.** A file that appears under both paths is one file, not two. The Backend imports the shared modules through that symlink (`../../shared/utils/repairCost`), so do not "de-duplicate" a path that resolves to the same inode, and do not delete anything through the symlinked path — that deletes the shared module. It also affects greps: BSD `grep -r` follows symlinks and GNU `grep -r` does not, so a recursive search over `app/` reports a shared file twice on macOS and once in CI. Pass `--exclude-dir=shared` when a check counts matches.

### Route Handler Guidelines
- Route handlers should be thin wrappers: parse input, call a service, return the response
- No standalone `function` definitions inside route files — extract helpers into service modules under `src/services/`
- No inline Prisma queries with complex joins or aggregations — move those to service methods
- Express 5 catches async errors automatically — no try-catch wrappers needed in route handlers

## Framework-Specific Standards

### Prisma 7
- Import Prisma client from the project-local `generated/prisma` directory, NOT from `@prisma/client`
- Example: `import { PrismaClient } from '../generated/prisma'`
- The generated client lives at `app/backend/generated/prisma/`
- Run `pnpm exec prisma generate` after schema changes to regenerate the client
- **Driver Adapter Required**: Prisma 7 uses the `client` engine type by default, which requires a driver adapter. Always pass an adapter to the PrismaClient constructor:
  ```typescript
  import { PrismaClient } from '../generated/prisma';
  import { PrismaPg } from '@prisma/adapter-pg';
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter, log: ['error'] });
  ```
- The main app singleton in `src/lib/prisma.ts` handles this automatically — import from there for application code
- Standalone scripts and integration tests must create their own adapter instance

### Express 5
- Async errors in route handlers are caught automatically — no need for manual try-catch wrappers around async route handlers for promise rejections
- Express 5 forwards rejected promises to the error-handling middleware automatically
- `req.param()` is removed — use `req.params`, `req.body`, or `req.query` instead
- Path patterns use stricter matching (updated path-to-regexp)

### React 19
- Use `ref` as a regular prop — `forwardRef` is no longer needed
- Use JS default parameters instead of `defaultProps` on function components
- Use `@testing-library/react` for component testing — `react-dom/test-utils` is removed
- New hooks available: `use()`, `useActionState`, `useOptimistic`

### Testing Frameworks
- Backend: Jest 30 with ts-jest for TypeScript support
- Frontend: Vitest 4 with `@vitest/coverage-v8` for coverage
- Both: fast-check for property-based testing

## Backend Standards

### API Design
- RESTful endpoints with consistent naming
- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Return appropriate status codes
- Include error messages in consistent format
- Validate all inputs

### Database Interactions
- Use parameterized queries to prevent SQL injection
- Handle database errors gracefully
- Use transactions for multi-step operations
- Include proper indexes for performance
- Never read league, KotH, or tag-team competitive stats from the Robot or TeamBattle models — the `standings` table is the single source of truth for all competitive ranking data. Use `prisma.standing.findUnique({ where: { entityType_entityId_mode: { entityType: 'robot', entityId: robotId, mode: 'league_1v1' } } })` for per-entity lookups.

### Season-Scoped Data (Spec #45)

- **Never assume data older than the current season exists.** A Season_Rollover purges `battles`, `battle_summaries`, `audit_logs`, `cycle_snapshots`, `financial_ledger`, `league_history`, `leaderboard_cache`, and `practice_arena_daily_stats`. Any query that reaches back further than the current season will silently return nothing.
- **Read cross-season history from the archive tables only**: `stable_season_archives`, `robot_season_archives`, `season_accolades`, `season_standing_snapshots`. These hold denormalized text and numbers with no foreign key to a purged row, so they survive every rollover.
- **Never re-derive an archived figure from live data.** Archive rows are the record of what happened under the balance rules of their own season; recomputing them under current rules would rewrite history.
- **Classify system stables by `users.is_generated`, never by username prefix.** The column is authoritative and defaults to `false`, so an unclassified account fails safe as a Human_Stable and is never deleted by a rollover.
- **Never read `battle_log` for permanent data** — see the Battle Data Architecture section below; the same reasoning applies with a shorter horizon.
- **The two old-key fallbacks in `app/backend/src/services/economy/repairPayloadKeys.ts` are removable at the next Season_Rollover.** They exist only to read rows written before Spec #48 renamed the keys, and a rollover purges `audit_logs` and `cycle_snapshots` in full, so after the first rollover no row can carry an old key. Remove the fallbacks, not the resolvers — the resolvers are also where the malformed-row rule lives.

### Battle Data Architecture (Spec #39)
- **Never read `battle_log` for permanent data.** The `battle_log` column is ephemeral — NULLed after 7 days. All persistent battle data lives in `battle_summaries` (pre-computed stats) or proper columns (`battles.winning_side`).
- **Always write a `BattleSummary` at battle creation.** Every orchestrator must call `computeBattleSummary()` and insert a row in `battle_summaries` alongside the battle creation. Wrap in try/catch — never fail a battle because the summary fails.
- **Use `battles.winning_side` for team battle winner detection**, not `battleLog.winningSide`. The column survives retention and is indexable.
- **The shared computation lives in `app/shared/utils/battleStatistics.ts`.** Both frontend and backend import from here — no duplicate implementations.

### Repair Data Architecture (Spec #48)

- **Every repair *spend* figure is read from Repair_Spend_Source and nothing else**: `audit_logs` rows with `eventType: 'robot_repair'`, whose payload carries `creditsCharged`, `repairType`, `manualRepairDiscount` and, on manual events only, `creditsBeforeManualDiscount`.
- **The three things that are not a repair spend source:**
  - **Not a `battle_complete` payload.** `payload.repairCost` was read in two places and written by nobody. The CSV column fed from it exported `0` on every row for as long as it existed, and the snapshot rollup was only correct by accident — the day an orchestrator added the field, every stable's repair total would have doubled. Both reads and the optional field are gone; do not reintroduce them.
  - **Not the Cached_Repair_Quote column** (`robots.repairQuoteCredits`). It is a forward-looking estimate of what a repair *would* cost right now, zeroed on repair. It has never been money spent.
  - **Not `financial_ledger`.** `financial_ledger_active` defaults to `false`, so `repair_cost` entries may not exist at all. The ledger mirrors the truth; it is not the truth.
- **The four Repair_Figure_Stores**, each kept because each answers a different question:

  | Store | Location | Question it answers |
  |---|---|---|
  | Repair_Spend_Source | `audit_logs` `eventType: 'robot_repair'`, `creditsCharged` | What happened, per event |
  | Lifetime_Repair_Spend | `robots.lifetimeRepairCreditsPaid` | What has this robot cost in total |
  | Cached_Repair_Quote | `robots.repairQuoteCredits` | What would repairing it cost right now |
  | Cycle_Repair_Spend | `cycleRepairCreditsPaid` in the `stableMetrics` JSON of `cycle_snapshots` | What did repairs cost this stable this cycle |

- **One implementation of the arithmetic**: `calculateRepairQuote`, `applyManualRepairDiscount` and `calculateRepairBayDiscountPercent` in `app/shared/utils/repairCost.ts`. Never multiply a cost by `MANUAL_REPAIR_DISCOUNT` at a call site, and never re-apply a Repair_Bay_Discount to a quote that already carries it — that second application is the bug Spec #48 fixed, and it made every manual audit row record a fraction of what the player paid.
- **A batch manual repair is quoted per robot, discounted per robot, then summed** — in that order, on the charge, the lifetime increment, the audit rows and the ledger entries alike, so no two of them can disagree through two different roundings.
- **Manual repair audit figures written before Spec #48 are understated** and are not corrected retroactively, so the manual repair series has a discontinuity at the cycle that spec shipped. Do not read a step there as a balance change.

### Bye Reward Architecture (Spec #49)

- **Every bye reward *amount* comes from `calculateByeReward` — `resolveByeReward` in `app/backend/src/utils/byeRewards.ts` — and nowhere else.** Never call `calculateTagTeamRewards`, `calculateTeamBattleReward`, `calculateTagTeamPrestige`, `calculateTeamBattlePrestige`, `calculateTeamBattleFame` or `calculateTagTeamFame` from a bye path. Those are win-reward functions and a bye is not a win.
- **Every bye *record* comes from `resolveByeEvent` in `app/backend/src/services/battle/byeResolutionService.ts`.** It owns entity resolution too, so a caller passes the identity of the queued match and nothing else. There are exactly six call sites, one per orchestrator, and none of them holds bye logic. If you find yourself writing a per-mode bye adapter, that is the duplication this spec removed — an earlier draft had `resolvePlacementModeBye` written twice, once in each Placement_Mode orchestrator.
- **The Bye_Mode_Table is exhaustive by construction.** `BYE_MODE_SPECS: Record<ByeMode, ByeModeSpec>` declares each mode's floor, `teamSize`, `lpDelta`, `entitySource`, `standingMode` and `updatesElo`. A tenth battle mode fails to compile until its bye reward is declared — the same guarantee `EVENT_SCHEDULE_SCOPES` gives for schedule sources.
- **A bye simulates nothing, in any mode.** No `simulateBattle`, `simulateBattleMulti`, `simulateTeamBattle` or `simulateTagTeamBattle` on a bye path, and detection happens *before* the absent side is loaded or fabricated. It follows that a bye can never damage a robot, never produce a repair bill, and never draw — a drawn bye is structurally impossible rather than corrected afterwards.
  - Worth knowing why this is a rule and not a preference: `league_2v2`, `league_3v3` and `tag_team` byes used to simulate a full battle against weaponless Bye_Placeholders and then override the result. `getWeaponInfo` falls back to `{ name: 'Fists', baseDamage: 10 }` with no weapon, and the `!weaponLike` branch in `simulationLoop` skips the range check for an unarmed attacker — so two or three placeholders punched the real team for the full duration and the damage was persisted. **Players were billed to repair battles nobody fought.**
  - `byeRobot.ts` documented the correct invariant the whole time: the negative ids are "a sentinel that orchestrators use to detect bye matches and skip full simulation / stat updates". Two of its five consumers did the opposite, and nothing enforced it. Same shape as the repair-formula duplication above.
- **A Bye_Placeholder is a matchmaking and scheduling artefact only.** Nothing may rely on its combat attributes, weapons, HP or shields, because nothing reads them.
- **A bye pays credits only.** Zero prestige, zero fame, zero streaming revenue, in all nine modes.
- **The Bye_Award_Claim is claimed before payment, never after.** The queued-match row's own column is the idempotency token — `scheduled_matches_v2.status` for the six unified modes, `scheduled_tournament_matches.battleId` for the three tournament modes, because bracket advancement has already spent the status token by the time the reward is due. Pay-then-claim turns every crash and retry into a double payment, and both Placement_Mode orchestrators reset `error` rows back to `scheduled`, so that is a live duplication path rather than a hypothetical one. The chosen direction loses a reward on a crash instead of duplicating one, which is the right way round and is detectable: a completed queued row whose battle has no participant rows.
- **Auto-repair exempts no mode.** A Bye_Event is a scheduled match that resolves differently, not a match that does not exist, so a byed robot is repaired on the same rule as everyone else in that Battle_Slot. Never reintroduce an `isByeMatch` filter into `resolveRobotIdsForEvent` — the tournament arm carried one until Spec #49, which meant auto-repair depended on which mode the bye happened in.
- **A bye is counted as a bye, never as a fought match.** In every Cycle_Execution_Summary the counters partition `totalMatches`: fought and succeeded, fought and failed, or bye. Never increment `successfulMatches` for a Bye_Event — that figure means combat was simulated, and it is what an operator reads when diagnosing a cycle.
- **The Player_Guide is part of the change, not documentation of it.** `app/backend/src/content/guide/` is player-facing product content. A balance change that leaves a guide article contradicting the behaviour is not finished. Spec #49 fixed six wrong bye claims there, two of which were wrong in *opposite* directions at the same time — `leagues/matchmaking.md` promised "full rewards" for a bye that paid 0.20 × tier base, while `team-battles/overview.md` promised "reduced rewards" for one that paid full.
- **Balance discontinuities at the cycle Spec #49 shipped.** Three figures move, and two of them move in opposite directions for the same player, so read them together:
  - Team and tag team bye credits drop by a factor of 6 (`teamSize × (win + participation)` → `teamSize × participation`). A signed-off balance change.
  - Team and tag team bye repair spend drops to zero. A **defect fix**, not a balance change — see the Fists fallback above.
  - Tournament bye holders begin incurring pre-battle repair spend they did not before, a consequence of auto-repair no longer exempting tournaments.

### Shell Scripts (operations / deploy / cron)
- **Never `source .env` directly.** Bash interprets unquoted values as commands. With a line like `LEAGUE_SCHEDULE=0 20 * * *` in `.env`, `source` parses the assignment as `LEAGUE_SCHEDULE=0` and tries to execute `20 * * *` as a command, crashing the script with `20: command not found`. We've hit this bug twice (PR #332 in `preflight.sh`, PR #336 in `backup.sh`).
- **Use the `env_get` helper pattern instead.** Read keys as plain text via `grep + cut + sed`, never letting the shell evaluate values:

  ```bash
  env_get() {
    local key="$1"
    local file="$2"
    [ -f "$file" ] || return 0
    grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/'
  }

  ENV_FILE="/opt/armouredsouls/backend/.env"
  DB_USER="${POSTGRES_USER:-$(env_get POSTGRES_USER "$ENV_FILE")}"
  ```

  See `app/scripts/backup.sh` for the canonical implementation.
- **Cleanup before disk guard.** Any script that has both a "free up space" step and a "skip if disk full" guard must run the cleanup *before* the guard. Otherwise the script bails out before it can recover, leaving the disk-full state self-reinforcing — exactly what happened to ACC backups in May 2026.
- **`set -euo pipefail` at the top of every new script.** Fail-fast on errors, undefined variables, and broken pipelines.
- **In GitHub Actions, a pipe silently discards failures.** The default shell for a `run:` block is `bash -e {0}` — no `pipefail` — so in `cmd | tail` the step's exit code is `tail`'s, which is always 0. This hid 180 failing integration tests for months. Add `shell: bash` to any step that pipes (that maps to `bash --noprofile --norc -eo pipefail {0}`), or don't pipe.

### Error Handling
- Use the `AppError` hierarchy for all business logic errors in services
- Import domain-specific error classes from `src/errors/` (e.g., `AuthError`, `RobotError`, `BattleError`)
- Throw errors with appropriate error codes from the domain's enum (e.g., `AuthErrorCode.INVALID_CREDENTIALS`)
- Let errors propagate to the `errorHandler` middleware — do not catch and re-format in route handlers
- Express 5 automatically forwards rejected promises to error middleware
- See `docs/guides/ERROR_CODES.md` for the complete error code reference
- Standard error response shape: `{ error: string, code: string, details?: unknown }`
- Log errors with context but don't expose internal implementation details to clients

## Frontend Standards

### React Components
- Functional components with hooks
- Props interfaces defined for all components
- Keep components focused and reusable
- Use meaningful component names

### State Management
- Local state for component-specific data
- Zustand stores for data shared across 3+ pages (see `.kiro/steering/frontend-state-management.md`)
- Context for truly global, rarely-changing state (auth, onboarding, theme)
- Always use store selectors — never subscribe to the entire Zustand store
- Avoid prop drilling

### Styling
- Follow design system guidelines (see docs/design_ux/)
- Use consistent spacing and layout patterns
- Ensure responsive design
- Maintain accessibility standards

## Testing Requirements

### Mandatory Testing
- **Always write tests** for all new code and features
- **Minimum coverage**: 80% for general code, 90% for critical functionality
- **Critical functionality**: Combat, economy, matchmaking, leagues, auth, database operations
- **Run all tests** after completing development: `pnpm test`
- **Verify coverage**: `pnpm test -- --coverage`

### Test Standards
- Use descriptive test names following pattern: "should [expected behavior] when [condition]"
- Mock external dependencies (database, APIs)
- Keep tests fast and focused
- Write unit tests for individual functions
- Write integration tests for workflows
- Add regression tests for bug fixes
- Run with `--maxWorkers=1` if encountering parallel test conflicts
- Use `pnpm test -- --silent` in CI/CD pipelines to reduce output verbosity

### Before Committing
1. Run the test suite and verify all tests pass
2. Check coverage meets minimum thresholds
3. Fix any failing tests
4. Do not commit untested code

### Every test tier is mandatory and blocking

A check that cannot fail the build is not a check. All of these run on every push
and pull request, in both `ci.yml` and `deploy.yml`, and every one of them gates a
deploy:

| Gate | Command |
|---|---|
| Backend lint | `pnpm run lint` |
| Backend build (typechecks `src/`) | `pnpm run build` |
| Test suite typecheck | `pnpm run typecheck:tests` |
| Backend unit | `pnpm run test:unit` |
| Backend integration (real Postgres) | `pnpm run test:integration` |
| Backend heavy (full cycles) | `pnpm run test:heavy` |
| Frontend lint + build | `pnpm run lint`, `pnpm run build` |
| Frontend unit | `pnpm run test:ci` |
| E2E (Playwright) | `pnpm exec playwright test` |

Never re-introduce a bypass. The ones that were found and removed in July 2026:

- `pnpm run test:integration 2>&1 | tail -n 500 || true` in `deploy.yml` — swallowed
  twice over, and `deploy-acc` listed the job in `needs:` so the gate looked real.
- The same pipe without `|| true` in `ci.yml`. **A pipe alone is enough to swallow
  a failure**: GitHub's default shell is `bash -e {0}`, which has no `pipefail`, so
  the step's exit code is `tail`'s. Set `shell: bash` on any step that pipes.
- `pnpm run lint || true` on both lint steps in `deploy.yml`, so the pipeline that
  shipped code was the lenient one.
- `continue-on-error: true` plus `always()` on the E2E job in both workflows.
- Frontend unit tests missing from `deploy.yml` entirely.
- `test:heavy` running in no pipeline at all.
- `"test": "... unit; ... integration"` in package.json — `;` meant the reported
  exit code was only the integration run's. Now chained with `&&`.

If a suite is red, either the code is wrong or the test is wrong. Fix one of them.
Do not make the check advisory, and do not delete a test to make a build pass unless
the behaviour it covers is genuinely gone (say so explicitly if you do).

**Do not record a pass/fail snapshot here.** An earlier version of this section
claimed "All tiers are green: unit (205 suites, 2881 tests), frontend (1890
tests)". Test counts change on almost every commit, so a snapshot is stale within
days, and this one was worse than stale: it asserted every tier was green while
three backend suites were failing to load outright. A steering file is read as
authoritative, so a rotting fact in it is actively misleading — it cost real time
in Aug 2026 when it was trusted over a test run.

Run the suite to find out the current state. The rules above are the durable part;
the numbers are not a rule at all.

**Excluding a test is a change that needs a stated reason and an expiry.** If a
suite genuinely cannot run in a tier, `testPathIgnorePatterns` is the right tool,
but the entry must carry a comment saying *why* and what would allow it back. An
entry reading `// requires js-yaml 3 API (removed)` outlived its cause by months
and hid five real failures, three of them broken guide content. Prefer fixing the
dependency over excluding the test; if you must exclude, say what has to change.

## Documentation Requirements
- Document complex algorithms and business logic
- Include JSDoc comments for public APIs
- Update relevant PRD documents when changing features
- Keep README files current

## Security Practices

### Critical Security Rules
- **Never commit secrets** - Use .env files (gitignored)
- **Validate all inputs** - Never trust user input
- **Use parameterized queries** - Prevent SQL injection via Prisma
- **Hash passwords** - bcrypt with salt rounds 10-12
- **Secure JWT tokens** - Strong secrets, short expiration
- **HTTPS only** - Enforce in production (Caddy handles this)
- **Rate limiting** - Protect auth endpoints (10 req/15min login, 10 req/15min admin password reset, 300 req/min general per-IP, 100 req/min per-user economic, 3 req/hr account reset)
- Per-user economic limiter covers `/api/weapons`, `/api/weapon-inventory`, `/api/facilities`, `/api/robots`, `/api/subscriptions`. Put any endpoint a player hits repeatedly in one sitting on this limiter rather than the shared per-IP bucket, or players behind one NAT address will throttle each other
- **CORS configuration** - Whitelist specific origins only

### Authentication & Authorization
- JWT tokens with 24h expiration
- Bcrypt password hashing (10 rounds in dev, 12 in prod)
- Role-based access control (admin, user)
- Middleware for protected routes
- Token validation on every request

### Input Validation
- Validate at API boundary (Express middleware)
- Use Zod or Joi for schema validation
- Sanitize user-generated content
- Validate file uploads (type, size)
- Check for SQL injection patterns (Prisma handles this)

### Sensitive Data Handling
- Never log passwords or tokens
- Mask sensitive data in error messages
- Use environment variables for secrets
- Rotate secrets periodically
- Different secrets per environment

### OWASP Top 10 Compliance
See `docs/architecture/PRD_SECURITY.md` for comprehensive security strategy covering:
- Injection prevention
- Broken authentication
- Sensitive data exposure
- XML external entities (XXE)
- Broken access control
- Security misconfiguration
- Cross-site scripting (XSS)
- Insecure deserialization
- Using components with known vulnerabilities
- Insufficient logging and monitoring

### Zod Schema Validation (Required for All Routes)
- Every new route handler must have a Zod schema defined for its params, query, and/or body
- Use the `validateRequest` middleware from `src/middleware/schemaValidator.ts`
- Import reusable primitives from `src/utils/securityValidation.ts` (`safeName`, `safeSlug`, `positiveIntParam`, `safeImageUrl`, `orderByColumn`)
- Never write inline regex checks in route handlers — use the centralized primitives
- Zod's default `.strip()` mode removes unknown fields, preventing mass-assignment
- The `custom-routes/require-validate-request` ESLint rule enforces this automatically — any `router.get/post/put/delete/patch` call in `src/routes/` without `validateRequest` will fail lint

### Ownership Verification (Required for All Mutations)
- Every route that mutates a user-owned resource must verify ownership before the mutation
- Use helpers from `src/middleware/ownership.ts`: `verifyRobotOwnership`, `verifyWeaponOwnership`, `verifyFacilityOwnership`
- For transactional operations, call ownership helpers inside the transaction boundary (prevents TOCTOU races)
- Ownership failures return a generic `403 Access denied` — never reveal whether the resource exists

### lockUserForSpending (Required for Economic Endpoints)
- Every credit-spending endpoint (weapon purchase, facility upgrade, robot creation, attribute upgrade) must use `lockUserForSpending` from `src/lib/creditGuard.ts` inside a Prisma interactive transaction
- Re-read all mutable state (facility levels, roster counts, attribute levels) after acquiring the lock
- For multi-row serialization (team creation), use `pg_advisory_xact_lock` instead
- See `docs/architecture/PRD_SECURITY.md` → Security Playbook → Transaction Integrity Pattern for the full pattern

### Rate Limiting for Destructive Endpoints
- Heavy or destructive operations (account reset, bulk deletes) must have dedicated per-user rate limiters beyond the general API limiter
- Use `express-rate-limit` with `keyGenerator` based on `authReq.user.userId` to prevent abuse from authenticated sessions
- The rate limiter middleware must run AFTER `authenticateToken` so that `req.user` is populated for the `keyGenerator`
- Track violations via `securityMonitor.trackRateLimitViolation()` so they appear in the admin Security dashboard
- Example: account reset is limited to 3 req/hr per user (see `src/routes/onboarding.ts`)
- Example: admin password reset is limited to 10 req/15min per admin (see `src/routes/admin.ts`)

### Admin Endpoint Authorization Logging
- The `requireAdmin` middleware logs all unauthorized access attempts via `securityMonitor.logAuthorizationFailure()`
- These appear as `authorization_failure` events with resource type `admin_endpoint` in the Security dashboard
- Never reveal which admin endpoints exist in error messages — use the generic "Admin access required" response

### ESLint Security Rules (`eslint-plugin-security`)
- The backend ESLint config includes `eslint-plugin-security` with rules that flag `eval()`, dynamic `require()`, timing attacks, unsafe regex, and deprecated Buffer usage
- `error`-level rules (`detect-eval-with-expression`, `detect-no-csrf-before-method-override`, `detect-buffer-noassert`, `detect-new-buffer`) block CI
- Run `pnpm run lint` before committing to catch security anti-patterns

### Content Moderation Service Pattern
- The `ContentModerationService` is a singleton loaded once at application startup via `contentModerationService.initialize()` in `src/index.ts`
- If model loading fails, the service operates in fail-closed mode: all `classifyImage()` calls return `{ safe: false, reason: 'moderation_unavailable' }`, and the upload handler returns HTTP 503
- The service uses nsfwjs with TensorFlow.js CPU backend — no GPU required
- All TensorFlow tensors must be disposed after classification to prevent memory leaks
- Pattern: `const tensor = tf.node.decodeImage(buffer); try { ... } finally { tensor.dispose(); }`

### Upload Rate Limiter Pattern
- Per-user upload rate limiting uses `express-rate-limit` with `keyGenerator` based on `req.user.userId`
- The rate limiter middleware runs AFTER `authenticateToken` so that `req.user` is populated
- Violations are tracked via `securityMonitor.trackRateLimitViolation()` for admin dashboard visibility
- Configuration: 5 uploads per 10-minute window per user
- See `src/services/moderation/uploadRateLimiter.ts` for implementation

### PendingUploadCache Pattern
- In-memory `Map<string, PendingUploadEntry>` keyed by UUID confirmation token
- 5-minute TTL with automatic cleanup via `setInterval` every 60 seconds
- Per-user limit of 3 pending entries to prevent memory abuse (oldest evicted when exceeded)
- Used in the two-step upload flow: preview stores to cache, confirm retrieves and persists to disk
- See `src/services/moderation/pendingUploadCache.ts` for implementation

## Performance Considerations
- Optimize database queries (use EXPLAIN when needed)
- Implement pagination for large datasets
- Cache frequently accessed data when appropriate
- Monitor and log performance metrics
