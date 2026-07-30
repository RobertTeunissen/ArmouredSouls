-- Subscriptions have one state, not two.
--
-- The column was documented as "active" or "pending", with the matchmaker
-- promoting pending rows once a slot opened. Nothing ever wrote 'pending':
-- subscribeRobot has always created rows as 'active', so the promotion code was
-- unreachable and the default was a trap for any future insert that omitted the
-- column. Align the default with what the application actually does and fix any
-- row that slipped through with the old default.

UPDATE "subscriptions" SET "status" = 'active' WHERE "status" <> 'active';

ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT 'active';
