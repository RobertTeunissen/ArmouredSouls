-- CreateTable
CREATE TABLE "search_analytics_failures" (
    "id" BIGSERIAL NOT NULL,
    "season_number" INTEGER NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "first_failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_analytics_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_analytics_failures_season_number_cycle_number_key" ON "search_analytics_failures"("season_number", "cycle_number");

-- CreateIndex
CREATE INDEX "search_analytics_failures_season_number_cycle_number_idx" ON "search_analytics_failures"("season_number", "cycle_number");
