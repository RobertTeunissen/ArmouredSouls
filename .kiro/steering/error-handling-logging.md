---
inclusion: fileMatch
fileMatchPattern: "**/backend/src/errors/**,**/backend/src/middleware/errorHandler.ts,**/backend/src/**/error*.ts,**/backend/src/**/logger*.ts,**/backend/src/services/security/**,**/frontend/src/**/ErrorBoundary*.tsx"
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
The security logger is implemented in `src/services/security/securityLogger.ts`, used by `SecurityMonitor`, and writes structured events to `logs/security.log` rather than the main application log or database. It retains the last 500 events for `GET /api/admin/security/events`.

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

Active event types are implementation contracts: `spending`, `rapid_spending`, `conflict`, `race_condition_attempt`, `authorization_failure`, `validation_failure`, `robot_creation`, `automated_robot_creation`, `rate_limit_violation`, `rate_limit_escalation`, `admin_password_reset`, and `admin_password_reset_pattern`. Preserve their names and payload semantics when changing security monitoring.

## Ownership
- Detailed route validation, ownership, spending locks, rate limits, moderation, and authorization policy are in `backend-security.md` and `docs/architecture/PRD_SECURITY.md`.
- Operational alerting and infrastructure thresholds belong in `monitoring-observability.md`, not this implementation contract.
