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
- Game formulas shared between frontend and backend (upgrade costs, academy caps, discount calculations) must live in `app/shared/utils/` — never inline or locally redefine a formula that already exists there

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
- Run `npx prisma generate` after schema changes to regenerate the client
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
- **Run all tests** after completing development: `npm test`
- **Verify coverage**: `npm test -- --coverage`

### Test Standards
- Use descriptive test names following pattern: "should [expected behavior] when [condition]"
- Mock external dependencies (database, APIs)
- Keep tests fast and focused
- Write unit tests for individual functions
- Write integration tests for workflows
- Add regression tests for bug fixes
- Run with `--maxWorkers=1` if encountering parallel test conflicts
- Use `npm test -- --silent` in CI/CD pipelines to reduce output verbosity

### Before Committing
1. Run full test suite and verify all tests pass
2. Check coverage meets minimum thresholds
3. Fix any failing tests
4. Do not commit untested code

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
- **Rate limiting** - Protect auth endpoints (10 req/15min login, 300 req/min general, 60 req/min per-user economic, 3 req/hr account reset)
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
See `docs/guides/SECURITY.md` for comprehensive security strategy covering:
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
- See `docs/guides/SECURITY.md` → Security Playbook → Transaction Integrity Pattern for the full pattern

### Rate Limiting for Destructive Endpoints
- Heavy or destructive operations (account reset, bulk deletes) must have dedicated per-user rate limiters beyond the general API limiter
- Use `express-rate-limit` with `keyGenerator` based on `authReq.user.userId` to prevent abuse from authenticated sessions
- Track violations via `securityMonitor.trackRateLimitViolation()` so they appear in the admin Security dashboard
- Example: account reset is limited to 3 req/hr per user (see `src/routes/onboarding.ts`)

### Admin Endpoint Authorization Logging
- The `requireAdmin` middleware logs all unauthorized access attempts via `securityMonitor.logAuthorizationFailure()`
- These appear as `authorization_failure` events with resource type `admin_endpoint` in the Security dashboard
- Never reveal which admin endpoints exist in error messages — use the generic "Admin access required" response

### ESLint Security Rules (`eslint-plugin-security`)
- The backend ESLint config includes `eslint-plugin-security` with rules that flag `eval()`, dynamic `require()`, timing attacks, unsafe regex, and deprecated Buffer usage
- `error`-level rules (`detect-eval-with-expression`, `detect-no-csrf-before-method-override`, `detect-buffer-noassert`, `detect-new-buffer`) block CI
- Run `npm run lint` before committing to catch security anti-patterns

## Performance Considerations
- Optimize database queries (use EXPLAIN when needed)
- Implement pagination for large datasets
- Cache frequently accessed data when appropriate
- Monitor and log performance metrics
