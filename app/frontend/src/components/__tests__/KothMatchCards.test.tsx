import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils';
import CompactBattleCard from '../CompactBattleCard';
import { BattleHistory } from '../../utils/matchmakingApi';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useAuth
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' },
    logout: vi.fn(),
  }),
}));

// Mock getTeamNameFromMatch
vi.mock('../../utils/tagTeamApi', () => ({
  getTeamNameFromMatch: vi.fn(() => 'Team Name'),
}));

function makeKothBattle(overrides: Partial<BattleHistory> = {}): BattleHistory {
  return {
    id: 100,
    battleType: 'koth',
    createdAt: '2026-03-15T16:00:00Z',
    winnerId: 10,
    robot1Id: 10,
    robot2Id: 20,
    robot1: { id: 10, name: 'IronClaw', userId: 1, user: { username: 'testuser' } },
    robot2: { id: 20, name: 'SteelFang', userId: 2, user: { username: 'opponent' } },
    robot1ELOBefore: 1200,
    robot1ELOAfter: 1200,
    robot2ELOBefore: 1150,
    robot2ELOAfter: 1150,
    robot1FinalHP: 80,
    robot2FinalHP: 0,
    winnerReward: 500,
    loserReward: 100,
    durationSeconds: 120,
    leagueType: 'koth',
    kothPlacement: 1,
    kothParticipantCount: 6,
    kothZoneScore: 32.5,
    kothRotatingZone: false,
    ...overrides,
  } as BattleHistory;
}

describe('KothMatchCards', () => {
  it('should render 👑 icon and orange border for KotH battle', () => {
    const battle = makeKothBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        outcome="win"
        eloChange={0}
        myRobotId={10}
        reward={500}
        onClick={vi.fn()}
      />
    );

    // Check for 👑 icon
    expect(screen.getAllByText('👑').length).toBeGreaterThan(0);

    // Check for orange border class on the card container
    const card = screen.getAllByText('👑')[0].closest('[class*="border-l-orange-500"]');
    expect(card).toBeTruthy();
  });

  it('should show placement badge instead of WIN/LOSS for KotH', () => {
    const battle = makeKothBattle({ kothPlacement: 1, kothParticipantCount: 6 });

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        outcome="win"
        eloChange={0}
        myRobotId={10}
        reward={500}
        onClick={vi.fn()}
      />
    );

    // Should show "1st of 6" placement badge instead of WIN
    expect(screen.getAllByText('1st of 6').length).toBeGreaterThan(0);

    // Should NOT show WIN/LOSS/DRAW badges
    expect(screen.queryByText('WIN')).toBeNull();
    expect(screen.queryByText('LOSS')).toBeNull();
    expect(screen.queryByText('DRAW')).toBeNull();
  });
});
