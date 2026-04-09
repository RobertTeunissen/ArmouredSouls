import type { BattleSummaryProps } from './types';

export function BattleSummary({ battleLog }: BattleSummaryProps) {
  if (battleLog.battleType === 'koth') return null;

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      {battleLog.battleType === 'tag_team' && battleLog.tagTeam ? (
        <TagTeamSummaryContent battleLog={battleLog} />
      ) : battleLog.robot1 && battleLog.robot2 ? (
        <DuelSummaryContent battleLog={battleLog} />
      ) : (
        <p className="text-secondary">Battle summary data unavailable.</p>
      )}
    </div>
  );
}

function TagTeamSummaryContent({ battleLog }: BattleSummaryProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-2 pb-2 border-b border-white/10">
        <div>
          <h3 className="text-lg font-bold text-cyan-400">
            {battleLog.tagTeam!.team1.stableName || `Team ${battleLog.tagTeam!.team1.teamId}`}
          </h3>
        </div>
        <div className="text-right">
          <h3 className="text-lg font-bold text-cyan-400">
            {battleLog.tagTeam!.team2.stableName || `Team ${battleLog.tagTeam!.team2.teamId}`}
          </h3>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <TeamStats summary={battleLog.team1Summary} />
        <TeamStats summary={battleLog.team2Summary} />
      </div>
    </>
  );
}

interface TeamStatsProps {
  summary?: {
    reward: number;
    prestige: number;
    totalFame?: number;
    streamingRevenue?: number;
    totalDamage?: number;
  };
}

function TeamStats({ summary }: TeamStatsProps) {
  return (
    <div className="space-y-1">
      {summary?.reward != null && (
        <div className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-secondary">💰 Credits</span>
          <span className="font-bold text-success">₡{summary.reward.toLocaleString()}</span>
        </div>
      )}
      {summary?.prestige != null && summary.prestige > 0 && (
        <div className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-secondary">⭐ Prestige</span>
          <span className="font-bold text-purple-400">+{summary.prestige}</span>
        </div>
      )}
      {summary?.totalFame != null && summary.totalFame > 0 && (
        <div className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-secondary">🎖️ Fame</span>
          <span className="font-bold text-warning">+{summary.totalFame}</span>
        </div>
      )}
      {summary?.streamingRevenue != null && summary.streamingRevenue > 0 && (
        <div className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-secondary">📺 Streaming</span>
          <span className="font-bold text-cyan-400">₡{summary.streamingRevenue.toLocaleString()}</span>
        </div>
      )}
      {summary?.totalDamage != null && (
        <div className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-secondary">Damage</span>
          <span className="text-primary">{summary.totalDamage}</span>
        </div>
      )}
    </div>
  );
}

