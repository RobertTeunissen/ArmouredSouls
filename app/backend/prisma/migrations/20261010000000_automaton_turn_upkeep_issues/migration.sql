-- Spec #55: Free_Upkeep issues recorded on the Turn_Record (review finding C06-2).
ALTER TABLE "automaton_turns" ADD COLUMN "upkeep_issues" JSONB NOT NULL DEFAULT '[]';
