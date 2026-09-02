/**
 * RecentBattles — unified recent battles list used on Dashboard, Robot Detail,
 * and anywhere else a compact battle feed is needed.
 *
 * Modes:
 *   - Pass `battles` prop → renders them directly (parent fetches)
 *   - Omit `battles` → fetches from /api/matches/history internally
 *
 * Perspective:
 *   - `robotId` → outcome/ELO from that robot's point of view
 *   - `userId`  → outcome from the user's robot in each battle
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CompactBattleCard from './CompactBattleCard';
import { getMatchHistory, BattleHistory, getBattlePerspective, getBattleEconomicDisplay } from '../utils/matchmakingApi';
import { expandBattleDisplayInstances, type BattleDisplayInstance } from '../utils/match-display-instances';
import { createLogger } from '../utils/logger';

const log = createLogger('RecentBattles');

interface RecentBattlesProps {
  /** Pre-fetched battles. If omitted, the component fetches its own. */
  battles?: BattleHistory[];
  /** Robot perspective — used on robot detail page. */
  robotId?: number;
  /** User perspective — used on dashboard (any robot owned by this user). */
  userId?: number;
  /** Max battles to fetch when self-fetching. Default 20. */
  limit?: number;
  /** Title override. Default "Recent Battles". */
  title?: string;
}

function RecentBattles({ battles: battlesProp, robotId, userId, limit = 20, title = 'Recent Battles' }: RecentBattlesProps) {
  const navigate = useNavigate();
  const [fetchedBattles, setFetchedBattles] = useState<BattleHistory[] | null>(null);
  const [loading, setLoading] = useState(!battlesProp);
  const [error, setError] = useState<string | null>(null);

  // Self-fetch when no battles prop is provided
  useEffect(() => {
    if (battlesProp) return;

    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMatchHistory(1, limit, undefined, robotId);
        if (!cancelled) setFetchedBattles(data.data);
      } catch (err) {
        log.error('Failed to fetch recent battles', err);
        if (!cancelled) setError('Failed to load recent battles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [battlesProp, robotId, limit]);

  const battles = battlesProp ?? fetchedBattles ?? [];

  if (loading) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        <p className="text-sm text-secondary">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (battles.length === 0) {
    return (
      <div className="bg-surface p-4 rounded-lg border border-white/10">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        <p className="text-sm text-secondary">No recent battles</p>
      </div>
    );
  }

  const displayInstances: BattleDisplayInstance[] = battles.flatMap((battle) => {
    const expanded = expandBattleDisplayInstances(battle, { robotId, userId });
    if (expanded.length > 0) return expanded;

    // Preserve legacy records without participants while keeping the source
    // battle key unique and the perspective explicit.
    const perspectiveRobotId = robotId ?? battle.robot1Id;
    return [{
      battle,
      displayInstanceKey: `battle:${battle.id}:legacy:${perspectiveRobotId}`,
      perspectiveRobotId,
      perspectiveRobotIds: [perspectiveRobotId],
    }];
  });

  return (
    <div className="bg-surface p-4 rounded-lg border border-white/10">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          onClick={() => navigate('/battle-history')}
          className="text-primary hover:text-primary-light text-xs font-semibold min-h-[44px] px-2"
        >
          View All →
        </button>
      </div>

      <div className="space-y-0 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {displayInstances.map((instance) => {
          const { battle } = instance;
          const { myRobot, opponent, outcome, eloChange, myRobotId } = getBattlePerspective(
            battle,
            { robotId: instance.perspectiveRobotId },
          );
          const economics = getBattleEconomicDisplay(battle, instance.perspectiveRobotId);

          return (
            <CompactBattleCard
              key={instance.displayInstanceKey}
              battle={battle}
              myRobot={myRobot}
              opponent={opponent}
              outcome={outcome}
              eloChange={eloChange}
              myRobotId={myRobotId}
              reward={economics.credits}
              prestige={economics.prestigeAwarded}
              fame={economics.fameAwarded}
              streamingRevenue={economics.streamingRevenue}
              onClick={() => navigate(`/battle/${battle.id}`)}
            />
          );
        })}
      </div>
    </div>
  );
}


export default RecentBattles;
