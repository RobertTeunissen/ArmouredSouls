/**
 * Dashboard tier-change notifications (`GET /api/leagues/tier-changes/unseen`):
 * the stable's promotions and demotions from the last 24 hours (at most 20,
 * newest first), with the robot or team name and the mode, one entry per
 * entity + change + mode. Moved out of `routes/leagues.ts`; the response
 * shape is unchanged.
 */
import prisma from '../../lib/prisma';
import type { TierChange, TierChangeType } from '../../shared/types';

export async function getRecentTierChanges(userId: number): Promise<TierChange[]> {
  // Show tier changes from the last 24 hours. Using a fixed window avoids the
  // race where lastLoginAt is updated at login time (before the dashboard loads),
  // which would cause the endpoint to return no results on the current session.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const changes = await prisma.leagueHistory.findMany({
    where: {
      userId,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Enrich with robot/team names and mode
  const robotIds = changes.filter(c => c.entityType === 'robot').map(c => c.entityId);
  const tagTeamIds = changes.filter(c => c.entityType === 'tag_team').map(c => c.entityId);
  const teamBattleIds = changes.filter(c => c.entityType === 'team_battle').map(c => c.entityId);

  // Look up standings to determine which mode each tier change belongs to
  const allEntityIds = changes.map(c => c.entityId);
  const standings = allEntityIds.length > 0
    ? await prisma.standing.findMany({
        where: { entityId: { in: allEntityIds } },
        select: { entityId: true, entityType: true, mode: true, tier: true, leagueInstanceId: true },
      })
    : [];

  const [robots, tagTeams, teamBattles] = await Promise.all([
    robotIds.length > 0
      ? prisma.robot.findMany({ where: { id: { in: robotIds } }, select: { id: true, name: true } })
      : [],
    tagTeamIds.length > 0
      ? prisma.teamBattle.findMany({
          where: { id: { in: tagTeamIds } },
          select: { id: true, teamName: true },
        })
      : [],
    teamBattleIds.length > 0
      ? prisma.teamBattle.findMany({ where: { id: { in: teamBattleIds } }, select: { id: true, teamName: true, teamSize: true } })
      : [],
  ]);

  const robotMap = new Map(robots.map(r => [r.id, r.name]));
  const tagTeamMap = new Map(tagTeams.map(t => [t.id, t.teamName]));
  const teamBattleMap = new Map(teamBattles.map(t => [t.id, { name: t.teamName, size: t.teamSize }]));

  function getEntityName(c: { entityType: string; entityId: number }): string {
    if (c.entityType === 'robot') return robotMap.get(c.entityId) ?? `Robot #${c.entityId}`;
    if (c.entityType === 'tag_team') return tagTeamMap.get(c.entityId) ?? `Tag Team #${c.entityId}`;
    const tb = teamBattleMap.get(c.entityId);
    if (tb) return `${tb.name} (${tb.size}v${tb.size})`;
    return `Team #${c.entityId}`;
  }

  const result = changes.map((c): TierChange => {
    // Use mode from the history record (populated since Spec #44).
    // Falls back to cross-reference for legacy records without mode.
    let mode = c.mode;
    if (!mode) {
      const entityStandings = standings.filter(s => s.entityId === c.entityId && s.entityType === c.entityType);
      const freshlyChanged = entityStandings.filter(s => s.tier === c.destinationTier);
      const exactMatch = freshlyChanged.find(s => s.leagueInstanceId === c.destinationLeagueId);
      const matchingStanding = exactMatch ?? freshlyChanged[0];
      mode = matchingStanding?.mode ?? (c.entityType === 'tag_team' ? 'tag_team' : 'league_1v1');
    }

    return {
      id: c.id,
      entityType: c.entityType,
      entityId: c.entityId,
      entityName: getEntityName(c),
      // league_history only stores 'promotion' or 'demotion' (column is a plain varchar).
      changeType: c.changeType as TierChangeType,
      sourceTier: c.sourceTier,
      destinationTier: c.destinationTier,
      leaguePoints: c.leaguePoints,
      mode,
      createdAt: c.createdAt.toISOString(),
    };
  });

  // Deduplicate: same entity + same tier change + same mode = show only once
  const seen = new Set<string>();
  const deduped = result.filter(r => {
    const key = `${r.entityType}-${r.entityId}-${r.changeType}-${r.sourceTier}-${r.destinationTier}-${r.mode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped;
}
