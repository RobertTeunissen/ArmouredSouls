-- Rename event types for naming consistency (idempotent)
-- league → league_1v1, tournament → tournament_1v1

-- Subscriptions table: event_type column
UPDATE "subscriptions" SET "event_type" = 'league_1v1' WHERE "event_type" = 'league';
UPDATE "subscriptions" SET "event_type" = 'tournament_1v1' WHERE "event_type" = 'tournament';

-- Battles table: battle_type column
UPDATE "battles" SET "battle_type" = 'league_1v1' WHERE "battle_type" = 'league';
UPDATE "battles" SET "battle_type" = 'tournament_1v1' WHERE "battle_type" = 'tournament';
