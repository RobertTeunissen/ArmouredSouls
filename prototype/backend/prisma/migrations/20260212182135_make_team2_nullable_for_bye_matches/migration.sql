-- DropForeignKey
ALTER TABLE "tag_team_matches" DROP CONSTRAINT "tag_team_matches_team2_id_fkey";

-- AlterTable
ALTER TABLE "tag_team_matches" ALTER COLUMN "team2_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "tag_team_matches" ADD CONSTRAINT "tag_team_matches_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "tag_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
