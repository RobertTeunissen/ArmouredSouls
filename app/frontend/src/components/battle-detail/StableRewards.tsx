import { Link } from 'react-router-dom';
import type { StableRewardsProps } from './types';
import type { BattleLogParticipant, BattleLogResponse } from '../../utils/matchmakingApi';

/**
 * StableRewards — "Battle Outcomes" section.
 *
 * Uses the unified participants[] array for all battle types.
 * N-column table: one column per robot, same layout for 1v1, tag team, KotH.
 * KotH gets an additional scoring module.
 */
export function StableRewards({ battleLog, selectedRobotIndex }: StableRewardsProps) {
  const participants = battleLog.participants ?? [];

  if (participants.length === 0) {
    return <LegacyStableRewards battleLog={battleLog} />;
  }

  const isKoth = battleLog.battleType === 'koth';

  // Participants are already in canonical order (winner first) from the page.
  return (
    <>
      <OutcomesTable participants={participants} selectedRobotIndex={selectedRobotIndex} />
      {isKoth && <KothScoringModule battleLog={battleLog} participants={participants} selectedRobotIndex={selectedRobotIndex} />}
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function fmtOutcome(p: BattleLogParticipant): string {
  if (p.destroyed) return '💀 Destroyed';
  if (p.yielded) return '🏳️ Yielded';
  const hpPct = p.maxHP > 0 ? Math.round((p.finalHP / p.maxHP) * 100) : null;
  return hpPct !== null ? `✅ ${hpPct}% HP` : '✅ Survived';
}

function fmtElo(p: BattleLogParticipant): string {
  const diff = p.eloAfter - p.eloBefore;
  return `${p.eloBefore} → ${p.eloAfter} (${diff >= 0 ? '+' : ''}${diff})`;
}

function fmtPlacement(placement: number): string {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const medal = medals[placement] ?? '';
  return `${medal} ${placement}${suffixes[placement] || 'th'}`.trim();
}

// ── Unified N-column outcomes table ──────────────────────────────────

function OutcomesTable({ participants, selectedRobotIndex }: { participants: BattleLogParticipant[]; selectedRobotIndex?: number }) {
  const isSingle = selectedRobotIndex !== undefined;
  const display = isSingle ? [participants[selectedRobotIndex] ?? participants[0]] : participants;
  const hasPlacement = participants.some(p => p.placement != null);
  const hasStreaming = participants.some(p => p.streamingRevenue > 0);
  const hasPrestige = participants.some(p => p.prestigeAwarded > 0);
  const hasFame = participants.some(p => p.fameAwarded > 0);
  const hasProgression = hasPrestige || hasFame;

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">🏁 Battle Outcomes</h3>

      <div className={!isSingle && display.length > 2 ? 'overflow-x-auto' : ''}>
        <table className="w-full text-xs border-collapse" style={!isSingle && display.length > 2 ? { minWidth: `${display.length * 150 + 120}px` } : undefined}>
          <thead>
            <tr className="text-secondary">
              <th className="text-left py-1 pr-2 font-medium" style={{ width: isSingle ? '40%' : display.length <= 2 ? '33%' : '120px' }} />
              {display.map(p => (
                <th key={p.robotId} className="text-left py-1 px-2 font-bold text-white truncate max-w-0">
                  <Link to={`/robots/${p.robotId}`} className="text-primary hover:text-white transition-colors">{p.robotName}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasPlacement && (
              <ORow label="Placement" participants={display} render={p => fmtPlacement(p.placement!)} />
            )}
            <ORow label="Result" participants={display} render={p => fmtOutcome(p)} />
            <ORow label="ELO" participants={display} render={p => fmtElo(p)} />

            <OSectionHeader label="Credits" colSpan={display.length + 1} />
            <ORow label="Battle Reward" participants={display} render={p => `₡${p.credits.toLocaleString()}`} />
            {hasStreaming && (
              <ORow label="Streaming" participants={display} render={p => p.streamingRevenue > 0 ? `₡${p.streamingRevenue.toLocaleString()}` : '—'} />
            )}
            <ORow label="Total" participants={display} render={p => `₡${(p.credits + p.streamingRevenue).toLocaleString()}`} bold />

            {hasProgression && (
              <>
                <OSectionHeader label="Progression" colSpan={display.length + 1} />
                {hasPrestige && (
                  <ORow label="⭐ Prestige" participants={display} render={p => p.prestigeAwarded > 0 ? `+${p.prestigeAwarded}` : '—'} />
                )}
                {hasFame && (
                  <ORow label="🎖️ Fame" participants={display} render={p => p.fameAwarded > 0 ? `+${p.fameAwarded}` : '—'} />
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── KotH Scoring Module ──────────────────────────────────────────────

function KothScoringModule({ battleLog, participants, selectedRobotIndex }: { battleLog: BattleLogResponse; participants: BattleLogParticipant[]; selectedRobotIndex?: number }) {
  // Get scoring data from kothParticipants (has zoneScore, zoneTime, kills)
  const kothData = battleLog.kothParticipants ?? [];
  if (kothData.length === 0) return null;

  // Build a map from robotId to koth scoring data
  const kothMap = new Map(kothData.map(k => [k.robotId, k]));

  // Match participant order
  const scored = participants.map(p => ({
    ...p,
    koth: kothMap.get(p.robotId),
  }));

  const hasKills = scored.some(s => (s.koth?.kills ?? 0) > 0);
  const scoreThreshold = (battleLog.kothData as { scoreThreshold?: number } | undefined)?.scoreThreshold;

  const isSingle = selectedRobotIndex !== undefined;
  const display = isSingle ? [scored[selectedRobotIndex] ?? scored[0]] : scored;

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">⛰️ Zone Scoring</h3>
      {scoreThreshold != null && (
        <p className="text-xs text-secondary mb-2">First to {scoreThreshold} zone points wins</p>
      )}

      <div className={!isSingle && display.length > 2 ? 'overflow-x-auto' : ''}>
        <table className="w-full text-xs border-collapse" style={!isSingle && display.length > 2 ? { minWidth: `${display.length * 150 + 120}px` } : undefined}>
          <thead>
            <tr className="text-secondary">
              <th className="text-left py-1 pr-2 font-medium" style={{ width: isSingle ? '40%' : display.length <= 2 ? '33%' : '120px' }} />
              {display.map(s => (
                <th key={s.robotId} className="text-left py-1 px-2 font-bold text-white truncate max-w-0">
                  <Link to={`/robots/${s.robotId}`} className="text-primary hover:text-white transition-colors">{s.robotName}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <KRow label="Zone Score" scored={display} render={s => s.koth?.zoneScore?.toFixed(1) ?? '0'} />
            <KRow label="Zone Time" scored={display} render={s => `${(s.koth?.zoneTime ?? 0).toFixed(1)}s`} />
            {hasKills && (
              <KRow label="Kills" scored={display} render={s => String(s.koth?.kills ?? 0)} />
            )}
            <KRow label="Damage Dealt" scored={display} render={s => String(s.koth?.damageDealt ?? s.damageDealt)} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Table sub-components ─────────────────────────────────────────────

function OSectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr><td colSpan={colSpan} className="pt-2 pb-0.5"><span className="text-xs font-bold text-secondary">{label}</span></td></tr>
  );
}

function ORow({ label, participants, render, bold }: { label: string; participants: BattleLogParticipant[]; render: (p: BattleLogParticipant) => string; bold?: boolean }) {
  const cls = bold ? 'text-white font-bold' : 'text-white font-medium';
  return (
    <tr className="border-t border-white/5">
      <td className="py-0.5 pr-2 text-secondary whitespace-nowrap">{label}</td>
      {participants.map(p => (
        <td key={p.robotId} className={`py-0.5 px-2 ${cls}`}>{render(p)}</td>
      ))}
    </tr>
  );
}

interface ScoredParticipant extends BattleLogParticipant {
  koth?: {
    zoneScore: number;
    zoneTime: number;
    kills: number;
    damageDealt: number;
  };
}

function KRow({ label, scored, render }: { label: string; scored: ScoredParticipant[]; render: (s: ScoredParticipant) => string }) {
  return (
    <tr className="border-t border-white/5">
      <td className="py-0.5 pr-2 text-secondary whitespace-nowrap">{label}</td>
      {scored.map(s => (
        <td key={s.robotId} className="py-0.5 px-2 text-white font-medium">{render(s)}</td>
      ))}
    </tr>
  );
}

// ── Legacy fallback ──────────────────────────────────────────────────

function LegacyStableRewards({ battleLog }: StableRewardsProps) {
  const r1 = battleLog.robot1;
  const r2 = battleLog.robot2;
  if (!r1 || !r2) return null;

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">🏁 Battle Outcomes</h3>
      <div className="text-sm text-secondary">Legacy battle — detailed outcomes not available.</div>
    </div>
  );
}
