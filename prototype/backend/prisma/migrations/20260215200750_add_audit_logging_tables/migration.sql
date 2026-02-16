-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequence_number" INTEGER NOT NULL,
    "user_id" INTEGER,
    "robot_id" INTEGER,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_snapshots" (
    "id" SERIAL NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "trigger_type" VARCHAR(20) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "stable_metrics" JSONB NOT NULL,
    "robot_metrics" JSONB NOT NULL,
    "step_durations" JSONB NOT NULL,
    "total_battles" INTEGER NOT NULL DEFAULT 0,
    "total_credits_transacted" BIGINT NOT NULL DEFAULT 0,
    "total_prestige_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_idx" ON "audit_logs"("cycle_number");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_robot_id_idx" ON "audit_logs"("robot_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_event_timestamp_idx" ON "audit_logs"("event_timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_user_id_idx" ON "audit_logs"("cycle_number", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_robot_id_idx" ON "audit_logs"("cycle_number", "robot_id");

-- CreateIndex
CREATE INDEX "audit_logs_cycle_number_event_type_idx" ON "audit_logs"("cycle_number", "event_type");

-- CreateIndex
CREATE INDEX "audit_logs_payload_gin_idx" ON "audit_logs" USING GIN ("payload" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_cycle_number_sequence_number_key" ON "audit_logs"("cycle_number", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_snapshots_cycle_number_key" ON "cycle_snapshots"("cycle_number");

-- CreateIndex
CREATE INDEX "cycle_snapshots_cycle_number_idx" ON "cycle_snapshots"("cycle_number");

-- CreateIndex
CREATE INDEX "cycle_snapshots_start_time_idx" ON "cycle_snapshots"("start_time");
