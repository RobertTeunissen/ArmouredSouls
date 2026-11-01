-- Admin redesign part 6 (Security & Image Uploads): persisted security signals and
-- an inventory of player uploads. Existing files are backfilled by the app at startup
-- (uploadedImageService.syncUploadedImages); this migration only creates the tables.

-- CreateTable
CREATE TABLE "security_events" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signal" VARCHAR(30) NOT NULL,
    "user_id" INTEGER,
    "source_ip" VARCHAR(64),
    "endpoint" VARCHAR(200),
    "details" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "uploaded_images" (
    "id" SERIAL NOT NULL,
    "image_url" VARCHAR(255) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "moderation_scores" JSONB,
    "robot_likeness_score" DOUBLE PRECISION,
    "uploaded_anyway" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uploaded_images_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "security_events_occurred_at_idx" ON "security_events"("occurred_at");
-- CreateIndex
CREATE INDEX "security_events_signal_occurred_at_idx" ON "security_events"("signal", "occurred_at");
-- CreateIndex
CREATE INDEX "security_events_user_id_occurred_at_idx" ON "security_events"("user_id", "occurred_at");
-- CreateIndex
CREATE INDEX "security_events_source_ip_occurred_at_idx" ON "security_events"("source_ip", "occurred_at");
-- CreateIndex
CREATE UNIQUE INDEX "uploaded_images_image_url_key" ON "uploaded_images"("image_url");
-- CreateIndex
CREATE INDEX "uploaded_images_uploaded_at_idx" ON "uploaded_images"("uploaded_at");
-- CreateIndex
CREATE INDEX "uploaded_images_user_id_idx" ON "uploaded_images"("user_id");
