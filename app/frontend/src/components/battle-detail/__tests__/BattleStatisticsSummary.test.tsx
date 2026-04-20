import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BattleStatisticsSummary } from '../BattleStatisticsSummary';
import type { BattleStatistics, RobotCombatStats, TeamCombatStats } from '../../../utils/battleStatistics';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRobotStats(overrides: Partial<RobotCombatStats> & { robotName: string }): RobotCombatStats {
  return {
    mainHand: { attacks: 5, hits: 3, misses: 1, criticals: 1, malfunctions: 0 },
    offhand: null,
    attacks: 5,
    hits: 3,
    misses: 1,
    criticals: 1,
    malfunctions: 0,
    counters: { triggered: 0, hits: 0, misses: 0, damageDealt: 0 },
    countersReceived: 0,
    shieldDamageAbsorbed: 0,
    shieldRecharged: 0,
    damageDealt: 50,
    damageReceived: 30,
    hpDamageDealt: 40,
    hpDamageReceived: 25,
    hitRate: 60,
    critRate: 33.3,
    malfunctionRate: 0,
    expectedHitChance: null,
    expectedCritChance: null,
    expectedMalfunctionChance: null,
    expectedCounterChance: null,
    expectedCounterHitChance: null,
    expectedOffhandHitChance: null,
    expectedOffhandCritChance: null,
    expectedOffhandMalfunctionChance: null,
    hitGrades: { glancing: 0, solid: 2, heavy: 1, devastating: 0 },
    activeDuration: 60,
    firstAttackTime: 0,
    exitTime: null,
    targetSwitches: 0,
    uniqueTargets: 1,
    targetDurations: {},
    ...overrides,
  };
}

/** Wrap component in MemoryRouter since it uses <Link> */
function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function makeEmptyStatistics(): BattleStatistics {
  return { perRobot: [], perTeam: null, damageFlows: [], battleDuration: 60, totalEvents: 0, hasData: false };
}

function makeDuelStatistics(): BattleStatistics {
  return {
    perRobot: [
      makeRobotStats({ robotName: 'Alpha' }),
      makeRobotStats({ robotName: 'Beta', damageDealt: 30, damageReceived: 50 }),
    ],
    perTeam: null,
    damageFlows: [
      { source: 'Alpha', target: 'Beta', value: 50 },
      { source: 'Beta', target: 'Alpha', value: 30 },
    ],
    battleDuration: 90,
    totalEvents: 10,
    hasData: true,
  };
}

function makeTagTeamStatistics(): BattleStatistics {
  const t1a = makeRobotStats({ robotName: 'T1-Active', damageDealt: 40, damageReceived: 20 });
  const t1r = makeRobotStats({ robotName: 'T1-Reserve', damageDealt: 25, damageReceived: 15 });
  const t2a = makeRobotStats({ robotName: 'T2-Active', damageDealt: 20, damageReceived: 40 });
  const t2r = makeRobotStats({ robotName: 'T2-Reserve', damageDealt: 15, damageReceived: 25 });

  const team1: TeamCombatStats = {
    teamName: 'Team 1', robots: [t1a, t1r],
    totalDamageDealt: 65, totalDamageReceived: 35, totalHits: 6, totalMisses: 2, totalCriticals: 2,
  };
  const team2: TeamCombatStats = {
    teamName: 'Team 2', robots: [t2a, t2r],
    totalDamageDealt: 35, totalDamageReceived: 65, totalHits: 6, totalMisses: 2, totalCriticals: 2,
  };

  return {
    perRobot: [t1a, t1r, t2a, t2r], perTeam: [team1, team2],
    damageFlows: [], battleDuration: 120, totalEvents: 20, hasData: true,
  };
}

