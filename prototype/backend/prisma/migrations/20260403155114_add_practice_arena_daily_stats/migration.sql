-- CreateTable
CREATE TABLE "practice_arena_daily_stats" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "totalBattles" INTEGER NOT NULL DEFAULT 0,
    "uniquePlayers" INTEGER NOT NULL DEFAULT 0,
    "rateLimitHits" INTEGER NOT NULL DEFAULT 0,
    "playerIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_arena_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "practice_arena_daily_stats_date_key" ON "practice_arena_daily_stats"("date");
