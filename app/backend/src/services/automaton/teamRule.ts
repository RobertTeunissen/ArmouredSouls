/**
 * Team_Rule (Spec #55, R3.6, R5.9, design §8.7): which Blueprint_Slots form
 * which team. The rule lives in `app/shared/utils/automatonTeamRule.ts`
 * because the admin Editor's Teams card uses it too.
 */
export {
  TEAM_RULE_2V2,
  TEAM_RULE_3V3,
  teamsForSlots,
  requiredTeamNameCounts,
  teamNameMaxRobots,
  type TeamRuleTeam,
} from '../../shared/utils/automatonTeamRule';
