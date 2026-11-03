-- CreateTable
CREATE TABLE "economy_cycle_rollups" (
    "season_number" INTEGER NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "flows" JSONB NOT NULL,
    "repairs" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economy_cycle_rollups_pkey" PRIMARY KEY ("season_number","cycle_number")
);

