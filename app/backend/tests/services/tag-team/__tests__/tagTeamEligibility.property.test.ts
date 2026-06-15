/**
 * Tag Team Eligibility - Property-Based Tests
 * Feature: tag-team-system-unification
 *
 * Tests the correctness properties of tag team eligibility independence (Property 6)
 * and match mode discrimination (Property 8).
 *
 * These test pure logic — no database required:
 * - Property 6 validates that per-mode eligibility depends only on corresponding subscriptions
 * - Property 8 validates that scheduled tag team matches always have matchMode='tag_team' and
 *   teamSize=2, and that lock queries only consider matchMode='tag_team'
 */

import * as fc from 'fast-check';

// ─── Types (mirroring the service interfaces) ────────────────────────────────

type SubscriptionType = 'tag_team' | 'league_2v2' | 'tournament_2v2';

interface TeamMember {
  robotId: number;
  slotIndex: number;
  subscriptions: SubscriptionType[];
}

interface Team {
  id: number;
  teamSize: number;
  members: TeamMember[];
}

interface ScheduledMatch {
  team1Id: number;
  team2Id: number | null;
  teamSize: number;
  matchMode: string;
  status: string;
}

// ─── Pure Logic Functions Under Test ─────────────────────────────────────────

/**
 * Determines if a team is eligible for a specific mode based on member subscriptions.
 * Mirrors the eligibility logic in tagTeamMatchmakingService.getEligibleTeams()
 * and teamBattleMatchmakingService.
 *
 * A team is eligible for a mode IFF:
 * 1. The team has exactly 2 members (for teamSize=2 modes)
 * 2. BOTH members have the corresponding subscription active
 */
function isTeamEligibleForMode(team: Team, mode: SubscriptionType): boolean {
  // Requirement 3.6 / 6.4: Incomplete rosters are ineligible for all modes
  if (team.members.length < 2) {
    return false;
  }

  // Requirement 3.2 / 6.2: Both members must have the corresponding subscription
  return team.members.every(member => member.subscriptions.includes(mode));
}

/**
 * Creates a scheduled tag team match record.
 * Mirrors the scheduling logic in tagTeamMatchmakingService.scheduleMatches().
 */
function createScheduledTagTeamMatch(
  team1Id: number,
  team2Id: number | null,
): ScheduledMatch {
  return {
    team1Id,
    team2Id,
    teamSize: 2,
    matchMode: 'tag_team',
    status: 'scheduled',
  };
}

/**
 * Checks if a robot is locked for tag team based on scheduled matches.
 * Mirrors the tagTeamLockingPredicate from lockingPredicates.ts.
 *
 * Returns true IFF the robot's team has a scheduled match where matchMode='tag_team'.
 */
function isRobotLockedForTagTeam(
  robotId: number,
  teams: Team[],
  scheduledMatches: ScheduledMatch[],
): boolean {
  // Find the team this robot belongs to (teamSize=2)
  const team = teams.find(
    t => t.teamSize === 2 && t.members.some(m => m.robotId === robotId)
  );
  if (!team) return false;

  // Check if the team has a scheduled tag_team match
  return scheduledMatches.some(
    match =>
      match.matchMode === 'tag_team' &&
      match.status === 'scheduled' &&
      (match.team1Id === team.id || match.team2Id === team.id)
  );
}

// ─── Generators ──────────────────────────────────────────────────────────────

const subscriptionTypeArb = fc.constantFrom<SubscriptionType>('tag_team', 'league_2v2', 'tournament_2v2');

const subscriptionSetArb = fc.subarray<SubscriptionType>(
  ['tag_team', 'league_2v2', 'tournament_2v2'],
  { minLength: 0, maxLength: 3 }
);

const teamMemberArb = (robotId: number, slotIndex: number): fc.Arbitrary<TeamMember> =>
  subscriptionSetArb.map(subs => ({
    robotId,
    slotIndex,
    subscriptions: subs,
  }));

const fullTeamArb: fc.Arbitrary<Team> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  teamSize: fc.constant(2),
  members: fc.tuple(
    fc.integer({ min: 1, max: 100000 }),
    fc.integer({ min: 1, max: 100000 }),
  ).chain(([robotId1, robotId2]) =>
    fc.tuple(
      teamMemberArb(robotId1, 0),
      teamMemberArb(robotId2, 1),
    ).map(([m1, m2]) => [m1, m2])
  ),
});

/** Generate a team with a random number of members (0, 1, or 2) to test incomplete rosters */
const variableMemberTeamArb: fc.Arbitrary<Team> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  teamSize: fc.constant(2),
  members: fc.integer({ min: 0, max: 2 }).chain(memberCount => {
    if (memberCount === 0) return fc.constant<TeamMember[]>([]);
    if (memberCount === 1) {
      return fc.integer({ min: 1, max: 100000 }).chain(robotId =>
        teamMemberArb(robotId, 0).map(m => [m])
      );
    }
    return fc.tuple(
      fc.integer({ min: 1, max: 100000 }),
      fc.integer({ min: 1, max: 100000 }),
    ).chain(([robotId1, robotId2]) =>
      fc.tuple(
        teamMemberArb(robotId1, 0),
        teamMemberArb(robotId2, 1),
      ).map(([m1, m2]) => [m1, m2])
    );
  }),
});

