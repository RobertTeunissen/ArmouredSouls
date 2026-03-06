-- AlterTable
ALTER TABLE "users" ADD COLUMN     "has_completed_onboarding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboarding_choices" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "onboarding_completed_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_skipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboarding_started_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_step" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "onboarding_strategy" VARCHAR(20);

-- CreateTable
CREATE TABLE "reset_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "robots_deleted" INTEGER NOT NULL,
    "weapons_deleted" INTEGER NOT NULL,
    "facilities_deleted" INTEGER NOT NULL,
    "credits_before_reset" DECIMAL(15,2) NOT NULL,
    "reason" TEXT,
    "reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reset_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reset_logs_user_id_idx" ON "reset_logs"("user_id");

-- CreateIndex
CREATE INDEX "reset_logs_reset_at_idx" ON "reset_logs"("reset_at");
