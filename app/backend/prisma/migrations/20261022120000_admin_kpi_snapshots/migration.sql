-- Admin dashboard: human-player activity counts captured once per competitive
-- settlement, so "vs previous 7 days" trends can be shown. users.last_login_at
-- only holds the latest login, so these counts cannot be reconstructed later.
-- Additive: a new table, no change to existing data.
CREATE TABLE "admin_kpi_snapshots" (
    "id" SERIAL NOT NULL,
    "season_number" INTEGER NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "human_players" INTEGER NOT NULL,
    "active_players_7d" INTEGER NOT NULL,
    "inactive_players_3d" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_kpi_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_kpi_snapshots_season_number_cycle_number_key" ON "admin_kpi_snapshots"("season_number", "cycle_number");

CREATE INDEX "admin_kpi_snapshots_created_at_idx" ON "admin_kpi_snapshots"("created_at");
