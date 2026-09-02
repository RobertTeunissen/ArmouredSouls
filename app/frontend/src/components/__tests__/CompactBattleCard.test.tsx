import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
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
vi.mock('../../utils/teamBattleApi', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getTeamNameFromMatch: vi.fn(() => 'Team Name'),
  };
});

function makeLeagueBattle(overrides: Partial<BattleHistory> = {}): BattleHistory {
  return {
    id: 200,
    battleType: 'league_1v1',
    createdAt: '2026-04-10T12:00:00Z',
    winnerId: 10,
    robot1Id: 10,
    robot2Id: 20,
    robot1: { id: 10, name: 'IronClaw', userId: 1, user: { username: 'testuser' } },
    robot2: { id: 20, name: 'SteelFang', userId: 2, user: { username: 'opponent' } },
    robot1ELOBefore: 1200,
    robot1ELOAfter: 1225,
    robot2ELOBefore: 1150,
    robot2ELOAfter: 1125,
    robot1FinalHP: 80,
    robot2FinalHP: 0,
    winnerReward: 500,
    loserReward: 100,
    durationSeconds: 90,
    leagueType: 'bronze',
    ...overrides,
  } as BattleHistory;
}

const defaultProps = {
  myRobotId: 10,
  eloChange: 25,
  reward: 500,
  outcome: 'win' as const,
  onClick: vi.fn(),
};

describe('CompactBattleCard economic indicators', () => {
  /**
   * Validates: Requirements 7.1
   */
  it('should display prestige indicator when prestige > 0', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        prestige={5}
        {...defaultProps}
      />
    );

    expect(screen.getAllByText('⭐+5').length).toBeGreaterThan(0);
  });

  /**
   * Validates: Requirements 7.2
   */
  it('should display fame indicator when fame > 0', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        fame={3}
        {...defaultProps}
      />
    );

    expect(screen.getAllByText('🎖️+3').length).toBeGreaterThan(0);
  });

  /**
   * Validates: Requirements 7.3
   */
  it('should display total credits (base reward + streaming revenue)', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        streamingRevenue={150}
        reward={500}
        eloChange={25}
        outcome="win"
        myRobotId={10}
        onClick={vi.fn()}
      />
    );

    // Total credits = 500 + 150 = 650
    expect(screen.getAllByText('₡650').length).toBeGreaterThan(0);
  });

  /**
   * Validates: Requirements 7.4
   */
  it('should omit prestige indicator when prestige is 0', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        prestige={0}
        {...defaultProps}
      />
    );

    expect(screen.queryByText(/⭐\+/)).toBeNull();
  });

  /**
   * Validates: Requirements 7.4
   */
  it('should omit prestige indicator when prestige is undefined', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        {...defaultProps}
      />
    );

    expect(screen.queryByText(/⭐\+/)).toBeNull();
  });

  /**
   * Validates: Requirements 7.4
   */
  it('should omit fame indicator when fame is 0', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        fame={0}
        {...defaultProps}
      />
    );

    expect(screen.queryByText(/🎖️\+/)).toBeNull();
  });

  /**
   * Validates: Requirements 7.4
   */
  it('should omit fame indicator when fame is undefined', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        {...defaultProps}
      />
    );

    expect(screen.queryByText(/🎖️\+/)).toBeNull();
  });

  /**
   * Validates: Requirements 7.6
   */
  it('should render prestige in info color (#a371f7)', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        prestige={10}
        {...defaultProps}
      />
    );

    const prestigeElements = screen.getAllByText('⭐+10');
    // At least one element should have the info color class
    const hasInfoColor = prestigeElements.some(
      (el) => el.className.includes('#a371f7') || el.closest('[class*="#a371f7"]') !== null
    );
    expect(hasInfoColor).toBe(true);
  });

  /**
   * Validates: Requirements 7.6
   */
  it('should render fame in warning color (#d29922)', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        fame={7}
        {...defaultProps}
      />
    );

    const fameElements = screen.getAllByText('🎖️+7');
    // At least one element should have the warning color class
    const hasWarningColor = fameElements.some(
      (el) => el.className.includes('#d29922') || el.closest('[class*="#d29922"]') !== null
    );
    expect(hasWarningColor).toBe(true);
  });

  /**
   * Validates: Requirements 7.3
   */
  it('should display only base reward when streamingRevenue is undefined', () => {
    const battle = makeLeagueBattle();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={battle.robot2}
        reward={500}
        eloChange={25}
        outcome="win"
        myRobotId={10}
        onClick={vi.fn()}
      />
    );

    // Total credits = 500 + 0 = 500
    expect(screen.getAllByText('₡500').length).toBeGreaterThan(0);
  });
});

describe('CompactBattleCard bye state', () => {
  it('should prioritize BYE, omit the opponent, and remain keyboard operable', () => {
    const battle = makeLeagueBattle({
      isByeMatch: true,
      winnerId: null,
      robot2Id: null,
      robot2: null,
    });
    const onClick = vi.fn();

    renderWithRouter(
      <CompactBattleCard
        battle={battle}
        myRobot={battle.robot1}
        opponent={null}
        reward={25}
        streamingRevenue={0}
        outcome="win"
        eloChange={0}
        myRobotId={10}
        onClick={onClick}
      />,
    );

    expect(screen.getAllByText('BYE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No opponent — walkover').length).toBeGreaterThan(0);
    expect(screen.queryByText('DRAW')).toBeNull();

    const card = screen.getAllByRole('button', { name: /IronClaw bye result/i })[0];
    expect(card).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('CompactBattleCard responsive and accessible layout', () => {
  it.each([320, 768, 1023, 1024])('should retain reward and bye content without horizontal overflow at %spx', (width) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    const { unmount } = renderWithRouter(
      <CompactBattleCard
        battle={makeLeagueBattle({
          isByeMatch: true,
          winnerId: null,
          robot2Id: null,
          robot2: null,
        })}
        myRobot={makeLeagueBattle().robot1}
        opponent={null}
        reward={25}
        streamingRevenue={0}
        outcome="win"
        eloChange={0}
        myRobotId={10}
        onClick={vi.fn()}
      />,
    );

    const card = screen.getByRole('button', { name: /IronClaw bye result/i });
    expect(card.textContent).toContain('BYE');
    expect(card.textContent).toContain('25');
    expect(card.textContent).toContain('No opponent — walkover');
    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    expect(card.className).toContain('min-h-[44px]');
    expect(Array.from(card.children).some(child => child.className.includes('hidden lg:flex'))).toBe(true);
    expect(Array.from(card.children).some(child => child.className.includes('lg:hidden'))).toBe(true);

    unmount();
  });
});
