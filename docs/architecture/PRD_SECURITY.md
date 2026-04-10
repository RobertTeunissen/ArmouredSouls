# Product Requirements Document: Security

**Project**: Armoured Souls  
**Document Type**: Product Requirements Document (PRD)  
**Version**: v2.0  
**Last Updated**: April 10, 2026  
**Status**: ✅ Implemented  
**Owner**: Robert Teunissen

**Revision History**:

v1.0 (Jan 24, 2026): Initial security strategy (aspirational)  
v2.0 (Apr 10, 2026): Complete rewrite — documents actual implemented security controls, removes aspirational content (GDPR, mobile security, WAF, VPC), adds Security Playbook from Specs 11/12

---

**Related Documents**:
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and risk register
- [ERROR_CODES.md](../guides/ERROR_CODES.md) — Error code reference
- [PRD_SERVICE_DIRECTORY.md](PRD_SERVICE_DIRECTORY.md) — Security service domain

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Authorization](#3-authorization)
4. [Input Validation](#4-input-validation)
5. [Rate Limiting](#5-rate-limiting)
6. [HTTP Security Headers](#6-http-security-headers)
7. [Transaction Integrity](#7-transaction-integrity)
8. [Security Monitoring](#8-security-monitoring)
9. [ESLint Security Rules](#9-eslint-security-rules)
10. [Dependency Scanning](#10-dependency-scanning)
11. [Security Playbook](#11-security-playbook)

---

## 1. Overview

Security is enforced at multiple layers: input validation at the API boundary (Zod), authentication via JWT, authorization via role checks and ownership verification, transaction integrity via row-level locking, and monitoring via the SecurityMonitor singleton.

**Key source files**:
- Middleware: `src/middleware/auth.ts`, `schemaValidator.ts`, `rateLimiter.ts`, `userRateLimiter.ts`, `ownership.ts`
- Services: `src/services/auth/` (JWT, password, user), `src/services/security/` (monitor, logger)
- Utilities: `src/utils/securityValidation.ts` (Zod primitives), `src/lib/creditGuard.ts` (spending lock)

---

## 2. Authentication

### JWT Tokens
- **Library**: `jsonwebtoken`
- **Expiration**: Configurable via `JWT_EXPIRATION` env var (default: `24h`)
- **Secret**: `JWT_SECRET` env var (required in production, falls back to dev default locally)
- **Payload**: `{ userId, username, role, tokenVersion }`
- **Token version**: Incremented on password change to invalidate all existing tokens

### Password Hashing
- **Library**: `bcrypt`
- **Salt rounds**: Configurable via `BCRYPT_SALT_ROUNDS` (default: 10, valid: 4–31)
- **Registration**: Lenient rules (8–128 chars, any characters)
- **Password change**: Stricter rules (requires uppercase, lowercase, number)

### Middleware
- `authenticateToken` — Validates JWT on every protected route, attaches `user` to request
- Token version check — Rejects tokens issued before the user's last password change

---

## 3. Authorization

### Role-Based Access Control
Two roles: `user` and `admin`.

- `requireAdmin` middleware — Returns generic "Admin access required" (never reveals which admin endpoints exist)
- All unauthorized admin access attempts logged via `securityMonitor.logAuthorizationFailure()`

### Ownership Verification
Every mutation on a user-owned resource verifies ownership before proceeding:

- `verifyRobotOwnership(tx, robotId, userId)` — 403 on mismatch
- `verifyWeaponOwnership(tx, inventoryId, userId)` — 403 on mismatch
- `verifyFacilityOwnership(tx, facilityId, userId)` — 403 on mismatch

Ownership checks run inside transaction boundaries to prevent TOCTOU races. Failures return generic "Access denied" — never reveal whether the resource exists.

---

## 4. Input Validation

### Zod Schema Validation
Every route handler uses `validateRequest` middleware with Zod schemas. The `custom-routes/require-validate-request` ESLint rule enforces 100% coverage — any route without `validateRequest` fails lint.

Zod's default `.strip()` mode removes unknown fields, preventing mass-assignment.

### Centralized Primitives (`securityValidation.ts`)

| Primitive | Pattern | Used For |
|-----------|---------|----------|
| `safeName` | `/^[a-zA-Z0-9 _\-'.!]+$/`, 1–50 chars | Robot names, stable names |
| `safeSlug` | `/^[a-zA-Z0-9_-]+$/`, 1–100 chars | URL slugs (no `..`, `/`, `%2e`) |
| `positiveInt` | Coerced positive integer | ID parameters |
| `positiveIntParam` | String → validated → number | Route params (`:id`) |
| `safeImageUrl` | HTTPS only, no `..` in path | Robot portrait URLs |
| `orderByColumn(allowed, default)` | Allowlist factory | ORDER BY columns (prevents SQL injection) |
| `safeEnum(values)` | Strict enum | Loadout types, stances, etc. |
| `paginationQuery` | `{ page, limit }` with max 100 | Paginated endpoints |

---

## 5. Rate Limiting

### IP-Based Limiters

| Limiter | Window | Max Requests | Scope |
|---------|--------|-------------|-------|
| General API | 60s | 300 | All `/api/*` routes |
| Auth (register) | 60s | 30 | `/api/auth/register` |
| Login | 15 min | 10 | `/api/auth/login` |

### User-Based Limiters

| Limiter | Window | Max Requests | Key | Scope |
|---------|--------|-------------|-----|-------|
| Economic | 1 min | 60 | `userId` | Weapon purchase, facility upgrade, robot creation, attribute upgrade |
| Account reset | 1 hour | 3 | `userId` | `/api/onboarding/reset-account` and `/api/onboarding/reset-eligibility` |
| Practice Arena | 15 min | 30 battles | `userId` | `/api/practice-arena/battle` |
| Admin password reset | 15 min | 10 | `userId` | `POST /api/admin/users/:id/reset-password` |

All rate limit violations tracked by `SecurityMonitor`. Repeated violations (>5 in 1 hour on economic endpoints) trigger a `rate_limit_escalation` security event visible in the admin Security Dashboard.

---

## 6. HTTP Security Headers

Helmet.js configured with explicit directives:

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

Mitigates: XSS, clickjacking, MIME sniffing, protocol downgrade.

---

## 7. Transaction Integrity

### lockUserForSpending Pattern

All credit-spending endpoints use `lockUserForSpending` inside a Prisma interactive transaction:

```typescript
const result = await prisma.$transaction(async (tx) => {
  const user = await lockUserForSpending(tx, userId);
  // Re-read all mutable state INSIDE the transaction
  // Validate against re-read values
  // Perform mutation
});
```

This prevents race conditions where concurrent requests read stale balances.

### Multi-Row Serialization

For operations that span multiple rows (team creation), use `pg_advisory_xact_lock`:

```typescript
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
```

---

## 8. Security Monitoring

### SecurityMonitor Singleton

Tracks and logs security events in real-time:

- Rate limit violations (per user, per endpoint)
- Authorization failures (admin endpoint probing)
- Spending anomalies
- Validation failures (rejected input)

### Admin Security Dashboard (Spec 12)

Accessible at `/admin` → Security tab. Shows:
- Rate limit violation history
- Authorization failure log
- Spending tracking
- Security event timeline

### Logging

- `securityLogger` — Dedicated security log file (`logs/security.log`)
- `securityMonitor.logAuthorizationFailure()` — Admin access attempts
- `securityMonitor.trackRateLimitViolation()` — Rate limit hits
- `securityMonitor.trackSpending()` — Economic transaction tracking

---

## 9. ESLint Security Rules

`eslint-plugin-security` in the backend ESLint config:

| Rule | Level | Catches |
|------|-------|---------|
| `detect-eval-with-expression` | error | `eval()` with dynamic input |
| `detect-no-csrf-before-method-override` | error | CSRF middleware ordering |
| `detect-buffer-noassert` | error | Buffer reads without bounds checking |
| `detect-new-buffer` | error | Deprecated `new Buffer()` |
| `detect-non-literal-require` | warn | Dynamic `require()` calls |
| `detect-possible-timing-attacks` | warn | Non-constant-time comparisons |
| `detect-non-literal-regexp` | warn | User input in RegExp |
| `detect-unsafe-regex` | warn | ReDoS-vulnerable patterns |
| `detect-child-process` | warn | Child process execution |
| `detect-pseudoRandomBytes` | warn | Non-cryptographic random |

`error`-level rules block CI. Run `npm run lint` to check.

---

## 10. Dependency Scanning

### CI/CD Integration

The `security-audit` job in `.github/workflows/ci.yml`:
- `npm audit --audit-level=high` — fails build on high/critical vulnerabilities
- JSON report uploaded as build artifact
- Runs on every push and PR

### Vulnerability Allowlist

When a vulnerability can't be immediately fixed, document it in `.security-audit-allowlist.json`:

```json
{
  "allowlist": [{
    "id": "GHSA-xxxx-xxxx-xxxx",
    "package": "affected-package",
    "justification": "Only used in development",
    "reviewDate": "2026-03-01",
    "nextReviewDate": "2026-06-01"
  }]
}
```

CI skips matching advisories. Review all entries on their `nextReviewDate`.

---

## 11. Security Playbook — Known Exploit Patterns

Every new endpoint must be reviewed against this list.

### Race Condition on Balance Checks
**Exploit**: Concurrent requests bypass balance validation.  
**Prevention**: `lockUserForSpending` in Prisma transaction. Re-read all mutable state inside transaction.

### Stored XSS via Name Fields
**Exploit**: `<script>` tags in robot/stable names.  
**Prevention**: `safeName` Zod primitive (character allowlist).

### Path Traversal via Slug Parameters
**Exploit**: `../` or `%2e` in URL slugs.  
**Prevention**: `safeSlug` Zod primitive (alphanumeric + underscore + hyphen only).

### Attribute Upgrade Race Condition
**Exploit**: Concurrent upgrades bypass academy caps.  
**Prevention**: Re-read robot attributes inside transaction after acquiring lock.

### Team Creation Race Condition
**Exploit**: Concurrent team creation for same robots.  
**Prevention**: `pg_advisory_xact_lock` for multi-row serialization.

### Duplicate Weapon Equip
**Exploit**: Concurrent equip assigns same weapon to multiple robots.  
**Prevention**: Atomic `updateMany` with WHERE clause including current state, inside transaction.

### Robot imageUrl Protocol Injection
**Exploit**: `javascript:`, `data:`, or `../` in image URLs.  
**Prevention**: `safeImageUrl` Zod primitive (HTTPS only, no `..`).

### SQL ORDER BY Column Injection
**Exploit**: User-supplied column names in ORDER BY.  
**Prevention**: `orderByColumn` factory with predefined allowlist.

### Account Reset DDoS
**Exploit**: Spamming reset endpoint (heavy DB operations).  
**Prevention**: Dedicated rate limiter (3/hour per user), tracked by SecurityMonitor.

### Unauthorized Admin API Access
**Exploit**: Non-admin users probing admin endpoints.  
**Prevention**: `requireAdmin` middleware, generic error message, all attempts logged.

### Admin Password Reset Abuse
**Exploit**: Compromised admin mass-resets passwords across many user accounts.  
**Prevention**: Per-admin rate limit (10 requests per 15 minutes), audit trail via `AuditLog` with `eventType: "admin_password_reset"`, `tokenVersion` invalidation on every reset, all attempts (success and failure) logged via `SecurityMonitor`.
