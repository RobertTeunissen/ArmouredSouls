import { Link } from 'react-router-dom';
import type { BattleLogResponse, BattleLogParticipant, TeamBattleLog } from '../../utils/matchmakingApi';
import { isTeamBattleLog } from '../../utils/matchmakingApi';

interface TeamBattleMetricsProps {
  battleLog: BattleLogResponse;
  /** When true, renders vertical stacked layout for mobile */
  isMobile?: boolean;
}

/**
 * TeamBattleMetrics — renders team battle-specific data:
 * - Per-robot stats grouped by team (damageDealt, damageTaken, finalHP, survivalSeconds)
 * - Team-level coordination metrics (focus fire, ally support, formation defence)
 * - Team LP/ELO deltas
 *
 * Only renders for league_2v2 and league_3v3 battle types.
 */
export function TeamBattleMetrics({ battleLog, isMobile }: TeamBattleMetricsProps) {
  const log = battleLog.battleLog;
  if (!isTeamBattleLog(log)) return null;

  const participants = battleLog.participants ?? [];
  if (participants.length === 0) return null;

  // Use the display order from the page (user's/winning team first).
  // The first participant's team number is the "home" team for display purposes.
  const homeTeamNumber = participants[0]?.team ?? 1;
  const awayTeamNumber = homeTeamNumber === 1 ? 2 : 1;

  const homeParticipants = participants.filter(p => p.team === homeTeamNumber);
  const awayParticipants = participants.filter(p => p.team === awayTeamNumber);

  // Get per-robot stats from the team battle log
  const tbParticipants = log.participants ?? [];
  const tbParticipantMap = new Map(tbParticipants.map(p => [p.robotId, p]));

  // Map coordination metrics to home/away order
  const homeMetrics = {
    focusFire: homeTeamNumber === 1 ? log.focusFireMetrics.team1 : log.focusFireMetrics.team2,
    allySupport: homeTeamNumber === 1 ? log.allySupportMetrics.team1 : log.allySupportMetrics.team2,
    formationDefence: homeTeamNumber === 1 ? log.formationDefenceMetrics.team1 : log.formationDefenceMetrics.team2,
  };
  const awayMetrics = {
    focusFire: awayTeamNumber === 1 ? log.focusFireMetrics.team1 : log.focusFireMetrics.team2,
    allySupport: awayTeamNumber === 1 ? log.allySupportMetrics.team1 : log.allySupportMetrics.team2,
    formationDefence: awayTeamNumber === 1 ? log.formationDefenceMetrics.team1 : log.formationDefenceMetrics.team2,
  };

  return (
    <div className="space-y-3">
      {/* Per-Robot Stats by Team */}
      <TeamRobotStats
        team1={homeParticipants}
        team2={awayParticipants}
        tbParticipantMap={tbParticipantMap}
        isMobile={isMobile}
        winningSide={log.winningSide === homeTeamNumber ? 1 : log.winningSide === awayTeamNumber ? 2 : null}
      />

      {/* Team Coordination Metrics */}
      <TeamCoordinationMetrics
        log={log}
        team1={homeParticipants}
        team2={awayParticipants}
        homeMetrics={homeMetrics}
        awayMetrics={awayMetrics}
      />
    </div>
  );
}

// ── Per-Robot Stats by Team ──────────────────────────────────────────

function TeamRobotStats({
  team1,
  team2,
  tbParticipantMap,
  isMobile,
  winningSide,
}: {
  team1: BattleLogParticipant[];
  team2: BattleLogParticipant[];
  tbParticipantMap: Map<number, { robotId: number; team: 1 | 2; damageDealt: number; damageTaken: number; finalHP: number; survivalSeconds: number }>;
  isMobile?: boolean;
  winningSide: 1 | 2 | null;
}) {
  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">⚔️ Team Performance</h3>

      {isMobile ? (
        /* Mobile: vertical stacking — Team 1 then Team 2 */
        <div className="space-y-4">
          <TeamStatsBlock
            label="Team 1"
            participants={team1}
            tbParticipantMap={tbParticipantMap}
            isWinner={winningSide === 1}
          />
          <div className="border-t border-white/10" />
          <TeamStatsBlock
            label="Team 2"
            participants={team2}
            tbParticipantMap={tbParticipantMap}
            isWinner={winningSide === 2}
          />
        </div>
      ) : (
        /* Desktop: side-by-side teams */
        <div className="grid grid-cols-2 gap-4">
          <TeamStatsBlock
            label="Team 1"
            participants={team1}
            tbParticipantMap={tbParticipantMap}
            isWinner={winningSide === 1}
          />
          <TeamStatsBlock
            label="Team 2"
            participants={team2}
            tbParticipantMap={tbParticipantMap}
            isWinner={winningSide === 2}
          />
        </div>
      )}
    </div>
  );
}

