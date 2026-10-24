-- Persistent Practice Arena usage for the admin Practice Arena page. Additive:
-- one new table, no existing data touched. Replaces the in-memory counters that
-- were lost on every restart; `practice_arena_daily_stats` is no longer written.
CREATE TABLE "practice_arena_events" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" VARCHAR(16) NOT NULL,
    "requested" INTEGER NOT NULL,
    "battles" INTEGER NOT NULL,
    "matchup" VARCHAR(24),
    "bot_tier" VARCHAR(16),
    "overrides" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "practice_arena_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "practice_arena_events_occurred_at_idx" ON "practice_arena_events"("occurred_at");

CREATE INDEX "practice_arena_events_user_id_occurred_at_idx" ON "practice_arena_events"("user_id", "occurred_at");
