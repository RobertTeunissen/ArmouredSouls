-- DropIndex
DROP INDEX "audit_logs_payload_gin_idx";

-- CreateTable
CREATE TABLE "robot_streaming_revenue" (
    "id" SERIAL NOT NULL,
    "robot_id" INTEGER NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "streaming_revenue" DOUBLE PRECISION NOT NULL,
    "battles_in_cycle" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "robot_streaming_revenue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "robot_streaming_revenue_robot_id_idx" ON "robot_streaming_revenue"("robot_id");

-- CreateIndex
CREATE INDEX "robot_streaming_revenue_cycle_number_idx" ON "robot_streaming_revenue"("cycle_number");

-- CreateIndex
CREATE UNIQUE INDEX "robot_streaming_revenue_robot_id_cycle_number_key" ON "robot_streaming_revenue"("robot_id", "cycle_number");

-- AddForeignKey
ALTER TABLE "robot_streaming_revenue" ADD CONSTRAINT "robot_streaming_revenue_robot_id_fkey" FOREIGN KEY ("robot_id") REFERENCES "robots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
