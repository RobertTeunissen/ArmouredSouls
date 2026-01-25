-- AlterTable
ALTER TABLE "users" ADD COLUMN     "prestige" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "facilities" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "facility_type" VARCHAR(50) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facilities_user_id_facility_type_key" ON "facilities"("user_id", "facility_type");

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
