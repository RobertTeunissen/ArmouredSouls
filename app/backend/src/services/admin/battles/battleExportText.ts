/**
 * Plain-text export of one battle for pasting into an analysis chat or checking
 * calculations by hand. Pure. Formula lines are the stored calculation text,
 * verbatim; every stored event is included, movement too.
 */
import type { LedgerEntry } from './battlePayoutCheck';
import type { AdminCombatEvent, BattleDetailResponse, BattleParticipantDetail, PlacementPayoutComponent, StableRef } from './battleTypes';

const MODE_LABELS: Record<string, string> = {
  league_1v1: 'League 1v1',
  league_2v2: 'League 2v2',
  league_3v3: 'League 3v3',
  tag_team: 'Tag Team',
  tournament_1v1: 'Tournament 1v1',
  tournament_2v2: 'Tournament 2v2',
  tournament_3v3: 'Tournament 3v3',
  koth: 'King of the Hill',
  grand_melee: 'Grand Melee',
};

const ENDED_BY_LABELS: Record<string, string> = {
  destroyed: 'destroyed',
  yield: 'yield',
  team_eliminated: 'team eliminated',
  time_limit: 'time limit',
  score_reached: 'score reached',
  last_standing: 'last standing',
};

const STABLE_TYPE_LABELS: Record<string, string> = { human: 'Player', generated: 'Generated', automaton: 'Automaton' };

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function formatEventTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${(seconds - m * 60).toFixed(1)}s`;
}

const credits = (n: number | null): string => (n === null ? '—' : `₡${Math.round(n).toLocaleString('en-US')}`);
const int = (n: number | null): string => (n === null ? '—' : Math.round(n).toLocaleString('en-US'));
const round1 = (n: number): string => (Math.round(n * 10) / 10).toString();

function utc(iso: string): string {
  return `${iso.replace('T', ' ').slice(0, 19)} UTC`;
}

function stableText(stable: StableRef | null): string {
  return stable ? `${stable.name} (${STABLE_TYPE_LABELS[stable.stableType] ?? stable.stableType})` : 'Unknown stable';
}

function headerLines(d: BattleDetailResponse): string[] {
  const mode = MODE_LABELS[d.battleType] ?? d.battleType;
  const where = d.tournament
    ? `${d.tournament.name}${d.tournament.round !== null ? ` · round ${d.tournament.round}` : ''}`
    : `${d.leagueType}${d.leagueInstanceId ? ` (${d.leagueInstanceId})` : ''}`;
  const context = [
    `Fought ${utc(d.createdAt)}`,
    d.cycleNumber !== null ? `cycle ${d.cycleNumber}` : null,
    d.scheduledMatchId !== null ? `scheduled match #${d.scheduledMatchId}` : null,
    d.tournamentMatchId !== null ? `bracket match #${d.tournamentMatchId}` : null,
  ].filter(Boolean).join(' · ');

  let result: string;
  if (d.result === 'bye') result = 'Bye (no opponent)';
  else if (d.result === 'forfeit') result = 'Forfeit';
  else if (d.result === 'draw') result = 'Draw';
  else if (d.winnerRobotId !== null && d.sides.length === 0) {
    const w = d.participants.find(p => p.robotId === d.winnerRobotId);
    result = `${w?.robotName ?? 'Unknown'} won (${stableText(w?.stable ?? null)})`;
  } else {
    const side = d.sides.find(s => s.isWinner);
    result = side ? `Side ${side.team} won (${side.label} · ${stableText(side.stable)})` : 'Win';
  }
  const ended = d.endedBy ? ` · ${ENDED_BY_LABELS[d.endedBy] ?? d.endedBy}` : '';
  return [
    `# Battle #${d.id} · ${mode} · ${where}`,
    context,
    `Result: ${result}${ended} · ${formatDuration(d.durationSeconds)} (limit ${formatDuration(d.timeLimitSeconds)})`,
  ];
}

/** The simulator's battle-start event: its calculation text is each robot's setup at battle time. */
function isSetupEvent(e: AdminCombatEvent): boolean {
  const fb = e.formulaBreakdown as { components?: Record<string, unknown>; calculation?: unknown } | undefined;
  return typeof fb?.calculation === 'string' && fb.components !== undefined
    && 'participantCount' in fb.components && 'arenaRadius' in fb.components;
}

