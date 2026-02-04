-- CreateTable
CREATE TABLE "cycle_metadata" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "total_cycles" INTEGER NOT NULL DEFAULT 0,
    "last_cycle_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_metadata_pkey" PRIMARY KEY ("id")
);
