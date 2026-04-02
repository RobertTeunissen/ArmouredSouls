/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `robots` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "robots_user_id_name_key";

-- AlterTable
ALTER TABLE "weapons" ALTER COLUMN "range_band" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "robots_name_key" ON "robots"("name");
