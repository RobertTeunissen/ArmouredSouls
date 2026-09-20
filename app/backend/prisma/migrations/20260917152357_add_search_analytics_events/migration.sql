-- CreateTable
CREATE TABLE "search_analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "season_number" INTEGER NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "normalized_phrase" VARCHAR(100) NOT NULL,
    "robot_result_count" INTEGER NOT NULL,
    "stable_result_count" INTEGER NOT NULL,
    "guide_result_count" INTEGER NOT NULL,
    "total_result_count" INTEGER NOT NULL,
    "no_result" BOOLEAN NOT NULL,

    CONSTRAINT "search_analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_analytics_events_season_number_cycle_number_idx" ON "search_analytics_events"("season_number", "cycle_number");

-- CreateIndex
CREATE INDEX "search_analytics_events_season_number_event_timestamp_idx" ON "search_analytics_events"("season_number", "event_timestamp");

-- CreateIndex
CREATE INDEX "search_analytics_events_season_number_user_id_idx" ON "search_analytics_events"("season_number", "user_id");

-- CreateIndex
CREATE INDEX "search_analytics_events_season_number_normalized_phrase_idx" ON "search_analytics_events"("season_number", "normalized_phrase");

-- AddForeignKey
ALTER TABLE "search_analytics_events" ADD CONSTRAINT "search_analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
