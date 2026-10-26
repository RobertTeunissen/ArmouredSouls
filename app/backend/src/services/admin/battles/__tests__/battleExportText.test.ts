import { buildBattleExportText, eventLines, formatDuration, formatEventTime } from '../battleExportText';
import type { AdminCombatEvent, BattleDetailResponse } from '../battleTypes';

const detail = (overrides: Partial<BattleDetailResponse> = {}): BattleDetailResponse => ({
  id: 531203,
  battleType: 'league_2v2',
  leagueType: 'gold',
  leagueInstanceId: 'gold_3',
  tournament: null,
  scheduledMatchId: 88412,
  tournamentMatchId: null,
  cycleNumber: 47,
  createdAt: '2026-10-25T08:24:13.000Z',
  durationSeconds: 112,
  timeLimitSeconds: 300,
  result: 'win',
  endedBy: 'team_eliminated',
  winningSide: 2,
  winnerRobotId: null,
  sides: [
    { team: 1, label: 'Steel Pact', stable: { userId: 1, name: 'Rustbucket Co.', stableType: 'human' }, isWinner: false },
    { team: 2, label: 'Night Shift', stable: { userId: 2, name: 'Ferrum Works', stableType: 'automaton' }, isWinner: true },
  ],
  participants: [{
    robotId: 10, robotName: 'Ironclad', stable: { userId: 1, name: 'Rustbucket Co.', stableType: 'human' }, team: 1, role: null,
    placement: null, finalHP: 0, maxHP: 1850, damageDealt: 1204, damageReceived: 1850, criticalHits: 2,
    eloBefore: 1512, eloAfter: 1503, credits: 9000, streamingRevenue: 1240, prestigeAwarded: 0, fameAwarded: 0,
    destroyed: true, yielded: false, forfeited: false, survivalSeconds: 100, zoneScore: null, kills: null,
  }],
  payout: {
    status: 'match',
    ledgerEntries: 2,
    stables: [{
      stable: { userId: 1, name: 'Rustbucket Co.', stableType: 'human' },
      battleIncome: { participants: 9000, ledger: 9000 },
      streaming: { participants: 1240, ledger: 1240 },
      status: 'match',
      inputs: { participationFloor: 9000, winComponent: 0, teamSize: 2, modifiers: [], formula: 'battle_income', formulaVersion: '1', outcome: 'loss' },
    }],
  },
  combatLog: { available: true, removesOn: '2026-11-02T01:30:00.000Z', hasFormulas: true, movementSampled: false },
  ...overrides,
});

const setupEvent: AdminCombatEvent = {
  timestamp: 0, type: 'attack', message: '⚔ Battle commences!',
  formulaBreakdown: { calculation: 'Ironclad (offensive): 1850HP/1850HP\nArena: radius 16', components: { arenaRadius: 16, participantCount: 4 }, result: 0 },
};
const hitEvent: AdminCombatEvent = {
  timestamp: 12.4, type: 'attack', message: 'Ironclad hits for 142 damage with Plasma Rifle (98 shield, 44 HP)',
  attacker: 'Ironclad', defender: 'Lumen', distance: 3.94, rangeBand: 'short',
  robotHP: { Ironclad: 1850, Lumen: 1656 }, robotShield: { Ironclad: 600, Lumen: 0 },
  formulaBreakdown: { calculation: 'Hit: 70 base = 80% (rolled 41.0, result: HIT)\nDamage: 9.3 base × 1.4 = 142', components: {}, result: 142 },
};
const moveEvent: AdminCombatEvent = {
  timestamp: 8, type: 'movement', message: 'Ironclad moves to (4.2, -3.1) — 6.8 units from Lumen', attacker: 'Ironclad', rangeBand: 'mid',
};

describe('formatting helpers', () => {
  it('formats durations as minutes and seconds', () => {
    expect(formatDuration(48)).toBe('48s');
    expect(formatDuration(112)).toBe('1m 52s');
    expect(formatEventTime(64.3)).toBe('1m 4.3s');
    expect(formatEventTime(12.4)).toBe('12.4s');
  });
});

describe('eventLines', () => {
  it('includes the HP state and every stored calculation line verbatim', () => {
    expect(eventLines(hitEvent)).toEqual([
      '[12.4s] attack · Ironclad hits for 142 damage with Plasma Rifle (98 shield, 44 HP) · 3.9 u, short',
      '    HP/shield after: Ironclad 1850/600, Lumen 1656/0',
      '    Hit: 70 base = 80% (rolled 41.0, result: HIT)',
      '    Damage: 9.3 base × 1.4 = 142',
    ]);
  });

  it('keeps movement events as one line', () => {
    expect(eventLines(moveEvent)).toEqual(['[8.0s] movement · Ironclad moves to (4.2, -3.1) — 6.8 units from Lumen · mid']);
  });
});

describe('buildBattleExportText', () => {
  it('has the header, battle-time setup, results, payouts and all events in order', () => {
    const text = buildBattleExportText(detail(), [setupEvent, moveEvent, hitEvent], []);
    expect(text).toContain('# Battle #531203 · League 2v2 · gold (gold_3)');
    expect(text).toContain('Fought 2026-10-25 08:24:13 UTC · cycle 47 · scheduled match #88412');
    expect(text).toContain('Result: Side 2 won (Night Shift · Ferrum Works (Automaton)) · team eliminated · 1m 52s (limit 5m 0s)');
    expect(text).toContain('## Robots at battle start\n- Ironclad (offensive): 1850HP/1850HP\n- Arena: radius 16');
    expect(text).toMatch(/Ironclad +\| 1 +\| Rustbucket Co\. \(Player\)/);
    expect(text).toContain('destroyed at 1m 40.0s');
    expect(text).toContain('Rustbucket Co. (Player): battle income ₡9,000 (ledger ₡9,000) · streaming ₡1,240 (ledger ₡1,240) · match');
    expect(text).toContain('participationFloor 9,000 + winComponent 0 · teamSize 2 · no modifiers · formula battle_income v1 · outcome loss');
    expect(text).toContain('## Combat events (3)');
    expect(text.indexOf('[8.0s] movement')).toBeLessThan(text.indexOf('[12.4s] attack'));
    // The setup event's calculation is in the setup section, not repeated in the events.
    expect(text.match(/Arena: radius 16/g)).toHaveLength(1);
  });

  it('says when the log was removed and keeps the permanent sections', () => {
    const text = buildBattleExportText(
      detail({ combatLog: { available: false, removesOn: '2026-10-18T01:30:00.000Z', hasFormulas: true, movementSampled: false } }),
      [],
      [],
    );
    expect(text).toContain('Combat log removed on 2026-10-18 (retention).');
    expect(text).toContain('## Results');
  });

  it('notes KotH / Grand Melee storage limits', () => {
    const text = buildBattleExportText(
      detail({ battleType: 'koth', sides: [], combatLog: { available: true, removesOn: '2026-11-02T01:30:00.000Z', hasFormulas: false, movementSampled: true } }),
      [moveEvent],
      [],
    );
    expect(text).toContain('stored without formula breakdowns; movement, range and shield-regen events thinned before storage');
  });
});
