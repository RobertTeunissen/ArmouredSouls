# Design Document: Zod Validation Gap Closure

## Overview

Add `validateRequest` middleware with Zod schemas to all 69 route handlers currently missing input validation across 21 route files. Schemas reuse existing security primitives and introduce a shared pagination query schema for the many admin and list endpoints that accept `page`, `limit`, and `search` parameters.

### Key Research Findings

- The `validateRequest` middleware from `src/middleware/schemaValidator.ts` already supports `{ params, query, body }` validation and uses Zod's `.strip()` to remove unknown fields.
- `src/utils/securityValidation.ts` already exports `safeName`, `safeSlug`, `positiveIntParam`, `safeImageUrl`, and `orderByColumn`.
- Many admin and list routes accept the same pagination pattern (`page`, `limit`, `search`) — a shared schema avoids duplication.
- Admin routes are behind `requireAdmin` middleware, but validation is still needed to prevent malformed input from reaching service logic and to comply with coding standards.
- Spec 15 (route handler extraction) restructured admin.ts, robots.ts, analytics.ts, and matches.ts — handlers are now thin wrappers calling service functions, but still lack validation middleware.
- The current gap is 69 handlers across 21 files (111 total handlers, 42 already validated).

### Current Validation Gap by File

| File | Unvalidated | Total | Notes |
|------|-------------|-------|-------|
| admin.ts | 22 | 23 | Largest gap; pagination + body + param schemas needed |
| finances.ts | 6 | 7 | Query schemas for date ranges and pagination |
| analytics.ts | 6 | 15 | Query schemas for filtering and pagination |
| onboarding.ts | 6 | 6 | Body schemas for step completion, reset |
| adminTournaments.ts | 3 | 5 | Body + query schemas |
| leaderboards.ts | 3 | 3 | Query schemas for pagination/filtering |
| robots.ts | 3 | 17 | Query schemas for listing, empty for repair-all |
| matches.ts | 2 | 3 | Query schemas for history/upcoming |
| practiceArena.ts | 2 | 2 | Body + query schemas |
| onboardingAnalytics.ts | 2 | 2 | Body + query schemas |
| user.ts | 2 | 3 | Empty/minimal schemas for profile, stats |
| weaponInventory.ts | 2 | 4 | Query schemas for listing, storage status |
| guide.ts | 2 | 3 | Query schemas for sections, search-index |
| auth.ts | 1 | 3 | Empty schema for logout |
| facility.ts | 1 | 2 | Empty/query schema for facility list |
| stables.ts | 1 | 1 | Param schema for stable view |
| tagTeams.ts | 1 | 5 | Query schema for team listing |
| tournaments.ts | 1 | 2 | Query schema for tournament listing |
| weapons.ts | 1 | 1 | Empty/query schema for weapon list |
| koth.ts | 1 | 1 | Query schema for standings |
| records.ts | 1 | 1 | Query schema for records filtering |

## Architecture

### Shared Schemas

Add to `src/utils/securityValidation.ts`:

```typescript
/** Reusable pagination query schema for list endpoints */
export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(200).optional(),
});
```

### Per-Route Schemas

Each route file defines its endpoint-specific schemas at the top of the file (following the existing pattern in validated routes like `auth.ts`, `tagTeams.ts`, etc.):

```typescript
// In admin.ts
const bulkCyclesBodySchema = z.object({
  count: z.number().int().positive().max(100),
});

const battleIdParamsSchema = z.object({
  id: positiveIntParam,
});
```

### Validation Middleware Application

Every route handler gets `validateRequest` added to its middleware chain:

```typescript
// Before
router.post('/matchmaking/run', authenticateToken, requireAdmin, async (req, res) => { ... });

// After
router.post('/matchmaking/run', authenticateToken, requireAdmin, validateRequest({ body: matchmakingBodySchema }), async (req, res) => { ... });
```

For GET endpoints with no params or query, use an empty schema to still strip unknown fields:

```typescript
router.get('/scheduler/status', authenticateToken, requireAdmin, validateRequest({}), async (req, res) => { ... });
```

## Components and Interfaces

### New Schemas by Route File

