-- AlterTable
ALTER TABLE "robots" ADD COLUMN     "cycles_in_current_league" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