function DuelSummaryContent({ battleLog }: BattleSummaryProps) {
  const r1 = battleLog.robot1!;
  const r2 = battleLog.robot2!;

  return (
    <>
      {/* Robot Names Row */}
      <div className="grid grid-cols-2 gap-4 mb-2 pb-2 border-b border-white/10">
        <div>
          <h3 className="text-lg font-bold text-primary">{r1.name}</h3>
          {r1.owner && <p className="text-secondary text-xs">Pilot: {r1.owner}</p>}
        </div>
        <div className="text-right">
          <h3 className="text-lg font-bold text-primary">{r2.name}</h3>
          {r2.owner && <p className="text-secondary text-xs">Pilot: {r2.owner}</p>}
        </div>
      </div>

      {/* ELO Changes Row */}
      <div className="grid grid-cols-2 gap-4 mb-2 pb-2 border-b border-white/10">
        <EloChangeRow eloBefore={r1.eloBefore} eloAfter={r1.eloAfter} />
        <EloChangeRow eloBefore={r2.eloBefore} eloAfter={r2.eloAfter} />
      </div>

      {/* Rewards & Stats Grid */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <RobotStats robot={r1} />
        <RobotStats robot={r2} />
      </div>

      {/* Streaming Revenue Details */}
      {(r1.streamingRevenueDetails || r2.streamingRevenueDetails) && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-cyan-400">📺 Streaming Revenue Breakdown</h3>
            <div className="text-xs text-secondary italic">
              Earned per battle based on robot stats & Streaming Studio
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            {r1.streamingRevenueDetails && (
              <StreamingBreakdown name={r1.name} details={r1.streamingRevenueDetails} />
            )}
            {r2.streamingRevenueDetails && (
              <StreamingBreakdown name={r2.name} details={r2.streamingRevenueDetails} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function EloChangeRow({ eloBefore, eloAfter }: { eloBefore: number; eloAfter: number }) {
  const diff = eloAfter - eloBefore;
  return (
    <div className="flex items-center justify-between bg-background rounded px-2 py-1.5">
      <span className="text-xs text-secondary">ELO</span>
      <div className="flex items-center gap-1.5 text-sm">
        <span>{eloBefore}</span>
        <span className="text-tertiary">→</span>
        <span className="font-bold">{eloAfter}</span>
        <span className={`text-xs font-bold ${diff >= 0 ? 'text-success' : 'text-error'}`}>
          ({diff > 0 ? '+' : ''}{diff})
        </span>
      </div>
    </div>
  );
}

interface RobotStatsRobot {
  reward?: number;
  prestige?: number;
  fame?: number;
  streamingRevenue?: number;
  finalHP: number;
  maxHP?: number;
  damageDealt: number;
}

function RobotStats({ robot }: { robot: RobotStatsRobot }) {
  return (
    <div className="space-y-1">
      {robot.reward !== undefined && robot.reward !== null && (
        <div className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-secondary">💰 Credits</span>
          <span className="font-bold text-success">₡{robot.reward.toLocaleString()}</span>
        </div>
      )}
      {robot.prestige !== undefined && robot.prestige > 0 && (
        <div className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-secondary">⭐ Prestige</span>
          <span className="font-bold text-purple-400">+{robot.prestige}</span>
        </div>
      )}
      {robot.fame !== undefined && robot.fame > 0 && (
        <div className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-secondary">🎖️ Fame</span>
          <span className="font-bold text-warning">+{robot.fame}</span>
        </div>
      )}
      {robot.streamingRevenue !== undefined && robot.streamingRevenue > 0 && (
        <div className="flex items-center justify-between bg-background rounded px-2 py-1">
          <span className="text-secondary">📺 Streaming</span>
          <span className="font-bold text-cyan-400">₡{robot.streamingRevenue.toLocaleString()}</span>
        </div>
      )}
      <div className="flex items-center justify-between bg-background rounded px-2 py-1">
        <span className="text-secondary">Final HP</span>
        <span>{robot.maxHP ? Math.round((robot.finalHP / robot.maxHP) * 100) : robot.finalHP}%</span>
      </div>
      <div className="flex items-center justify-between bg-background rounded px-2 py-1">
        <span className="text-secondary">Damage</span>
        <span className="text-primary">{robot.damageDealt}</span>
      </div>
    </div>
  );
}

interface StreamingDetails {
  baseAmount: number;
  battleMultiplier: number;
  fameMultiplier: number;
  studioMultiplier: number;
  robotBattles: number;
  robotFame: number;
  studioLevel: number;
}

function StreamingBreakdown({ name, details }: { name: string; details: StreamingDetails }) {
  return (
    <div className="bg-background rounded px-2 py-2 space-y-1">
      <div className="font-semibold text-white mb-1">{name}</div>
      <div className="text-secondary">
        Base: ₡{details.baseAmount.toLocaleString()} × 
        Battles: {details.battleMultiplier.toFixed(2)} × 
        Fame: {details.fameMultiplier.toFixed(2)} × 
        Studio: {details.studioMultiplier.toFixed(2)}
      </div>
      <div className="text-xs text-tertiary">
        ({details.robotBattles} battles, 
        {details.robotFame} fame, 
        Studio L{details.studioLevel})
      </div>
    </div>
  );
}
