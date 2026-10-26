-- Battle-time builds of the robots that fought (admin "what wins" analyses).
-- Additive; purged with battles at season rollover.

-- CreateTable
CREATE TABLE "battle_participant_builds" (
    "id" SERIAL NOT NULL,
    "battle_id" INTEGER NOT NULL,
    "robot_id" INTEGER NOT NULL,
    "battle_type" VARCHAR(20) NOT NULL,
    "base_attributes" JSONB NOT NULL,
    "tuning" JSONB NOT NULL,
    "effective_attributes" JSONB NOT NULL,
    "main_weapon_id" INTEGER,
    "main_refinements" JSONB,
    "offhand_weapon_id" INTEGER,
    "offhand_refinements" JSONB,
    "loadout_type" VARCHAR(20) NOT NULL,
    "stance" VARCHAR(20) NOT NULL,
    "yield_threshold" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_participant_builds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "battle_participant_builds_battle_type_created_at_idx" ON "battle_participant_builds"("battle_type", "created_at");

-- CreateIndex
CREATE INDEX "battle_participant_builds_robot_id_idx" ON "battle_participant_builds"("robot_id");

-- CreateIndex
CREATE UNIQUE INDEX "battle_participant_builds_battle_id_robot_id_key" ON "battle_participant_builds"("battle_id", "robot_id");

-- AddForeignKey
ALTER TABLE "battle_participant_builds" ADD CONSTRAINT "battle_participant_builds_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

