-- Drop legacy tag team tables
-- The TagTeam and ScheduledTagTeamMatch models have been unified into
-- TeamBattle (teamSize=2) and ScheduledTeamBattleMatch (matchMode='tag_team').
-- All data was previously migrated in earlier migrations.

-- Drop tag_team_matches first (has FK references to tag_teams)
DROP TABLE IF EXISTS "tag_team_matches";

-- Drop tag_teams table
DROP TABLE IF EXISTS "tag_teams";
