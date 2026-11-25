import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { StableRewardsProps } from './types';
import { ordinal } from '../../utils/formatters';
import type { BattleLogParticipant, BattleLogResponse } from '@shared/types';

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
  const medal = medals[placement] ?? '';
  return `${medal} ${ordinal(placement)}`.trim();
}


// ── Shared N-column table ────────────────────────────────────────────

interface RobotColumn {
  robotId: number;
  robotName: string;
}

/** Picks the selected robot's column, or every column when none is selected. */
function displayColumns<T>(columns: T[], selectedRobotIndex?: number): T[] {
  return selectedRobotIndex === undefined ? columns : [columns[selectedRobotIndex] ?? columns[0]];
}

/** One column per robot; wide tables (3+ robots) scroll horizontally. */
function ParticipantTable<T extends RobotColumn>({ columns, isSingle, children }: { columns: T[]; isSingle: boolean; children: ReactNode }) {
  const isWide = !isSingle && columns.length > 2;
  return (
    <div className={isWide ? 'overflow-x-auto' : ''}>
      <table className="w-full text-xs border-collapse" style={isWide ? { minWidth: `${columns.length * 150 + 120}px` } : undefined}>
        <thead>
          <tr className="text-secondary">
            <th className="text-left py-1 pr-2 font-medium" style={{ width: isSingle ? '40%' : columns.length <= 2 ? '33%' : '120px' }} />
            {columns.map(c => (
              <th key={c.robotId} className="text-left py-1 px-2 font-bold text-white truncate max-w-0">
                <Link to={`/robots/${c.robotId}`} className="text-primary hover:text-white transition-colors">{c.robotName}</Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ── Unified N-column outcomes table ──────────────────────────────────

function OutcomesTable({ participants, selectedRobotIndex }: { participants: BattleLogParticipant[]; selectedRobotIndex?: number }) {
  const isSingle = selectedRobotIndex !== undefined;
  const display = displayColumns(participants, selectedRobotIndex);
  const hasPlacement = participants.some(p => p.placement != null);
  const hasStreaming = participants.some(p => p.streamingRevenue > 0);
  const hasPrestige = participants.some(p => p.prestigeAwarded > 0);
  const hasFame = participants.some(p => p.fameAwarded > 0);
  const hasProgression = hasPrestige || hasFame;

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">🏁 Battle Outcomes</h3>

      <ParticipantTable columns={display} isSingle={isSingle}>
        {hasPlacement && (
          <Row label="Placement" columns={display} render={p => fmtPlacement(p.placement!)} />
        )}
        <Row label="Result" columns={display} render={p => fmtOutcome(p)} />
        <Row label="ELO" columns={display} render={p => fmtElo(p)} />

        <SectionHeader label="Credits" colSpan={display.length + 1} />
        <Row label="Battle Reward" columns={display} render={p => `₡${p.credits.toLocaleString()}`} />
        {hasStreaming && (
          <Row label="Streaming" columns={display} render={p => p.streamingRevenue > 0 ? `₡${p.streamingRevenue.toLocaleString()}` : '—'} />
        )}
        <Row label="Total" columns={display} render={p => `₡${(p.credits + p.streamingRevenue).toLocaleString()}`} bold />

        {hasProgression && (
          <>
            <SectionHeader label="Progression" colSpan={display.length + 1} />
            {hasPrestige && (
              <Row label="⭐ Prestige" columns={display} render={p => p.prestigeAwarded > 0 ? `+${p.prestigeAwarded}` : '—'} />
            )}
            {hasFame && (
              <Row label="🎖️ Fame" columns={display} render={p => p.fameAwarded > 0 ? `+${p.fameAwarded}` : '—'} />
            )}
          </>
        )}
      </ParticipantTable>
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
  const display = displayColumns(scored, selectedRobotIndex);

  return (
    <div className="bg-surface rounded-lg mb-3 p-3">
      <h3 className="text-lg font-bold mb-3">⛰️ Zone Scoring</h3>
      {scoreThreshold != null && (
        <p className="text-xs text-secondary mb-2">First to {scoreThreshold} zone points wins</p>
      )}

      <ParticipantTable columns={display} isSingle={isSingle}>
        <Row label="Zone Score" columns={display} render={s => s.koth?.zoneScore?.toFixed(1) ?? '0'} />
        <Row label="Zone Time" columns={display} render={s => `${(s.koth?.zoneTime ?? 0).toFixed(1)}s`} />
        {hasKills && (
          <Row label="Kills" columns={display} render={s => String(s.koth?.kills ?? 0)} />
        )}
        <Row label="Damage Dealt" columns={display} render={s => String(s.koth?.damageDealt ?? s.damageDealt)} />
      </ParticipantTable>
    </div>
  );
}

// ── Table sub-components ─────────────────────────────────────────────

function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr><td colSpan={colSpan} className="pt-2 pb-0.5"><span className="text-xs font-bold text-secondary">{label}</span></td></tr>
  );
}

function Row<T extends RobotColumn>({ label, columns, render, bold }: { label: string; columns: T[]; render: (c: T) => string; bold?: boolean }) {
  const cls = bold ? 'text-white font-bold' : 'text-white font-medium';
  return (
    <tr className="border-t border-white/5">
      <td className="py-0.5 pr-2 text-secondary whitespace-nowrap">{label}</td>
      {columns.map(c => (
        <td key={c.robotId} className={`py-0.5 px-2 ${cls}`}>{render(c)}</td>
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
