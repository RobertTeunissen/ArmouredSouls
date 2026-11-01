---
inclusion: auto
name: error-handling-logging
description: "Error contract, AppError hierarchy, error codes, and logging/security-logging rules. Use when adding errors, error handling, or logging."
---

# Error Handling and Logging Standards

## Error contract
- User/input/auth/authorization/not-found/business-rule failures are 4xx; infrastructure, dependency, configuration, and unexpected failures are 5xx.
- API errors use `{ error: string, code: string, details?: unknown }`.
- Backend business failures extend the domain `AppError` hierarchy and use domain error codes. The complete code catalogue is `docs/guides/ERROR_CODES.md`.
- Express 5 forwards rejected async handlers. Services throw; routes do not catch and reformat. `errorHandler` maps known application/Prisma failures and returns a generic `INTERNAL_ERROR` for unknown failures.
- Never expose stack traces, database details, secrets, tokens, passwords, submitted values, or cross-user information. Frontend uses `ApiError.code` and safe `details` to choose user-facing states.
- React error boundaries handle render failures and provide a recoverable fallback; they do not replace API or service error handling.

## Logging contract
- Use structured logs with timestamp, level, message, service/environment, safe context, and error details where appropriate.
- Log authentication/authorization outcomes, database and external-service failures, unhandled exceptions, critical business operations, configuration changes, deployments, and performance anomalies.
- Never log passwords, hashes, JWTs, API keys, secrets, payment data, personal identification numbers, or unrestricted request/response bodies. Debug payloads and detailed traces are development-only.
- Use the project logger rather than `console.log`; choose levels consistently: debug (development), info (normal significant flow), warn (recoverable/anomalous), error (failed operation), fatal (cannot continue).
- Do not add generic retry/circuit-breaker behavior around financial or non-idempotent mutations. Retries require an explicit idempotency policy.

## Security logging channel
The security logger is implemented in `src/services/security/securityLogger.ts`, used by `SecurityMonitor`, and writes structured events to `logs/security.log` rather than the main application log. Security signals are also stored in `security_events` (90 days) through `securityEventStore`, which the admin Security page reads; writes are fire-and-forget.

```typescript
interface SecurityEvent {
  severity: 'info' | 'warning' | 'critical';
  eventType: string;
  userId?: number;
  sourceIp?: string;
  endpoint?: string;
  details: Record<string, unknown>;
  timestamp: string;
}
```

Stored signal types (`SECURITY_SIGNALS` in `src/types/securityTypes.ts`) are implementation contracts: `failed_login`, `rate_limit`, `ownership_violation`, `race_condition_burst`, `robot_creation_burst`, and `malformed_request` (no logged-in user). Log-only types: `validation_failure` (logged-in player) and the image moderation outcomes. Preserve their names and payload semantics when changing security monitoring; never store submitted login names or passwords. Admin page views and spending are not security events.

## Ownership
- Detailed route validation, ownership, spending locks, rate limits, moderation, and authorization policy are in `backend-security.md` and `docs/architecture/PRD_SECURITY.md`.
- Operational alerting and infrastructure thresholds belong in `monitoring-observability.md`, not this implementation contract.
