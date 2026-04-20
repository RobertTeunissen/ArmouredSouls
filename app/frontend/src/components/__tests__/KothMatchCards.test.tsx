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

const defaultKothProps = {
  myRobotId: 10,
  eloChange: 0,
  reward: 500,
  outcome: 'win' as const,
  onClick: vi.fn(),
};

describe('KothMatchCards', () => {
  it('should render 👑 icon and orange border for KotH battle', () => {
    const battle = makeKothBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        prestige={3}
        fame={2}
        streamingRevenue={50}
        {...defaultKothProps}
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
        prestige={5}
        fame={3}
        streamingRevenue={100}
        {...defaultKothProps}
      />
    );

    // Should show "1st of 6" placement badge instead of WIN
    expect(screen.getAllByText('1st of 6').length).toBeGreaterThan(0);

    // Should NOT show WIN/LOSS/DRAW badges
    expect(screen.queryByText('WIN')).toBeNull();
    expect(screen.queryByText('LOSS')).toBeNull();
    expect(screen.queryByText('DRAW')).toBeNull();
  });

  /**
   * Validates: Requirements 7.1, 7.2
   */
  it('should display prestige and fame indicators on KotH battle cards', () => {
    const battle = makeKothBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        prestige={8}
        fame={4}
        {...defaultKothProps}
      />
    );

    // Prestige indicator should render
    expect(screen.getAllByText('⭐+8').length).toBeGreaterThan(0);

    // Fame indicator should render
    expect(screen.getAllByText('🎖️+4').length).toBeGreaterThan(0);
  });

  /**
   * Validates: Requirements 7.4
   */
  it('should omit prestige and fame indicators when not provided on KotH cards', () => {
    const battle = makeKothBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        {...defaultKothProps}
      />
    );

    // Neither indicator should render
    expect(screen.queryByText(/⭐\+/)).toBeNull();
    expect(screen.queryByText(/🎖️\+/)).toBeNull();
  });

  /**
   * Validates: Requirements 7.1, 7.2
   */
  it('should display prestige and fame with correct colors on KotH cards', () => {
    const battle = makeKothBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        prestige={10}
        fame={6}
        {...defaultKothProps}
      />
    );

    // Prestige should use info color (#a371f7)
    const prestigeElements = screen.getAllByText('⭐+10');
    const hasPrestigeColor = prestigeElements.some(
      (el) => el.className.includes('#a371f7') || el.closest('[class*="#a371f7"]') !== null
    );
    expect(hasPrestigeColor).toBe(true);

    // Fame should use warning color (#d29922)
    const fameElements = screen.getAllByText('🎖️+6');
    const hasFameColor = fameElements.some(
      (el) => el.className.includes('#d29922') || el.closest('[class*="#d29922"]') !== null
    );
    expect(hasFameColor).toBe(true);
  });

  /**
   * Validates: Requirements 7.4
   */
  it('should display total credits including streaming revenue on KotH cards', () => {
    const battle = makeKothBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        streamingRevenue={200}
        reward={500}
        eloChange={0}
        outcome="win"
        myRobotId={10}
        onClick={vi.fn()}
      />
    );

    // Total credits = 500 + 200 = 700
    expect(screen.getAllByText('₡700').length).toBeGreaterThan(0);
  });
});
