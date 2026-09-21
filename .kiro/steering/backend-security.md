---
inclusion: fileMatch
fileMatchPattern: "**/backend/src/routes/**,**/backend/src/middleware/**,**/backend/src/auth/**,**/backend/src/services/moderation/**,**/backend/src/lib/creditGuard.ts,**/*security*"
---

# Backend Security Rules

- Every route has Zod validation through `validateRequest`; use primitives from `src/utils/securityValidation.ts`. Zod messages must identify their own field, never reflect submitted values, and unknown fields must be stripped.
- Every mutation of a user-owned resource verifies ownership. For transactional mutations, perform the ownership check inside the transaction. Return generic `403 Access denied` on failure.
- Economic endpoints use `lockUserForSpending` inside an interactive transaction, then re-read mutable state. Team creation uses `pg_advisory_xact_lock` where required.
- Put authenticated per-user rate limiting after authentication; use the authenticated user id as the key and record violations with `securityMonitor`. Destructive endpoints need dedicated limits.
- `requireAdmin` logs authorization failures and returns only the generic admin-access response.
- Business failures use domain `AppError` classes and codes. Let errors reach `errorHandler`; never leak internals.
- Never log secrets, tokens, passwords, or sensitive payloads. Validate uploads and use the moderation service’s fail-closed behavior; always dispose TensorFlow tensors.
- Keep the security contract in `docs/architecture/PRD_SECURITY.md`; this file contains implementation reminders only.