function setupLines(events: readonly AdminCombatEvent[]): string[] {
  const setups = events.filter(isSetupEvent);
  if (setups.length === 0) return ['Not recorded in the stored log.'];
  return setups.flatMap((e) => {
    const calc = String((e.formulaBreakdown as { calculation: string }).calculation);
    const prefix = setups.length > 1 ? [`At ${formatEventTime(e.timestamp)}:`] : [];
    return [...prefix, ...calc.split('\n').map(l => `- ${l}`)];
  });
}

function notes(p: BattleParticipantDetail): string {
  const out: string[] = [];
  if (p.forfeited) out.push('forfeited');
  if (p.destroyed) out.push(p.exitSeconds !== null ? `destroyed at ${formatEventTime(p.exitSeconds)}` : 'destroyed');
  if (p.yielded) out.push(p.exitSeconds !== null ? `yielded at ${formatEventTime(p.exitSeconds)}` : 'yielded');
  if (!p.destroyed && !p.yielded && !p.forfeited && p.exitSeconds !== null) out.push(`tagged out at ${formatEventTime(p.exitSeconds)}`);
  if (p.survivalSeconds !== null && (p.destroyed || p.yielded || p.exitSeconds !== null)) out.push(`active ${formatEventTime(p.survivalSeconds)}`);
  if (p.placement !== null) out.push(`placement ${p.placement}`);
  if (p.zoneScore !== null) out.push(`zone score ${round1(p.zoneScore)}`);
  if (p.kills !== null && p.kills > 0) out.push(`${p.kills} kills`);
  return out.join(', ');
}

function table(rows: string[][]): string[] {
  const widths = rows[0].map((_, i) => Math.max(...rows.map(r => r[i].length)));
  return rows.map(r => r.map((c, i) => c.padEnd(widths[i])).join(' | ').trimEnd());
}

function resultLines(d: BattleDetailResponse): string[] {
  if (d.participants.length === 0) return ['No participant rows (robots deleted).'];
  const header = ['Robot', 'Side', 'Stable', 'End HP', 'Damage', 'Received', 'ELO', 'Credits', 'Streaming', 'Prestige', 'Fame', 'Notes'];
  const rows = d.participants.map(p => [
    p.robotName,
    String(p.team),
    stableText(p.stable),
    p.maxHP !== null ? `${int(p.finalHP)} / ${int(p.maxHP)}` : int(p.finalHP),
    int(p.damageDealt),
    int(p.damageReceived),
    `${p.eloBefore} → ${p.eloAfter} (${p.eloAfter - p.eloBefore >= 0 ? '+' : ''}${p.eloAfter - p.eloBefore})`,
    credits(p.credits),
    credits(p.streamingRevenue),
    String(p.prestigeAwarded),
    String(p.fameAwarded),
    notes(p),
  ]);
  return table([header, ...rows]);
}

function payoutLines(d: BattleDetailResponse): string[] {
  if (d.payout.status === 'unavailable') return ['No ledger entries found for this battle.'];
  return d.payout.stables.flatMap((s) => {
    const lines = [
      `${stableText(s.stable)}: battle income ${credits(s.battleIncome.participants)} (ledger ${credits(s.battleIncome.ledger)})`
        + ` · streaming ${credits(s.streaming.participants)} (ledger ${credits(s.streaming.ledger)}) · ${s.status}`,
    ];
    const i = s.inputs;
    if (i?.placementComponents) {
      // KotH / Grand Melee: the floor/win components are zero; the award is per robot and placement.
      const meta = [
        i.formula ? `formula ${i.formula}${i.formulaVersion ? ` v${i.formulaVersion}` : ''}` : null,
        i.outcome ? `outcome ${i.outcome}` : null,
      ].filter(Boolean).join(' · ');
      for (const c of i.placementComponents) lines.push(`  ${placementComponentText(c, credits)}`);
      const total = i.placementComponents.reduce((sum, c) => sum + c.credits, 0);
      lines.push(`  total ${credits(total)}${meta ? ` · ${meta}` : ''}`);
    } else if (i) {
      const parts = [
        i.participationFloor !== null ? `participationFloor ${int(i.participationFloor)}` : null,
        i.winComponent !== null ? `winComponent ${int(i.winComponent)}` : null,
      ].filter(Boolean).join(' + ');
      const extra = [
        i.teamSize !== null ? `teamSize ${i.teamSize}` : null,
        i.modifiers.length > 0 ? `modifiers ${JSON.stringify(i.modifiers)}` : 'no modifiers',
        i.formula ? `formula ${i.formula}${i.formulaVersion ? ` v${i.formulaVersion}` : ''}` : null,
        i.outcome ? `outcome ${i.outcome}` : null,
      ].filter(Boolean).join(' · ');
      lines.push(`  ${parts}${parts ? ' · ' : ''}${extra}`);
    }
    return lines;
  });
}

