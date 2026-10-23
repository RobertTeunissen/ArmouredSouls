-- Persistent scheduler history for Cycle Controls. Additive: two new tables,
-- no existing data touched. The in-memory scheduler state still drives the
-- scheduler; these rows only record what happened, so they survive restarts.

CREATE TABLE "scheduler_processes" (
    "id" SERIAL NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduler_enabled" BOOLEAN NOT NULL,
    "deploy_tag" VARCHAR(80),

    CONSTRAINT "scheduler_processes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduler_processes_started_at_idx" ON "scheduler_processes"("started_at");

CREATE TABLE "scheduler_job_runs" (
    "id" SERIAL NOT NULL,
    "job_name" VARCHAR(40) NOT NULL,
    "trigger" VARCHAR(10) NOT NULL,
    "triggered_by_user_id" INTEGER,
    "process_id" INTEGER NOT NULL,
    "status" VARCHAR(12) NOT NULL,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "summary" JSONB,
    "error" VARCHAR(500),

    CONSTRAINT "scheduler_job_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduler_job_runs_job_name_queued_at_idx" ON "scheduler_job_runs"("job_name", "queued_at");
CREATE INDEX "scheduler_job_runs_queued_at_idx" ON "scheduler_job_runs"("queued_at");
CREATE INDEX "scheduler_job_runs_status_idx" ON "scheduler_job_runs"("status");

ALTER TABLE "scheduler_job_runs"
    ADD CONSTRAINT "scheduler_job_runs_process_id_fkey"
    FOREIGN KEY ("process_id") REFERENCES "scheduler_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