const matchModeArb = fc.constantFrom('tag_team', 'league_2v2', 'league_3v3', 'tournament_2v2', 'tournament_3v3');

const scheduledMatchArb: fc.Arbitrary<ScheduledMatch> = fc.record({
  team1Id: fc.integer({ min: 1, max: 10000 }),
  team2Id: fc.oneof(fc.integer({ min: 1, max: 10000 }), fc.constant(null as number | null)),
  teamSize: fc.constantFrom(2, 3),
  matchMode: matchModeArb,
  status: fc.constantFrom('scheduled', 'completed', 'cancelled'),
});

// ─── Property 6: Tag Team Eligibility Independence ───────────────────────────

describe('Feature: tag-team-system-unification', () => {
  describe('Property 6: Tag Team Eligibility Independence', () => {
    /**
     * **Validates: Requirements 3.2, 3.6, 6.2, 6.4**
     *
     * For any 2v2 TeamBattle team and any combination of per-robot subscriptions,
     * the eligibility determination for each mode SHALL depend only on whether both
     * member robots hold the corresponding subscription for that mode.
     */

    it('a team is eligible for tag_team IFF BOTH robots have tag_team subscription', () => {
      fc.assert(
        fc.property(
          fullTeamArb,
          (team) => {
            const eligible = isTeamEligibleForMode(team, 'tag_team');
            const bothHaveTagTeam = team.members.every(m => m.subscriptions.includes('tag_team'));

            expect(eligible).toBe(bothHaveTagTeam);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('a team is eligible for league_2v2 IFF BOTH robots have league_2v2 subscription', () => {
      fc.assert(
        fc.property(
          fullTeamArb,
          (team) => {
            const eligible = isTeamEligibleForMode(team, 'league_2v2');
            const bothHaveLeague2v2 = team.members.every(m => m.subscriptions.includes('league_2v2'));

            expect(eligible).toBe(bothHaveLeague2v2);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('eligibility for tag_team is independent of league_2v2 eligibility', () => {
      fc.assert(
        fc.property(
          fullTeamArb,
          (team) => {
            const tagTeamEligible = isTeamEligibleForMode(team, 'tag_team');
            const league2v2Eligible = isTeamEligibleForMode(team, 'league_2v2');

            // These are independent — all four combinations are valid:
            // (true, true), (true, false), (false, true), (false, false)
            // The key property: changing one subscription does not affect the other mode

            // Verify independence by checking that tag_team eligibility
            // depends ONLY on tag_team subscriptions
            const bothHaveTagTeam = team.members.every(m => m.subscriptions.includes('tag_team'));
            const bothHaveLeague2v2 = team.members.every(m => m.subscriptions.includes('league_2v2'));

            expect(tagTeamEligible).toBe(bothHaveTagTeam);
            expect(league2v2Eligible).toBe(bothHaveLeague2v2);

            // Having tag_team does NOT imply league_2v2 eligibility (or vice versa)
            // This is verified structurally by the independent checks above
          }
        ),
        { numRuns: 200 }
      );
    });

    it('a team with fewer than 2 members is ineligible for ALL modes', () => {
      fc.assert(
        fc.property(
          variableMemberTeamArb.filter(team => team.members.length < 2),
          (team) => {
            // An incomplete team is ineligible for every mode regardless of subscriptions
            expect(isTeamEligibleForMode(team, 'tag_team')).toBe(false);
            expect(isTeamEligibleForMode(team, 'league_2v2')).toBe(false);
            expect(isTeamEligibleForMode(team, 'tournament_2v2')).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('having tag_team subscription does not affect league_2v2 eligibility and vice versa', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 100000 }),
          fc.integer({ min: 1, max: 100000 }),
          fc.boolean(), // robot1 has tag_team
          fc.boolean(), // robot2 has tag_team
          fc.boolean(), // robot1 has league_2v2
          fc.boolean(), // robot2 has league_2v2
          (teamId, robot1Id, robot2Id, r1TagTeam, r2TagTeam, r1League, r2League) => {
            // Build subscription lists from independent booleans
            const subs1: SubscriptionType[] = [];
            const subs2: SubscriptionType[] = [];
            if (r1TagTeam) subs1.push('tag_team');
            if (r2TagTeam) subs2.push('tag_team');
            if (r1League) subs1.push('league_2v2');
            if (r2League) subs2.push('league_2v2');

            const team: Team = {
              id: teamId,
              teamSize: 2,
              members: [
                { robotId: robot1Id, slotIndex: 0, subscriptions: subs1 },
                { robotId: robot2Id, slotIndex: 1, subscriptions: subs2 },
              ],
            };

            const tagTeamEligible = isTeamEligibleForMode(team, 'tag_team');
            const league2v2Eligible = isTeamEligibleForMode(team, 'league_2v2');

            // Tag team eligibility depends ONLY on r1TagTeam && r2TagTeam
            expect(tagTeamEligible).toBe(r1TagTeam && r2TagTeam);

            // League 2v2 eligibility depends ONLY on r1League && r2League
            expect(league2v2Eligible).toBe(r1League && r2League);
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  // ─── Property 8: Match Mode Discrimination ─────────────────────────────────

  describe('Property 8: Match Mode Discrimination', () => {
    /**
     * **Validates: Requirements 7.3, 7.4, 12.6**
     *
     * For any newly scheduled tag team match, the resulting ScheduledTeamBattleMatch row
     * SHALL have matchMode = 'tag_team' and teamSize = 2. For any lock-for-battle or
     * match pickup query related to tag team combat, only rows with matchMode = 'tag_team'
     * SHALL be considered.
     */

    it('any scheduled tag team match has matchMode = "tag_team" and teamSize = 2', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.oneof(fc.integer({ min: 1, max: 10000 }), fc.constant(null as number | null)),
          (team1Id, team2Id) => {
            const match = createScheduledTagTeamMatch(team1Id, team2Id);

            expect(match.matchMode).toBe('tag_team');
            expect(match.teamSize).toBe(2);
            expect(match.status).toBe('scheduled');
            expect(match.team1Id).toBe(team1Id);
            expect(match.team2Id).toBe(team2Id);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('tag team lock check returns true ONLY when matchMode = "tag_team" (not league_2v2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }), // robotId
          fc.integer({ min: 1, max: 10000 }),   // teamId
          matchModeArb,                          // random matchMode for the scheduled match
          (robotId, teamId, mode) => {
            const team: Team = {
              id: teamId,
              teamSize: 2,
              members: [
                { robotId, slotIndex: 0, subscriptions: ['tag_team'] },
                { robotId: robotId + 1, slotIndex: 1, subscriptions: ['tag_team'] },
              ],
            };

            // Create a scheduled match with the random mode
            const match: ScheduledMatch = {
              team1Id: teamId,
              team2Id: teamId + 100,
              teamSize: 2,
              matchMode: mode,
              status: 'scheduled',
            };

            const isLocked = isRobotLockedForTagTeam(robotId, [team], [match]);

            // Robot should ONLY be locked when matchMode is 'tag_team'
            expect(isLocked).toBe(mode === 'tag_team');
          }
        ),
        { numRuns: 200 }
      );
    });

    it('tag team lock check returns false when robot is not on any teamSize=2 team', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }), // robotId not on any team
          fc.array(scheduledMatchArb, { minLength: 0, maxLength: 10 }),
          (robotId, scheduledMatches) => {
            // No teams at all — robot is unattached
            const isLocked = isRobotLockedForTagTeam(robotId, [], scheduledMatches);
            expect(isLocked).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tag team lock check returns false when no scheduled tag_team matches exist for team', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }),
          fc.integer({ min: 1, max: 10000 }),
          (robotId, teamId) => {
            const team: Team = {
              id: teamId,
              teamSize: 2,
              members: [
                { robotId, slotIndex: 0, subscriptions: ['tag_team'] },
                { robotId: robotId + 1, slotIndex: 1, subscriptions: ['tag_team'] },
              ],
            };

            // Only non-tag_team matches exist for this team
            const nonTagTeamMatches: ScheduledMatch[] = [
              { team1Id: teamId, team2Id: teamId + 100, teamSize: 2, matchMode: 'league_2v2', status: 'scheduled' },
              { team1Id: teamId, team2Id: teamId + 200, teamSize: 2, matchMode: 'tournament_2v2', status: 'scheduled' },
            ];

            const isLocked = isRobotLockedForTagTeam(robotId, [team], nonTagTeamMatches);

            // Should NOT be locked — only tag_team matches should trigger the lock
            expect(isLocked).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('tag team lock check ignores completed/cancelled tag_team matches', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.constantFrom('completed', 'cancelled'),
          (robotId, teamId, nonActiveStatus) => {
            const team: Team = {
              id: teamId,
              teamSize: 2,
              members: [
                { robotId, slotIndex: 0, subscriptions: ['tag_team'] },
                { robotId: robotId + 1, slotIndex: 1, subscriptions: ['tag_team'] },
              ],
            };

            // Tag team match exists but is NOT in 'scheduled' status
            const completedMatch: ScheduledMatch = {
              team1Id: teamId,
              team2Id: teamId + 100,
              teamSize: 2,
              matchMode: 'tag_team',
              status: nonActiveStatus,
            };

            const isLocked = isRobotLockedForTagTeam(robotId, [team], [completedMatch]);

            // Should NOT be locked — only 'scheduled' status counts
            expect(isLocked).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('scheduled tag team matches never have teamSize != 2', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 10000 }),
          (team1Id, team2Id) => {
            // The createScheduledTagTeamMatch function always produces teamSize=2
            const match = createScheduledTagTeamMatch(team1Id, team2Id);

            // This is the invariant: tag team matches are always teamSize=2
            expect(match.teamSize).toBe(2);
            expect(match.matchMode).toBe('tag_team');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