function TeamStatsBlock({
  label,
  participants,
  tbParticipantMap,
  isWinner,
}: {
  label: string;
  participants: BattleLogParticipant[];
  tbParticipantMap: Map<number, { robotId: number; team: 1 | 2; damageDealt: number; damageTaken: number; finalHP: number; survivalSeconds: number }>;
  isWinner: boolean;
}) {
  const winnerBadge = isWinner ? ' 🏆' : '';
  const ownerName = participants[0]?.owner ?? 'Unknown';

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className={`text-sm font-bold ${isWinner ? 'text-success' : 'text-secondary'}`}>
          {label}{winnerBadge}
        </h4>
        <span className="text-xs text-secondary">
          (<Link to={`/stables/${participants[0]?.ownerId}`} className="text-primary hover:text-white transition-colors">{ownerName}</Link>)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-secondary">
              <th className="text-left py-1 pr-2 font-medium" style={{ width: '100px' }} />
              {participants.map(p => (
                <th key={p.robotId} className="text-left py-1 px-2 font-bold text-white truncate max-w-0">
                  <Link to={`/robots/${p.robotId}`} className="text-primary hover:text-white transition-colors">
                    {p.robotName}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <StatRow
              label="Damage Dealt"
              participants={participants}
              render={p => {
                const tb = tbParticipantMap.get(p.robotId);
                return tb ? tb.damageDealt.toFixed(1) : p.damageDealt.toFixed(1);
              }}
            />
            <StatRow
              label="Damage Taken"
              participants={participants}
              render={p => {
                const tb = tbParticipantMap.get(p.robotId);
                return tb ? tb.damageTaken.toFixed(1) : '—';
              }}
            />
            <StatRow
              label="Final HP"
              participants={participants}
              render={p => {
                const tb = tbParticipantMap.get(p.robotId);
                const hp = tb ? tb.finalHP : p.finalHP;
                const pct = p.maxHP > 0 ? Math.round((hp / p.maxHP) * 100) : 0;
                if (hp <= 0) return '💀 0';
                return `${hp.toFixed(0)} (${pct}%)`;
              }}
            />
            <StatRow
              label="Survival"
              participants={participants}
              render={p => {
                const tb = tbParticipantMap.get(p.robotId);
                if (!tb) return '—';
                return `${tb.survivalSeconds.toFixed(1)}s`;
              }}
            />
            <StatRow
              label="Status"
              participants={participants}
              render={p => {
                if (p.destroyed) return '💀 Destroyed';
                if (p.yielded) return '🏳️ Yielded';
                return '✅ Survived';
              }}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatRow({
  label,
  participants,
  render,
}: {
  label: string;
  participants: BattleLogParticipant[];
  render: (p: BattleLogParticipant) => string;
}) {
  return (
    <tr className="border-t border-white/5">
      <td className="py-0.5 pr-2 text-secondary whitespace-nowrap">{label}</td>
      {participants.map(p => (
        <td key={p.robotId} className="py-0.5 px-2 text-white font-medium">
          {render(p)}
        </td>
      ))}
    </tr>
  );
}

// ── Team Coordination Metrics ────────────────────────────────────────

function TeamCoordinationMetrics({
  log,
  team1,
  team2,
  homeMetrics,
  awayMetrics,
}: {
  log: TeamBattleLog;
  team1: BattleLogParticipant[];
  team2: BattleLogParticipant[];
  homeMetrics: { focusFire: number; allySupport: number; formationDefence: number };
  awayMetrics: { focusFire: number; allySupport: number; formationDefence: number };
}) {
  const team1Owner = team1[0]?.owner ?? 'Team 1';
  const team2Owner = team2[0]?.owner ?? 'Team 2';

  // Compute ELO deltas from participants
  const team1EloDelta = team1.reduce((sum, p) => sum + (p.eloAfter - p.eloBefore), 0);
  const team2EloDelta = team2.reduce((sum, p) => sum + (p.eloAfter - p.eloBefore), 0);

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">🤝 Team Coordination</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-secondary">
              <th className="text-left py-1 pr-2 font-medium" style={{ width: '45%' }} />
              <th className="text-left py-1 px-2 font-bold text-white">{team1Owner}</th>
              <th className="text-left py-1 px-2 font-bold text-white">{team2Owner}</th>
            </tr>
          </thead>
          <tbody>
            <MetricRow
              label="🎯 Focus Fire Total"
              team1Value={homeMetrics.focusFire.toFixed(1)}
              team2Value={awayMetrics.focusFire.toFixed(1)}
            />
            <MetricRow
              label="🛡️ Ally Support Total"
              team1Value={homeMetrics.allySupport.toFixed(1)}
              team2Value={awayMetrics.allySupport.toFixed(1)}
            />
            <MetricRow
              label="🏰 Formation Defence Total"
              team1Value={homeMetrics.formationDefence.toFixed(1)}
              team2Value={awayMetrics.formationDefence.toFixed(1)}
            />
            <MetricRow
              label="📊 Team ELO Delta"
              team1Value={formatDelta(team1EloDelta)}
              team2Value={formatDelta(team2EloDelta)}
              highlight
            />
          </tbody>
        </table>
      </div>

      {/* Focus fire event count */}
      {log.focusFireEvents && log.focusFireEvents.length > 0 && (
        <p className="text-xs text-secondary mt-2">
          {log.focusFireEvents.length} focus fire event{log.focusFireEvents.length !== 1 ? 's' : ''} detected during battle
        </p>
      )}
    </div>
  );
}

function MetricRow({
  label,
  team1Value,
  team2Value,
  highlight,
}: {
  label: string;
  team1Value: string;
  team2Value: string;
  highlight?: boolean;
}) {
  const cls = highlight ? 'text-white font-bold' : 'text-white font-medium';
  return (
    <tr className="border-t border-white/5">
      <td className="py-1 pr-2 text-secondary whitespace-nowrap">{label}</td>
      <td className={`py-1 px-2 ${cls}`}>{team1Value}</td>
      <td className={`py-1 px-2 ${cls}`}>{team2Value}</td>
    </tr>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatDelta(value: number): string {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}
