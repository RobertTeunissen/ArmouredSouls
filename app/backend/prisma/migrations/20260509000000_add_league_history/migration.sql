-- CreateTable
CREATE TABLE "league_history" (
    "id" SERIAL NOT NULL,
    "entity_type" VARCHAR(20) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "change_type" VARCHAR(20) NOT NULL,
    "source_tier" VARCHAR(20) NOT NULL,
    "destination_tier" VARCHAR(20) NOT NULL,
    "source_league_id" VARCHAR(30) NOT NULL,
    "destination_league_id" VARCHAR(30) NOT NULL,
    "league_points" INTEGER NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "league_history_entity_type_entity_id_idx" ON "league_history"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "league_history_cycle_number_idx" ON "league_history"("cycle_number");

-- CreateIndex
CREATE INDEX "league_history_user_id_idx" ON "league_history"("user_id");

-- AddForeignKey
ALTER TABLE "league_history" ADD CONSTRAINT "league_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