**admin.ts** (22 schemas needed):
- Pagination query for list endpoints (battles, users, audit-log, security/events)
- Body schemas for mutation endpoints (matchmaking/run, battles/run, leagues/rebalance, cycles/bulk, snapshots/backfill, etc.)
- Empty schemas for no-input endpoints (scheduler/status, koth/trigger, practice-arena/stats, security/summary, recalculate-hp, repair/all, daily-finances/process)

**finances.ts** (6 schemas needed):
- Query schemas for date range filtering (daily), pagination, and empty schemas for summary endpoints

**analytics.ts** (6 schemas needed):
- Query schemas for leaderboard pagination, performance filtering
- Empty schemas for cycle/current, stats/refresh, integrity, logs/summary

**onboarding.ts** (6 schemas needed):
- Body schemas for complete, skip, reset-account
- Empty/minimal schemas for state, reset-eligibility, analytics

**adminTournaments.ts** (3 schemas needed):
- Body schema for tournament creation
- Query schemas for listing and eligible-robots

**leaderboards.ts** (3 schemas needed):
- Query schemas for pagination/filtering on fame, losses, prestige

**robots.ts** (3 schemas needed):
- Query schemas for /all/robots and / listing endpoints
- Empty schema for /repair-all

**matches.ts** (2 schemas needed):
- Query schemas for /upcoming and /history

**practiceArena.ts** (2 schemas needed):
- Body/query schemas for practice battle endpoints

**onboardingAnalytics.ts** (2 schemas needed):
- Body schema for tracking, query schema for summary

**user.ts** (2 schemas needed):
- Empty schemas for /profile and /stats

**weaponInventory.ts** (2 schemas needed):
- Query schemas for inventory listing and storage-status

**guide.ts** (2 schemas needed):
- Query schemas for /sections and /search-index

**Single-handler files** (1 schema each for auth, facility, stables, tagTeams, tournaments, weapons, koth, records — 8 schemas):
- Empty or query schemas as appropriate per endpoint

## Data Models

No data model changes.

## Enforcement: Custom ESLint Rule

To prevent regression (new routes added without `validateRequest`), add a custom ESLint rule to the backend that flags any `router.get/post/put/delete` call whose middleware chain does not include `validateRequest`.

### Rule Design

Create a local ESLint plugin at `app/backend/eslint-rules/require-validate-request.js`:

```javascript
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require validateRequest middleware on all route handlers',
    },
    messages: {
      missingValidation: 'Route handler "{{method}} {{path}}" is missing validateRequest middleware. All route handlers must use validateRequest() for Zod schema validation.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Match router.get(), router.post(), router.put(), router.delete()
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'router' &&
          ['get', 'post', 'put', 'delete', 'patch'].includes(node.callee.property.name)
        ) {
          const sourceCode = context.getSourceCode();
          const text = sourceCode.getText(node);
          if (!text.includes('validateRequest')) {
            const method = node.callee.property.name.toUpperCase();
            const path = node.arguments[0]?.value || '(dynamic)';
            context.report({
              node,
              messageId: 'missingValidation',
              data: { method, path },
            });
          }
        }
      },
    };
  },
};
```

### ESLint Config Integration

Add the custom rule to `app/backend/eslint.config.mjs`:

```javascript
import requireValidateRequest from './eslint-rules/require-validate-request.js';

// In the rules config, add:
{
  files: ['src/routes/**/*.ts'],
  plugins: {
    'custom-routes': {
      rules: {
        'require-validate-request': requireValidateRequest,
      },
    },
  },
  rules: {
    'custom-routes/require-validate-request': 'error',
  },
}
```

This ensures:
- Any new route handler without `validateRequest` fails lint at dev time
- CI lint step catches it before merge
- No static documentation note needed — the rule IS the enforcement

## Documentation Impact

- `.kiro/steering/coding-standards.md` — The "Zod Schema Validation" section already documents the requirement. Add a note that the `custom-routes/require-validate-request` ESLint rule enforces this automatically.
- `docs/guides/SECURITY.md` — Add a note about the ESLint rule enforcing 100% route validation coverage.

## Testing Strategy

### Approach
- Existing backend tests serve as regression safety net.
- Add targeted tests for new validation schemas: verify that invalid input is rejected with 400 status and valid input passes through.
- Test edge cases: missing optional fields, boundary values for pagination limits, string length limits.

### Verification
- Run full backend test suite after each batch of route files is updated.
- Run the grep-based verification criteria to confirm 100% coverage.
