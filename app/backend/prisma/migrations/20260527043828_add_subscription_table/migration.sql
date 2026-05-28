-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "robot_id" INTEGER NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_robot_id_idx" ON "subscriptions"("robot_id");

-- CreateIndex
CREATE INDEX "subscriptions_event_type_idx" ON "subscriptions"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_robot_id_event_type_key" ON "subscriptions"("robot_id", "event_type");

-- CreateIndex
CREATE INDEX "battles_league_instance_id_idx" ON "battles"("league_instance_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
