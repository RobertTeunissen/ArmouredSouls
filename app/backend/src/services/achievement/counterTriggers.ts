/**
 * Counter triggers: achievements unlocked when one stored counter reaches the
 * achievement's threshold. Each maps the trigger type to the field read from
 * the cached robot or user row; `evaluateTrigger()` checks them before its
 * switch, so they need no `case` of their own.
 */

/** Robot counters (cached robot row). A missing threshold never unlocks. */
export const ROBOT_COUNTER_TRIGGERS: Readonly<Record<string, string>> = {
  wins: 'wins',
  losses: 'losses',
  // Season 2 (D7): every mode, including KotH and Grand Melee.
  battles: 'allModesBattles',
  kills: 'kills',
  elo: 'elo',
  fame: 'fame',
  win_streak: 'currentWinStreak',
  lose_streak: 'currentLoseStreak',
  koth_wins: 'kothWins',
  tag_team_wins: 'totalTagTeamWins',
  league_2v2_wins: 'totalLeague2v2Wins',
  league_3v3_wins: 'totalLeague3v3Wins',
  // Written by `updateRobotCombatStats()` (Spec #46 R8 Cause C).
  grand_melee_wins: 'grandMeleeWins',
  grand_melee_top3: 'grandMeleeTop3',
};

/** User counters (cached user row). A missing threshold never unlocks. */
export const USER_COUNTER_TRIGGERS: Readonly<Record<string, string>> = {
  prestige: 'prestige',
  currency: 'currency',
};

/** User totals (cached user row). A missing threshold counts as 0. */
export const USER_TOTAL_TRIGGERS: Readonly<Record<string, string>> = {
  practice_battles: 'totalPracticeBattles',
  tournament_wins: 'championshipTitles',
  tournament_2v2_wins: 'championshipTitles2v2',
  tournament_3v3_wins: 'championshipTitles3v3',
};

/** Whether a trigger type is one of the counter triggers above. */
export function isCounterTrigger(triggerType: string): boolean {
  return [ROBOT_COUNTER_TRIGGERS, USER_COUNTER_TRIGGERS, USER_TOTAL_TRIGGERS]
    .some((table) => Object.prototype.hasOwnProperty.call(table, triggerType));
}
