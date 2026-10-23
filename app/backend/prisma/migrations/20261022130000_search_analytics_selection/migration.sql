-- Search analytics: privacy-light selection tracking and the settled-search
-- report. Additive: three nullable/defaulted columns and one index. Existing
-- rows keep selection_tracked = false ("not tracked"), so they never count as
-- "opened nothing". Only a result CATEGORY is ever stored, never a result id,
-- label, position or route.
ALTER TABLE "search_analytics_events"
  ADD COLUMN "selection_tracked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "selected_category" VARCHAR(10),
  ADD COLUMN "selected_at" TIMESTAMP(3);

CREATE INDEX "search_analytics_events_season_number_user_id_event_timesta_idx"
  ON "search_analytics_events"("season_number", "user_id", "event_timestamp");