function makeKothStatistics(): BattleStatistics {
  const robots = ['R1', 'R2', 'R3', 'R4'].map((name, i) =>
    makeRobotStats({ robotName: name, damageDealt: 30 + i * 10, damageReceived: 20 + i * 5 }),
  );
  return { perRobot: robots, perTeam: null, damageFlows: [], battleDuration: 180, totalEvents: 40, hasData: true };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BattleStatisticsSummary', () => {
  // Validates: Requirements 1.1, 1.2
  describe('renders per-robot stats for 1v1 battle', () => {
    it('should display both robot names', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeDuelStatistics()} battleType="league" />);
      expect(screen.getByText('📊 Combat Statistics')).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('should display attack stats in comparison table', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeDuelStatistics()} battleType="league" />);
      expect(screen.getByText('Opportunities')).toBeInTheDocument();
      expect(screen.getByText('Hits')).toBeInTheDocument();
      expect(screen.getByText('Misses')).toBeInTheDocument();
    });

    it('should display rates as percentages on attack rows', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeDuelStatistics()} battleType="league" />);
      // Rates are now inline on the Hits/Criticals/Malfunctions rows
      // Check that percentage values appear
      expect(screen.getAllByText('60.0%').length).toBeGreaterThanOrEqual(1);
    });

    it('should display damage section', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeDuelStatistics()} battleType="league" />);
      expect(screen.getByText('Damage Dealt')).toBeInTheDocument();
      expect(screen.getByText('Damage Taken')).toBeInTheDocument();
      expect(screen.getByText('HP Lost')).toBeInTheDocument();
    });
  });

  // Validates: Requirement 1.5 — unified N-column table for tag team (all 4 robots as columns)
  describe('renders all robots for tag_team battle', () => {
    it('should display all individual robot names as columns', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeTagTeamStatistics()} battleType="tag_team" />);
      expect(screen.getByText('T1-Active')).toBeInTheDocument();
      expect(screen.getByText('T1-Reserve')).toBeInTheDocument();
      expect(screen.getByText('T2-Active')).toBeInTheDocument();
      expect(screen.getByText('T2-Reserve')).toBeInTheDocument();
    });

    it('should display attack and damage sections for tag team', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeTagTeamStatistics()} battleType="tag_team" />);
      expect(screen.getByText('Attacks')).toBeInTheDocument();
      expect(screen.getByText('Damage Dealt')).toBeInTheDocument();
      expect(screen.getByText('Damage Taken')).toBeInTheDocument();
    });
  });

  // Validates: Requirement 1.3, 1.6
  describe('renders all participants for koth battle', () => {
    it('should display all 4 robot names', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeKothStatistics()} battleType="koth" />);
      expect(screen.getByText('R1')).toBeInTheDocument();
      expect(screen.getByText('R2')).toBeInTheDocument();
      expect(screen.getByText('R3')).toBeInTheDocument();
      expect(screen.getByText('R4')).toBeInTheDocument();
    });

    it('should use horizontally scrollable table for 4+ robots', () => {
      const { container } = renderWithRouter(<BattleStatisticsSummary statistics={makeKothStatistics()} battleType="koth" />);
      // The wrapper div should have overflow-x-auto for 3+ robots
      const scrollWrapper = container.querySelector('.overflow-x-auto');
      expect(scrollWrapper).toBeInTheDocument();
    });
  });

  // Validates: Requirement 8.4
  describe('renders "No combat data available" for empty events', () => {
    it('should display empty state message when hasData is false', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeEmptyStatistics()} />);
      expect(screen.getByText('No combat data available')).toBeInTheDocument();
    });

    it('should not render any stat rows when hasData is false', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeEmptyStatistics()} />);
      expect(screen.queryByText('Hit Rate')).not.toBeInTheDocument();
    });
  });

  // Validates: Requirement 1.4
  describe('AttributeTooltip shows correct attribute names on hover', () => {
    it('should show attribute info on hover', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeDuelStatistics()} battleType="league" />);
      const infoButtons = screen.getAllByRole('button', { name: 'Show attribute info' });
      expect(infoButtons.length).toBeGreaterThan(0);
      // First tooltip is on Opportunities (attackSpeed) — attacker only
      fireEvent.mouseEnter(infoButtons[0]);
      expect(screen.getByText('⚔️ Attacker')).toBeInTheDocument();
      expect(screen.getByText('Attack Speed')).toBeInTheDocument();
    });
  });

  // Validates: Requirement 1.8
  describe('renders offhand section for dual-wield robots', () => {
    it('should display Offhand section when a robot has offhand stats', () => {
      const dualWieldRobot = makeRobotStats({
        robotName: 'DualBot',
        offhand: { attacks: 3, hits: 1, misses: 1, criticals: 1, malfunctions: 0 },
        attacks: 8, hits: 4, misses: 2, criticals: 2, malfunctions: 0,
      });
      const singleRobot = makeRobotStats({ robotName: 'SingleBot' });
      const stats: BattleStatistics = {
        perRobot: [dualWieldRobot, singleRobot],
        perTeam: null, damageFlows: [], battleDuration: 60, totalEvents: 10, hasData: true,
      };
      renderWithRouter(<BattleStatisticsSummary statistics={stats} battleType="league" />);
      // The "Offhand" section label should appear
      expect(screen.getByText('Offhand')).toBeInTheDocument();
    });

    it('should not display Offhand section when no robot has offhand', () => {
      renderWithRouter(<BattleStatisticsSummary statistics={makeDuelStatistics()} battleType="league" />);
      expect(screen.queryByText('Offhand')).not.toBeInTheDocument();
    });
  });
});
