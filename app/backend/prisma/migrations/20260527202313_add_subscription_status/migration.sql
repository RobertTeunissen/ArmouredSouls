-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "status" VARCHAR(10) NOT NULL DEFAULT 'pending';

-- Data migration: all existing subscriptions were implicitly active under the old model
UPDATE "subscriptions" SET "status" = 'active' WHERE "status" = 'pending';

-- CreateIndex
CREATE INDEX "subscriptions_status_event_type_idx" ON "subscriptions"("status", "event_type");