/** "Name · placement 2 · tier gold: ₡7,500 × 1.5 × 0.7 × 1.25 zone dominance = ₡9,844" for one placement award. */
export function placementComponentText(c: PlacementPayoutComponent, formatCredits: (n: number) => string): string {
  const factors = [
    formatCredits(c.tierBaseReward),
    `${c.modeBaseMultiplier}`,
    `${c.placementMultiplier}${c.participationFloorApplied ? ' (participation floor)' : ''}`,
    ...(c.bonus ? [`${c.bonus.multiplier} ${c.bonus.label}`] : []),
  ];
  return `${c.robotName ?? `Robot #${c.robotId}`} · placement ${c.placement} · tier ${c.tier}: ${factors.join(' × ')} = ${formatCredits(c.credits)}`;
}

function stateText(e: AdminCombatEvent): string | null {
  const hp = e.robotHP as Record<string, number> | undefined;
  if (!hp) return null;
  const shield = (e.robotShield as Record<string, number> | undefined) ?? {};
  const names = [e.attacker, e.defender].filter((n): n is string => typeof n === 'string' && n in hp);
  if (names.length === 0) return null;
  return `HP/shield after: ${[...new Set(names)].map(n => `${n} ${round1(hp[n])}/${round1(shield[n] ?? 0)}`).join(', ')}`;
}

const FORMULA_EVENT_TYPES = new Set(['attack', 'critical', 'miss', 'counter', 'malfunction']);

export function eventLines(e: AdminCombatEvent): string[] {
  const details: string[] = [];
  if (typeof e.distance === 'number') details.push(`${round1(e.distance)} u`);
  if (typeof e.rangeBand === 'string') details.push(e.rangeBand);
  if (e.backstab === true) details.push('backstab');
  const head = `[${formatEventTime(e.timestamp)}] ${e.type} · ${e.message ?? ''}${details.length > 0 ? ` · ${details.join(', ')}` : ''}`;
  const lines = [head];
  if (FORMULA_EVENT_TYPES.has(e.type)) {
    const state = stateText(e);
    if (state) lines.push(`    ${state}`);
  }
  const fb = e.formulaBreakdown as { calculation?: unknown; result?: unknown } | undefined;
  if (typeof fb?.calculation === 'string' && !isSetupEvent(e)) {
    for (const l of fb.calculation.split('\n')) lines.push(`    ${l}`);
  }
  return lines;
}

export function buildBattleExportText(
  detail: BattleDetailResponse,
  events: readonly AdminCombatEvent[],
  ledgerEntries: readonly LedgerEntry[],
): string {
  const lines: string[] = [...headerLines(detail), ''];

  lines.push('## Robots at battle start', ...(detail.combatLog.available ? setupLines(events) : ['Combat log removed (retention).']), '');
  lines.push('## Results', ...resultLines(detail), '');
  lines.push(`## Payouts vs ledger (${detail.payout.status}, ${ledgerEntries.length} ledger entries)`, ...payoutLines(detail), '');

  if (!detail.combatLog.available) {
    lines.push('## Combat events', `Combat log removed on ${detail.combatLog.removesOn.slice(0, 10)} (retention). Participants and payouts above are permanent.`);
  } else {
    const notesOnStorage: string[] = [];
    if (!detail.combatLog.hasFormulas) notesOnStorage.push('stored without formula breakdowns');
    if (detail.combatLog.movementSampled) notesOnStorage.push('movement, range and shield-regen events thinned before storage');
    lines.push(`## Combat events (${events.length})${notesOnStorage.length > 0 ? ` — ${notesOnStorage.join('; ')}` : ''}`);
    for (const e of events) lines.push(...eventLines(e));
  }
  return `${lines.join('\n')}\n`;
}
