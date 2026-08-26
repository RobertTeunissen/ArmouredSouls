-- Spec #48 Requirement 17 criteria 1, 2 and 7.
--
-- Rename two repair columns on `robots` so each says what it holds. Column RENAMES,
-- not add-and-keep: criterion 7 forbids leaving the originals in place, and a rename
-- carries every existing value across untouched (criterion 14), so no data migration
-- or backfill is needed.
--
--   repair_cost        -> repair_quote_credits
--       A cached quote for money NOT YET SPENT. The old name read as money paid.
--       Both repair paths recompute from attributes and ignore this column, so there
--       is no compatibility window to manage.
--
--   total_repairs_paid -> lifetime_repair_credits_paid
--       Lifetime credits actually charged for this robot.
--
-- `robots` is a small table and these are metadata-only operations in PostgreSQL, so
-- the ACCESS EXCLUSIVE lock each statement takes is held for microseconds.

ALTER TABLE "robots" RENAME COLUMN "repair_cost" TO "repair_quote_credits";
ALTER TABLE "robots" RENAME COLUMN "total_repairs_paid" TO "lifetime_repair_credits_paid";
