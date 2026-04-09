-- Prevent currency from going negative via database-level constraint.
-- This is a safety net in addition to application-level row locking.
-- The only exception is the repair endpoint (handled by allowing negative in app logic),
-- and the cycle scheduler operating costs (system-level deductions).
-- We use a CHECK constraint that prevents direct writes below a floor of -10,000,000
-- to allow operating costs to push slightly negative while blocking exploit-level abuse.

ALTER TABLE "users" ADD CONSTRAINT "users_currency_floor"
  CHECK (currency >= -10000000);
