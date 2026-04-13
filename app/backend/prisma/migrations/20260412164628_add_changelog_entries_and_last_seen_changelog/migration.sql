-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_seen_changelog" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "changelog_entries" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "image_url" VARCHAR(500),
    "publish_date" TIMESTAMP(3),
    "source_type" VARCHAR(20),
    "source_ref" VARCHAR(200),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "changelog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "changelog_entries_status_publish_date_idx" ON "changelog_entries"("status", "publish_date");

-- CreateIndex
CREATE INDEX "changelog_entries_source_ref_idx" ON "changelog_entries"("source_ref");
