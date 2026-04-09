# Module Contract: @armoured-souls/api

## Purpose

HTTP layer — Express application, route definitions, middleware (rate limiting, request logging, error handling, schema validation, ownership verification), admin services, notification integrations, and security monitoring.

## Dependencies

- `@armoured-souls/auth` — Authentication middleware, user management
- `@armoured-souls/game-engine` — All game logic services
- `@armoured-souls/database` — Prisma client for direct queries in routes

## Exported Public API

### Express Application

```typescript
// Fully configured Express app with all routes and middleware
export { app } from './index';
export { startServer } from './index';
```

### Route Modules

```typescript
// All route files — mounted on the Express app
export { adminRouter } from './routes/admin';
export { authRouter } from './routes/auth';
export { robotsRouter } from './routes/robots';
export { matchesRouter } from './routes/matches';
export { leaguesRouter } from './routes/leagues';
export { facilitiesRouter } from './routes/facility';
export { financesRouter } from './routes/finances';
export { weaponsRouter } from './routes/weapons';
export { weaponInventoryRouter } from './routes/weaponInventory';
export { tournamentsRouter } from './routes/tournaments';
export { tagTeamsRouter } from './routes/tagTeams';
export { analyticsRouter } from './routes/analytics';
export { onboardingRouter } from './routes/onboarding';
export { leaderboardsRouter } from './routes/leaderboards';
export { recordsRouter } from './routes/records';
export { kothRouter } from './routes/koth';
export { practiceArenaRouter } from './routes/practiceArena';
export { stablesRouter } from './routes/stables';
export { guideRouter } from './routes/guide';
export { userRouter } from './routes/user';
```

### Middleware

```typescript
export { errorHandler } from './middleware/errorHandler';
export { rateLimiter, userRateLimiter } from './middleware/rateLimiter';
export { requestLogger } from './middleware/requestLogger';
export { validateRequest } from './middleware/schemaValidator';
export { verifyRobotOwnership, verifyWeaponOwnership, verifyFacilityOwnership } from './middleware/ownership';
```

### Admin Services (Route-Adjacent)

```typescript
export { adminBattleService } from './services/admin/adminBattleService';
export { adminCycleService } from './services/admin/adminCycleService';
export { adminMaintenanceService } from './services/admin/adminMaintenanceService';
export { adminStatsService } from './services/admin/adminStatsService';
```

### Security

```typescript
export { securityMonitor } from './services/security/securityMonitor';
export { securityLogger } from './services/security/securityLogger';
```

### Notifications

```typescript
export { notificationService } from './services/notifications/notification-service';
export { discordIntegration } from './services/notifications/discord-integration';
```

### Content Serving

```typescript
export { guideService } from './services/common/guide-service';
export { markdownParser } from './services/common/markdown-parser';
```

### Validation Primitives

```typescript
export { safeName, safeSlug, positiveIntParam, safeImageUrl, orderByColumn, paginationQuery } from './utils/securityValidation';
```

## Internal Implementation (Not Exported)

- Route-specific Zod schemas (defined at top of each route file)
- Admin tournament routes (`adminTournaments.ts`)
- Onboarding analytics routes (`onboardingAnalytics.ts`)
- Records query builder (`records-queries.ts`)
- Credit guard (`lib/creditGuard.ts`)
- Logger configuration (`config/logger.ts`)
- Facility configuration (`config/facilities.ts`)

## Current Source Location

| Target | Current Location |
|--------|-----------------|
| Express app | `prototype/backend/src/index.ts` |
| Routes (23 files) | `prototype/backend/src/routes/` |
| Error handler | `prototype/backend/src/middleware/errorHandler.ts` |
| Rate limiter | `prototype/backend/src/middleware/rateLimiter.ts` |
| Schema validator | `prototype/backend/src/middleware/schemaValidator.ts` |
| Ownership | `prototype/backend/src/middleware/ownership.ts` |
| Request logger | `prototype/backend/src/middleware/requestLogger.ts` |
| Admin services | `prototype/backend/src/services/admin/` (4 files) |
| Security | `prototype/backend/src/services/security/` (2 files) |
| Notifications | `prototype/backend/src/services/notifications/` (3 files) |
| Guide/markdown | `prototype/backend/src/services/common/guide-service.ts`, `markdown-parser.ts` |
| Validation | `prototype/backend/src/utils/securityValidation.ts` |

## External Package Dependencies

- `express` (v5) — HTTP framework
- `cors` — Cross-origin resource sharing
- `helmet` — HTTP security headers
- `express-rate-limit` — Rate limiting
- `zod` — Schema validation
- `winston` — Logging
- `pm2` — Process management (production)
