/**
 * Battle detail sections that had no tests: Combat Messages (1v1 and team
 * formats), Arena Summary (movement, positions, range bands) and Battle
 * Outcomes (rewards table, KotH zone scoring, mobile single column).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CombatMessages } from '../CombatMessages';
import { ArenaSummary } from '../ArenaSummary';
import { StableRewards } from '../StableRewards';
import type { BattleLogEvent, BattleLogParticipant, BattleLogResponse } from '../../../utils/matchmakingApi';

function participant(overrides: Partial<BattleLogParticipant> = {}): BattleLogParticipant {
  return {
    robotId: 1, robotName: 'Alpha', owner: 'Stable A', ownerId: 10, imageUrl: null,
    teamIndex: 0, team: 1, role: null, placement: null,
    finalHP: 50, maxHP: 100, maxShield: 20, destroyed: false, yielded: false, damageDealt: 300,
    eloBefore: 1200, eloAfter: 1216, credits: 5000, streamingRevenue: 0, prestigeAwarded: 0, fameAwarded: 0,
    stance: 'balanced', loadoutType: 'single', mainWeaponName: 'Laser', mainWeaponRangeBand: 'mid',
    offhandWeaponName: null, offhandWeaponRangeBand: null,
    ...overrides,
  };
}

function battleLog(overrides: Partial<BattleLogResponse> = {}, events: BattleLogEvent[] = []): BattleLogResponse {
  return {
    battleId: 7, createdAt: '2026-11-01T00:00:00Z', battleType: 'league', leagueType: 'bronze', duration: 42,
    winner: 'robot1', battleLog: { events },
    ...overrides,
  } as BattleLogResponse;
}

function event(type: string, message: string, timestamp = 1, extra: Record<string, unknown> = {}): BattleLogEvent {
  return { type, message, timestamp, ...extra };
}

describe('CombatMessages', () => {
  it('lists combat events with their time and hides reward and economy lines', () => {
    render(<CombatMessages battleLog={battleLog({}, [
      event('battle_start', 'Battle begins', 0),
      event('attack', 'Alpha hits Bravo for 40', 2.25),
      event('reward_summary', 'Rewards were paid', 40),
      event('info', 'Winner (Alpha) earns ₡5,000', 41),
      event('info', 'Fame: +3 for Alpha', 41),
    ])} />);

    expect(screen.getByText('Battle begins')).toBeInTheDocument();
    expect(screen.getByText('Alpha hits Bravo for 40')).toBeInTheDocument();
    expect(screen.getByText('2.3s')).toBeInTheDocument();
    expect(screen.queryByText('Rewards were paid')).not.toBeInTheDocument();
    expect(screen.queryByText(/₡5,000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fame: \+3/)).not.toBeInTheDocument();
  });

  it('marks tag-outs and tag-ins with an icon', () => {
    render(<CombatMessages battleLog={battleLog({}, [event('tag_out', 'Alpha tags out'), event('tag_in', 'Gamma tags in')])} />);
    expect(screen.getByText('🔄')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  it('says so when there are no events', () => {
    render(<CombatMessages battleLog={battleLog()} />);
    expect(screen.getByText('No combat messages available for this battle.')).toBeInTheDocument();
  });

  it('turns structured team-battle events into readable messages', () => {
    const log = battleLog({
      battleType: 'league_2v2',
      participants: [participant(), participant({ robotId: 2, robotName: 'Bravo', team: 2 })],
      battleLog: {
        teamBattle: true,
        events: [
          { type: 'elimination', tick: 10, timestamp: 12, robotId: 2, team: 2, eliminatedByRobotId: 1 },
          { type: 'focus_fire', tick: 5, timestamp: 6, targetRobotId: 2, contributorRobotIds: [1, 3], bonusApplied: 0.125 },
          { type: 'draw_timeout', tick: 99, timestamp: 120, durationSeconds: 120 },
          { type: 'movement', tick: 1, timestamp: 1 },
        ],
      } as unknown as BattleLogResponse['battleLog'],
    });
    render(<CombatMessages battleLog={log} />);

    expect(screen.getByText('Bravo (Team 2) was eliminated by Alpha')).toBeInTheDocument();
    expect(screen.getByText('Focus fire on Bravo by Alpha, Robot #3 (+12.5% damage bonus)')).toBeInTheDocument();
    expect(screen.getByText('Battle ended in a draw after 120s (time limit reached)')).toBeInTheDocument();
    expect(screen.queryByText(/movement event/)).not.toBeInTheDocument();
  });

  it('prefers the detailed team-battle messages when they are stored', () => {
    const log = battleLog({
      battleType: 'tag_team',
      battleLog: {
        teamBattle: true,
        events: [{ type: 'elimination', tick: 1, timestamp: 1, robotId: 2, team: 2 }],
        detailedCombatEvents: [event('attack', 'Alpha strikes Bravo', 3), event('info', 'Paid 200 credits', 4)],
      } as unknown as BattleLogResponse['battleLog'],
    });
    render(<CombatMessages battleLog={log} />);

    expect(screen.getByText('Alpha strikes Bravo')).toBeInTheDocument();
    expect(screen.queryByText(/credits/)).not.toBeInTheDocument();
    expect(screen.queryByText(/was eliminated/)).not.toBeInTheDocument();
  });
});

describe('ArenaSummary', () => {
  it('renders nothing without an arena radius', () => {
    const { container } = render(<ArenaSummary battleLog={battleLog()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sums each robot\'s movement and shows start, end and range band shares', () => {
    const log = battleLog({
      battleLog: {
        arenaRadius: 20,
        startingPositions: { Alpha: { x: 0, y: 0 }, Bravo: { x: 10, y: 0 } },
        endingPositions: { Alpha: { x: 6, y: 8 }, Bravo: { x: 10, y: 0 } },
        events: [
          event('move', 'Alpha moves', 1, { positions: { Alpha: { x: 3, y: 4 }, Bravo: { x: 10, y: 0 } }, rangeBand: 'mid' }),
          event('move', 'Alpha moves', 2, { positions: { Alpha: { x: 6, y: 8 } }, rangeBand: 'melee' }),
          event('attack', 'Alpha hits', 3, { rangeBand: 'melee' }),
          event('attack', 'Bravo hits', 4, { rangeBand: 'long' }),
        ],
      },
    });
    render(<ArenaSummary battleLog={log} />);

    expect(screen.getByText('20 units')).toBeInTheDocument();
    expect(screen.getByText('40 units')).toBeInTheDocument();
    // Alpha: (0,0) → (3,4) → (6,8) = 5 + 5
    expect(within(screen.getByText('Alpha moved').parentElement!).getByText('10.0 units')).toBeInTheDocument();
    expect(within(screen.getByText('Bravo moved').parentElement!).getByText('0.0 units')).toBeInTheDocument();
    expect(screen.getAllByText('(6.0, 8.0)')).toHaveLength(1);
    // 2 of 4 range-band events are melee
    expect(within(screen.getByText('melee').parentElement!).getByText('50%')).toBeInTheDocument();
    expect(within(screen.getByText('short').parentElement!).getByText('0%')).toBeInTheDocument();
  });

  it('reads the arena from the stored summary once the playback log is pruned', () => {
    const log = battleLog({
      battleLog: { events: [] },
      summary: {
        arenaRadius: 15, startingPositions: { Alpha: { x: 1, y: 2 } }, endingPositions: { Alpha: { x: 4, y: 6 } },
      } as unknown as BattleLogResponse['summary'],
    });
    render(<ArenaSummary battleLog={log} />);
    expect(screen.getByText('15 units')).toBeInTheDocument();
    expect(screen.getByText('(1.0, 2.0)')).toBeInTheDocument();
    expect(screen.getByText('(4.0, 6.0)')).toBeInTheDocument();
  });
});

describe('StableRewards', () => {
  function renderRewards(log: BattleLogResponse, selectedRobotIndex?: number) {
    return render(
      <MemoryRouter>
        <StableRewards battleLog={log} selectedRobotIndex={selectedRobotIndex} />
      </MemoryRouter>,
    );
  }

  it('shows each robot\'s result, ELO change and credits, linked to its page', () => {
    renderRewards(battleLog({
      participants: [
        participant({ streamingRevenue: 1500, prestigeAwarded: 4 }),
        participant({ robotId: 2, robotName: 'Bravo', destroyed: true, eloBefore: 1210, eloAfter: 1194, credits: 1000 }),
      ],
    }));

    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/robots/1');
    expect(screen.getByText('✅ 50% HP')).toBeInTheDocument();
    expect(screen.getByText('💀 Destroyed')).toBeInTheDocument();
    expect(screen.getByText('1200 → 1216 (+16)')).toBeInTheDocument();
    expect(screen.getByText('1210 → 1194 (-16)')).toBeInTheDocument();
    expect(screen.getByText('₡6,500')).toBeInTheDocument();
    expect(screen.getByText('+4')).toBeInTheDocument();
    // Fame row only appears when someone earned fame
    expect(screen.queryByText('🎖️ Fame')).not.toBeInTheDocument();
  });

  it('shows one column for the selected robot on mobile', () => {
    renderRewards(battleLog({
      participants: [participant(), participant({ robotId: 2, robotName: 'Bravo' })],
    }), 1);
    expect(screen.getByRole('link', { name: 'Bravo' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Alpha' })).not.toBeInTheDocument();
  });

  it('adds placements and KotH zone scoring', () => {
    renderRewards(battleLog({
      battleType: 'koth',
      participants: [
        participant({ placement: 1 }),
        participant({ robotId: 2, robotName: 'Bravo', placement: 2 }),
        participant({ robotId: 3, robotName: 'Gamma', placement: 11, yielded: true }),
      ],
      kothParticipants: [
        { robotId: 1, zoneScore: 30, zoneTime: 45.25, kills: 1, damageDealt: 400 },
        { robotId: 2, zoneScore: 12.5, zoneTime: 20, kills: 0, damageDealt: 250 },
      ],
      kothData: { scoreThreshold: 30 },
    } as unknown as Partial<BattleLogResponse>));

    expect(screen.getByText('🥇 1st')).toBeInTheDocument();
    expect(screen.getByText('🥈 2nd')).toBeInTheDocument();
    expect(screen.getByText('11th')).toBeInTheDocument();
    expect(screen.getByText('🏳️ Yielded')).toBeInTheDocument();
    expect(screen.getByText('First to 30 zone points wins')).toBeInTheDocument();
    expect(screen.getByText('45.3s')).toBeInTheDocument();
    expect(screen.getByText('Kills')).toBeInTheDocument();
  });

  it('falls back to a notice for legacy battles without participants', () => {
    renderRewards(battleLog({
      robot1: { id: 1, name: 'Alpha', owner: 'A', eloBefore: 1, eloAfter: 2, finalHP: 1, damageDealt: 1 },
      robot2: { id: 2, name: 'Bravo', owner: 'B', eloBefore: 1, eloAfter: 2, finalHP: 1, damageDealt: 1 },
    }));
    expect(screen.getByText('Legacy battle — detailed outcomes not available.')).toBeInTheDocument();
  });
});
