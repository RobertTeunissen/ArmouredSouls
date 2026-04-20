import { Link } from 'react-router-dom';
import { AttributeTooltip } from './AttributeTooltip';
import type { BattleStatisticsSummaryProps } from './types';
import type { RobotCombatStats } from '../../utils/battleStatistics';
import { createRobotStats } from '../../utils/battleStatistics';
import type { BattleLogParticipant, BattleLogResponse } from '../../utils/matchmakingApi';

/**
 * BattleStatisticsSummary — unified combat statistics table.
 *
 * One rendering path for all battle types (1v1, tag team, KotH).
 * Dynamic columns based on number of robots.
 * 2 robots: side-by-side table. 3+: horizontally scrollable table.
 */
export function BattleStatisticsSummary({
  statistics,
  battleType,
  robot1Name,
  battleLog,
  selectedRobotIndex,
}: BattleStatisticsSummaryProps) {
  if (!statistics.hasData) {
    return (
      <div className="bg-surface rounded-lg mb-3 p-3">
        <h3 className="text-lg font-bold mb-3">📊 Combat Statistics</h3>
        <p className="text-sm text-secondary">No combat data available</p>
      </div>
    );
  }

  // Order robots to match participants[] — canonical order computed once by the page.
  // Create empty stats for participants that never entered combat (e.g. tag team reserves).
  let robots = statistics.perRobot;
  const participants = battleLog?.participants ?? [];
  if (participants.length > 0) {
    const robotByName = new Map(robots.map(r => [r.robotName, r]));
    const reordered = participants.map(p => robotByName.get(p.robotName) ?? createRobotStats(p.robotName));
    robots = reordered;
  } else if (robots.length === 2 && robot1Name && robots[0].robotName !== robot1Name && robots[1].robotName === robot1Name) {
    robots = [robots[1], robots[0]];
  }

  // Get participant info for each robot (stance, weapons) from the unified participants array
  const participantMap = new Map(participants.map(p => [p.robotName, p]));

  // Mobile: show single robot
  const isSingleRobot = selectedRobotIndex !== undefined;
  const displayRobots = isSingleRobot ? [robots[selectedRobotIndex] ?? robots[0]] : robots;

  const dur = statistics.battleDuration || 1;
  const hasOffhand = robots.some(r => r.offhand !== null);
  const hasCounters = robots.some(r => r.counters.triggered > 0);
  const hasHitGrades = robots.some(r => {
    const g = r.hitGrades;
    return g.glancing + g.solid + g.heavy + g.devastating > 0;
  });
  const hasShieldRecharged = robots.some(r => r.shieldRecharged > 0);
  const isKoth = battleType === 'koth';
  const hasTargetSwitches = robots.some(r => r.targetSwitches > 0);

  /** Per-robot active duration for interval/DPS — falls back to battle duration */
  const activeDur = (r: RobotCombatStats): number => r.activeDuration > 0 ? r.activeDuration : dur;

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">📊 Combat Statistics</h3>

      <div className={!isSingleRobot && displayRobots.length > 2 ? 'overflow-x-auto' : ''}>
        <table className="w-full text-xs border-collapse" style={!isSingleRobot && displayRobots.length > 2 ? { minWidth: `${displayRobots.length * 150 + 120}px` } : undefined}>
          <thead>
            <tr className="text-secondary">
              <th className="text-left py-1 pr-2 font-medium" style={{ width: isSingleRobot ? '40%' : displayRobots.length <= 2 ? '33%' : '120px' }} />
              {displayRobots.map(r => {
                const p = participantMap.get(r.robotName);
                return (
                  <th key={r.robotName} className="text-left py-1 px-2 font-bold text-white truncate max-w-0">
                    {p ? <Link to={`/robots/${p.robotId}`} className="text-primary hover:text-white transition-colors">{r.robotName}</Link> : r.robotName}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* ── Robot Info ── */}
            {participants.length > 0 && (
              <>
                <NRow label="Stance" robots={displayRobots} render={r => fmtStance(participantMap.get(r.robotName)?.stance)} />
                <NRow label="Main Weapon" robots={displayRobots} render={r => {
                  const p = participantMap.get(r.robotName);
                  return p?.mainWeaponName ? `${p.mainWeaponName} (${p.mainWeaponRangeBand ?? '?'})` : '—';
                }} />
                {participants.some(p => p.offhandWeaponName) && (
                  <NRow label="Offhand Weapon" robots={displayRobots} render={r => {
                    const p = participantMap.get(r.robotName);
                    return p?.offhandWeaponName ? `${p.offhandWeaponName} (${p.offhandWeaponRangeBand ?? '?'})` : '—';
                  }} />
                )}
              </>
            )}

            {/* ── Attacks ── */}
            <NSectionHeader label="Attacks" colSpan={displayRobots.length + 1} />
            <NRow label="Active Time" robots={displayRobots} render={r => `${activeDur(r).toFixed(1)}s`} extra={r => fmtStatus(r, participantMap, battleLog)} />
            <NRow label="Opportunities" robots={displayRobots} render={r => r.attacks} extra={r => `~${(activeDur(r) / Math.max(r.attacks, 1)).toFixed(1)}s`} tooltipStat="attackSpeed" />
            <NRow label="Malfunctions" robots={displayRobots} render={r => r.malfunctions} extra={r => fmtExp(safePct(r.malfunctions, r.attacks), r.expectedMalfunctionChance)} tooltipStat="malfunction" />
            <NRow label="Effective" robots={displayRobots} render={r => r.attacks - r.malfunctions} extra={r => fmtPct(r.attacks - r.malfunctions, r.attacks)} />
            <NRow label="Hits" robots={displayRobots} render={r => r.hits} extra={r => fmtExp(safePct(r.hits, r.attacks - r.malfunctions), r.expectedHitChance)} tooltipStat="hitRate" />
            <NRow label="Misses" robots={displayRobots} render={r => r.misses} extra={r => fmtPct(r.misses, r.attacks - r.malfunctions)} />
            <NRow label="Criticals" robots={displayRobots} render={r => r.criticals} extra={r => fmtExp(safePct(r.criticals, r.hits), r.expectedCritChance)} tooltipStat="critRate" />

            {/* ── Offhand ── */}
            {hasOffhand && (
              <>
                <NSectionHeader label="Offhand" colSpan={displayRobots.length + 1} />
                <NRow label="Opportunities" robots={displayRobots} render={r => r.offhand?.attacks ?? 0} extra={r => r.offhand && r.offhand.attacks > 0 ? `~${(activeDur(r) / r.offhand.attacks).toFixed(1)}s` : undefined} tooltipStat="attackSpeed" />
                <NRow label="Malfunctions" robots={displayRobots} render={r => r.offhand?.malfunctions ?? 0} extra={r => r.offhand ? fmtExp(safePct(r.offhand.malfunctions, r.offhand.attacks), r.expectedOffhandMalfunctionChance) : undefined} tooltipStat="malfunction" />
                <NRow label="Effective" robots={displayRobots} render={r => (r.offhand?.attacks ?? 0) - (r.offhand?.malfunctions ?? 0)} extra={r => fmtPct((r.offhand?.attacks ?? 0) - (r.offhand?.malfunctions ?? 0), r.offhand?.attacks ?? 0)} />
                <NRow label="Hits" robots={displayRobots} render={r => r.offhand?.hits ?? 0} extra={r => r.offhand ? fmtExp(safePct(r.offhand.hits, (r.offhand.attacks) - (r.offhand.malfunctions)), r.expectedOffhandHitChance) : undefined} tooltipStat="offhandHitRate" />
                <NRow label="Misses" robots={displayRobots} render={r => r.offhand?.misses ?? 0} extra={r => fmtPct(r.offhand?.misses ?? 0, (r.offhand?.attacks ?? 0) - (r.offhand?.malfunctions ?? 0))} />
                <NRow label="Criticals" robots={displayRobots} render={r => r.offhand?.criticals ?? 0} extra={r => r.offhand ? fmtExp(safePct(r.offhand.criticals, r.offhand.hits), r.expectedOffhandCritChance) : undefined} tooltipStat="critRate" />
              </>
            )}

            {/* ── Counters ── */}
            {hasCounters && (
              <>
                <NSectionHeader label="Counters" colSpan={displayRobots.length + 1} />
                <NRow label="Triggered" robots={displayRobots} render={r => r.counters.triggered} extra={r => r.expectedCounterChance !== null ? `exp ${r.expectedCounterChance.toFixed(1)}%` : undefined} />
                <NRow label="Hits" robots={displayRobots} render={r => r.counters.hits} extra={r => fmtExp(safePct(r.counters.hits, r.counters.triggered), r.expectedCounterHitChance)} />
                <NRow label="Misses" robots={displayRobots} render={r => r.counters.misses} extra={r => fmtPct(r.counters.misses, r.counters.triggered)} />
              </>
            )}

            {/* ── Hit Severity ── */}
            {hasHitGrades && (
              <>
                <NSectionHeader label="Hit Severity" colSpan={displayRobots.length + 1} />
                <NRow label="Breakdown" robots={displayRobots} render={r => fmtGrades(r.hitGrades)} tooltipStat="hitSeverity" />
              </>
            )}

            {/* ── Damage Dealt ── */}
            <NSectionHeader label="Damage Dealt" colSpan={displayRobots.length + 1} />
            <NRow label="Total" robots={displayRobots} render={r => r.damageDealt} extra={r => `${(r.damageDealt / activeDur(r)).toFixed(1)} DPS`} tooltipStat="damage" />

            {/* ── Damage Taken ── */}
            <NSectionHeader label="Damage Taken" colSpan={displayRobots.length + 1} />
            <NRow label="Total" robots={displayRobots} render={r => r.damageReceived} />
            <NRow label="Shield Absorbed" robots={displayRobots} render={r => r.shieldDamageAbsorbed} tooltipStat="shieldCapacity" />
            <NRow label="HP Lost" robots={displayRobots} render={r => r.hpDamageReceived} />
            {hasShieldRecharged && (
              <NRow label="Shield Recharged" robots={displayRobots} render={r => r.shieldRecharged} tooltipStat="shieldRegen" />
            )}

            {/* ── Targeting (KotH / multi-robot) ── */}
            {(isKoth || hasTargetSwitches) && (
              <>
                <NSectionHeader label="Targeting" colSpan={displayRobots.length + 1} />
                <NRow label="Target Switches" robots={displayRobots} render={r => r.targetSwitches} />
                {allTargetNames(robots).map(target => (
                  <NRow key={target} label={`→ ${target}`} robots={displayRobots} render={r => {
                    const secs = r.targetDurations[target];
                    return secs != null ? `${secs.toFixed(1)}s` : '—';
                  }} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function safePct(n: number, d: number): number {
  return d === 0 ? 0 : (n / d) * 100;
}

function fmtExp(actual: number, expected: number | null | undefined): string {
  const a = (actual ?? 0).toFixed(1);
  if (expected === null || expected === undefined) return `${a}%`;
  return `${a}% (exp ${expected.toFixed(1)}%)`;
}

function fmtPct(n: number, d: number): string {
  return d === 0 ? '0%' : `${((n / d) * 100).toFixed(1)}%`;
}

const STANCE_DISPLAY: Record<string, string> = {
  offensive: '⚡ Offensive',
  defensive: '🛡️ Defensive',
  balanced: '⚖️ Balanced',
};

function fmtStance(stance?: string): string {
  if (!stance) return '—';
  return STANCE_DISPLAY[stance] ?? stance;
}

function fmtStatus(r: RobotCombatStats, participantMap: Map<string, BattleLogParticipant>, battleLog?: BattleLogResponse): string {
  const p = participantMap.get(r.robotName);
  if (p?.destroyed) return '💀 destroyed';
  if (p?.yielded) return '🏳️ yielded';

  // Tag team: show tag-out/tag-in timing for active/reserve roles
  if (battleLog?.battleType === 'tag_team' && battleLog.tagTeam && p?.role) {
    const team = p.team === 1 ? battleLog.tagTeam.team1 : battleLog.tagTeam.team2;
    const tagOutTime = team.tagOutTime;
    if (tagOutTime != null) {
      if (p.role === 'active') return `🔄 tagged out at ${tagOutTime.toFixed(1)}s`;
      if (p.role === 'reserve') return `🔄 tagged in at ${tagOutTime.toFixed(1)}s`;
    }
    if (p.role === 'reserve' && r.attacks === 0) return '🪑 never entered';
  }

  return '✅ survived';
}

function fmtGrades(g: RobotCombatStats['hitGrades']): string {
  const parts: string[] = [];
  if (g.glancing > 0) parts.push(`${g.glancing} glancing`);
  if (g.solid > 0) parts.push(`${g.solid} solid`);
  if (g.heavy > 0) parts.push(`${g.heavy} heavy`);
  if (g.devastating > 0) parts.push(`${g.devastating} devastating`);
  return parts.join(', ') || '—';
}

/** Collect all unique target names across all robots, sorted by total time descending. */
function allTargetNames(robots: RobotCombatStats[]): string[] {
  const totals = new Map<string, number>();
  for (const r of robots) {
    for (const [name, secs] of Object.entries(r.targetDurations)) {
      totals.set(name, (totals.get(name) ?? 0) + secs);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/* ── N-column table components ───────────────────────────────────── */

function NSectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="pt-2 pb-0.5">
        <span className="text-xs font-bold text-secondary">{label}</span>
      </td>
    </tr>
  );
}

function NRow({
  label,
  robots,
  render,
  extra,
  tooltipStat,
}: {
  label: string;
  robots: RobotCombatStats[];
  render: (r: RobotCombatStats) => number | string;
  extra?: (r: RobotCombatStats) => string | undefined;
  tooltipStat?: string;
}) {
  return (
    <tr className="border-t border-white/5">
      <td className="py-0.5 pr-2 text-secondary whitespace-nowrap">
        <span className="flex items-center gap-1">
          {label}
          {tooltipStat && <AttributeTooltip statName={tooltipStat} />}
        </span>
      </td>
      {robots.map(r => {
        const val = render(r);
        const ext = extra?.(r);
        return (
          <td key={r.robotName} className="py-0.5 px-2 text-white font-medium">
            {val}{ext && <span className="text-secondary ml-1">{ext}</span>}
          </td>
        );
      })}
    </tr>
  );
}
