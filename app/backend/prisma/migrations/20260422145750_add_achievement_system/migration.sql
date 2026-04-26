-- AlterTable
ALTER TABLE "robots" ADD COLUMN     "balanced_wins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "best_win_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "current_lose_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "current_win_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "defensive_wins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dual_wield_wins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "offensive_wins" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pinned_achievements" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "total_practice_battles" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "achievement_id" VARCHAR(10) NOT NULL,
    "robot_id" INTEGER,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements"("user_id");

-- CreateIndex
CREATE INDEX "user_achievements_robot_id_idx" ON "user_achievements"("robot_id");

-- CreateIndex
CREATE INDEX "user_achievements_achievement_id_idx" ON "user_achievements"("achievement_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_achievement_id_key" ON "user_achievements"("user_id", "achievement_id");

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
