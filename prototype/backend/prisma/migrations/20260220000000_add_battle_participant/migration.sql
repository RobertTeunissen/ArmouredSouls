-- CreateTable
CREATE TABLE "battle_participants" (
    "id" SERIAL NOT NULL,
    "battle_id" INTEGER NOT NULL,
    "robot_id" INTEGER NOT NULL,
    "team" INTEGER NOT NULL,
    "role" VARCHAR(20),
    "credits" INTEGER NOT NULL,
    "streaming_revenue" INTEGER NOT NULL DEFAULT 0,
    "elo_before" INTEGER NOT NULL,
    "elo_after" INTEGER NOT NULL,
    "prestige_awarded" INTEGER NOT NULL DEFAULT 0,
    "fame_awarded" INTEGER NOT NULL DEFAULT 0,
    "damage_dealt" INTEGER NOT NULL DEFAULT 0,
    "final_hp" INTEGER NOT NULL,
    "yielded" BOOLEAN NOT NULL DEFAULT false,
    "destroyed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "battle_participants_battle_id_idx" ON "battle_participants"("battle_id");

-- CreateIndex
CREATE INDEX "battle_participants_robot_id_idx" ON "battle_participants"("robot_id");

-- CreateIndex
CREATE INDEX "battle_participants_battle_id_team_idx" ON "battle_participants"("battle_id", "team");

-- CreateIndex
CREATE UNIQUE INDEX "battle_participants_battle_id_robot_id_key" ON "battle_participants"("battle_id", "robot_id");

-- AddForeignKey
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
