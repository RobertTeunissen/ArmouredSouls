import type { BattleDetail, BattleListResponse, BattleListRow, BattleLogResponse, StableRef } from '../types';

export const PLAYER: StableRef = { userId: 1, name: 'Rustbucket Co.', stableType: 'human' };
export const AUTOMATON: StableRef = { userId: 2, name: 'Ferrum Works', stableType: 'automaton' };
export const GENERATED: StableRef = { userId: 3, name: 'auto_bot_412', stableType: 'generated' };

export function row(partial: Partial<BattleListRow> = {}): BattleListRow {
  return {
    id: 531204,
    battleType: 'league_1v1',
    leagueType: 'champion',
    leagueInstanceId: 'champion_2',
    tournament: null,
    sides: [
      { team: 1, label: 'Hammerfall', robotCount: 1, stable: PLAYER, isWinner: true },
      { team: 2, label: 'Vortex-7', robotCount: 1, stable: GENERATED, isWinner: false },
    ],
    field: null,
    participantCount: 2,
    result: 'win',
    endedBy: 'destroyed',
    eloSwing: 12,
    durationSeconds: 48,
    createdAt: '2026-10-25T08:26:00.000Z',
    ...partial,
  };
}

export const KOTH_ROW = row({
  id: 531188,
  battleType: 'koth',
  leagueType: 'koth',
  leagueInstanceId: null,
  sides: [{ team: 1, label: 'Zenith', robotCount: 1, stable: AUTOMATON, isWinner: true }],
  field: { others: 5, othersByStableType: { human: 3, generated: 2, automaton: 0 } },
  participantCount: 6,
  endedBy: 'score_reached',
  eloSwing: null,
  durationSeconds: 130,
});

export const BYE_ROW = row({
  id: 531061,
  sides: [{ team: 1, label: 'Rattler', robotCount: 1, stable: PLAYER, isWinner: true }],
  result: 'bye',
  endedBy: null,
  eloSwing: null,
  durationSeconds: 15,
});

export function listResponse(battles: BattleListRow[] = [row(), KOTH_ROW, BYE_ROW], total = 1284): BattleListResponse {
  return { battles, pagination: { page: 1, limit: 25, total, totalPages: Math.ceil(total / 25) } };
}

export function detail(partial: Partial<BattleDetail> = {}): BattleDetail {
  return {
    id: 531203,
    battleType: 'league_2v2',
    leagueType: 'gold',
    leagueInstanceId: 'gold_3',
    tournament: null,
    scheduledMatchId: 88412,
    tournamentMatchId: null,
    cycleNumber: 47,
    createdAt: '2026-10-25T08:24:00.000Z',
    durationSeconds: 112,
    timeLimitSeconds: 300,
    result: 'win',
    endedBy: 'team_eliminated',
    winningSide: 2,
    winnerRobotId: null,
    sides: [
      { team: 1, label: 'Steel Pact', stable: PLAYER, isWinner: false },
      { team: 2, label: 'Night Shift', stable: AUTOMATON, isWinner: true },
    ],
    participants: [
      {
        robotId: 10, robotName: 'Ironclad', stable: PLAYER, team: 1, role: null, placement: null, finalHP: 0, maxHP: 1850,
        damageDealt: 1204, damageReceived: 1850, criticalHits: 2, eloBefore: 1512, eloAfter: 1503, credits: 9000,
        streamingRevenue: 1240, prestigeAwarded: 0, fameAwarded: 0, destroyed: true, yielded: false, forfeited: false,
        survivalSeconds: 100, zoneScore: null, kills: null,
      },
      {
        robotId: 20, robotName: 'Quasar', stable: AUTOMATON, team: 2, role: null, placement: null, finalHP: 412, maxHP: 1900,
        damageDealt: 1620, damageReceived: 1488, criticalHits: 4, eloBefore: 1530, eloAfter: 1539, credits: 27000,
        streamingRevenue: 1380, prestigeAwarded: 12, fameAwarded: 4, destroyed: false, yielded: false, forfeited: false,
        survivalSeconds: 112, zoneScore: null, kills: null,
      },
    ],
    payout: {
      status: 'mismatch',
      ledgerEntries: 4,
      stables: [
        {
          stable: PLAYER, battleIncome: { participants: 9000, ledger: 9000 }, streaming: { participants: 1240, ledger: 1240 }, status: 'match',
          inputs: { participationFloor: 9000, winComponent: 0, teamSize: 2, modifiers: [], formula: 'battle_income', formulaVersion: '1', outcome: 'loss' },
        },
        {
          stable: AUTOMATON, battleIncome: { participants: 27000, ledger: 25000 }, streaming: { participants: 1380, ledger: 1380 }, status: 'mismatch',
          inputs: { participationFloor: 9000, winComponent: 16000, teamSize: 2, modifiers: [], formula: 'battle_income', formulaVersion: '1', outcome: 'win' },
        },
      ],
    },
    combatLog: { available: true, removesOn: '2026-11-02T01:30:00.000Z', hasFormulas: true, movementSampled: false },
    ...partial,
  };
}

export function logResponse(extraMoves = 0): BattleLogResponse {
  const events: BattleLogResponse['events'] = [
    { timestamp: 8, type: 'movement', attacker: 'Ironclad', message: '🏃 Ironclad moves to (4.2, -3.1) — 6.8 units from Lumen', rangeBand: 'mid' },
    {
      timestamp: 12.4, type: 'attack', attacker: 'Ironclad', defender: 'Quasar', distance: 3.94, rangeBand: 'short',
      message: '💥 Ironclad hits for 142 damage with Plasma Rifle (98 shield, 44 HP)',
      formulaBreakdown: { calculation: 'Hit: 70 base = 80% (rolled 41.0, result: HIT)', components: { hitRoll: 41, hitChance: 80 }, result: 142 },
    },
    { timestamp: 20.1, type: 'miss', attacker: 'Quasar', defender: 'Ironclad', message: '❌ Quasar misses Ironclad with Railgun' },
    { timestamp: 100, type: 'destroyed', defender: 'Ironclad', message: '💀 Ironclad has been destroyed!' },
  ];
  for (let i = 0; i < extraMoves; i++) {
    events.push({ timestamp: 101 + i * 0.1, type: 'movement', attacker: 'Quasar', message: `Quasar moves ${i}` });
  }
  return { battleId: 531203, status: detail().combatLog, events };
}
