import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { TeamBattleMetrics } from '../TeamBattleMetrics';
import type { BattleLogResponse } from '../../../utils/matchmakingApi';

function createTeamBattleLog(overrides?: Partial<BattleLogResponse>): BattleLogResponse {
  return {
    battleId: 1,
    createdAt: '2024-01-01T00:00:00Z',
    battleType: 'league_2v2',
    leagueType: 'bronze',
    leagueInstanceId: 'inst-1',
    duration: 120,
    winner: 'robot1',
    participants: [
      {
        robotId: 1,
        robotName: 'Alpha',
        owner: 'Stable A',
        ownerId: 10,
        imageUrl: null,
        teamIndex: 0,
        team: 1,
        role: null,
        placement: null,
        finalHP: 50,
        maxHP: 100,
        maxShield: 20,
        destroyed: false,
        yielded: false,
        damageDealt: 80,
        eloBefore: 1000,
        eloAfter: 1015,
        credits: 18000,
        streamingRevenue: 500,
        prestigeAwarded: 10,
        fameAwarded: 5,
        stance: 'offensive',
        loadoutType: 'dual_wield',
        mainWeaponName: 'Laser',
        mainWeaponRangeBand: 'medium',
        offhandWeaponName: 'Shield',
        offhandWeaponRangeBand: 'close',
      },
      {
        robotId: 2,
        robotName: 'Beta',
        owner: 'Stable A',
        ownerId: 10,
        imageUrl: null,
        teamIndex: 0,
        team: 1,
        role: null,
        placement: null,
        finalHP: 30,
        maxHP: 100,
        maxShield: 20,
        destroyed: false,
        yielded: false,
        damageDealt: 60,
        eloBefore: 1000,
        eloAfter: 1015,
        credits: 18000,
        streamingRevenue: 500,
        prestigeAwarded: 10,
        fameAwarded: 5,
        stance: 'defensive',
        loadoutType: 'single',
        mainWeaponName: 'Cannon',
        mainWeaponRangeBand: 'long',
        offhandWeaponName: null,
        offhandWeaponRangeBand: null,
      },
      {
        robotId: 3,
        robotName: 'Gamma',
        owner: 'Stable B',
        ownerId: 20,
        imageUrl: null,
        teamIndex: 1,
        team: 2,
        role: null,
        placement: null,
        finalHP: 0,
        maxHP: 100,
        maxShield: 20,
        destroyed: true,
        yielded: false,
        damageDealt: 40,
        eloBefore: 1000,
        eloAfter: 985,
        credits: 3600,
        streamingRevenue: 100,
        prestigeAwarded: 0,
        fameAwarded: 0,
        stance: 'balanced',
        loadoutType: 'single',
        mainWeaponName: 'Blade',
        mainWeaponRangeBand: 'close',
        offhandWeaponName: null,
        offhandWeaponRangeBand: null,
      },
      {
        robotId: 4,
        robotName: 'Delta',
        owner: 'Stable B',
        ownerId: 20,
        imageUrl: null,
        teamIndex: 1,
        team: 2,
        role: null,
        placement: null,
        finalHP: 0,
        maxHP: 100,
        maxShield: 20,
        destroyed: true,
        yielded: false,
        damageDealt: 50,
        eloBefore: 1000,
        eloAfter: 985,
        credits: 3600,
        streamingRevenue: 100,
        prestigeAwarded: 0,
        fameAwarded: 0,
        stance: 'offensive',
        loadoutType: 'dual_wield',
        mainWeaponName: 'Rifle',
        mainWeaponRangeBand: 'long',
        offhandWeaponName: 'Pistol',
        offhandWeaponRangeBand: 'medium',
      },
    ],
    battleLog: {
      teamBattle: true,
      teamSize: 2,
      winningSide: 1,
      isDraw: false,
      isByeMatch: false,
      durationSeconds: 120,
      participants: [
        { robotId: 1, team: 1, damageDealt: 80.5, damageTaken: 40.2, finalHP: 50, survivalSeconds: 120 },
        { robotId: 2, team: 1, damageDealt: 60.3, damageTaken: 49.8, finalHP: 30, survivalSeconds: 120 },
        { robotId: 3, team: 2, damageDealt: 40.1, damageTaken: 70.5, finalHP: 0, survivalSeconds: 85.3 },
        { robotId: 4, team: 2, damageDealt: 50.0, damageTaken: 70.3, finalHP: 0, survivalSeconds: 95.7 },
      ],
      events: [],
      focusFireEvents: [
        { tick: 50, targetRobotId: 3, contributorRobotIds: [1, 2], contributorCount: 2, bonusApplied: 0.15 },
      ],
      focusFireMetrics: { team1: 12.5, team2: 3.2 },
      allySupportMetrics: { team1: 8.4, team2: 5.1 },
      formationDefenceMetrics: { team1: 15.0, team2: 9.8 },
      arenaRadius: 20,
      startingPositions: {},
      endingPositions: {},
    } as unknown as BattleLogResponse['battleLog'],
    ...overrides,
  };
}

describe('TeamBattleMetrics', () => {
  const renderWithRouter = (ui: React.ReactElement) =>
    render(<MemoryRouter>{ui}</MemoryRouter>);

  it('renders team performance section with per-robot stats', () => {
    const battleLog = createTeamBattleLog();
    renderWithRouter(<TeamBattleMetrics battleLog={battleLog} />);

    expect(screen.getByText('⚔️ Team Performance')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Delta')).toBeInTheDocument();
  });

  it('renders team coordination metrics', () => {
    const battleLog = createTeamBattleLog();
    renderWithRouter(<TeamBattleMetrics battleLog={battleLog} />);

    expect(screen.getByText('🤝 Team Coordination')).toBeInTheDocument();
    expect(screen.getByText('🎯 Focus Fire Total')).toBeInTheDocument();
    expect(screen.getByText('🛡️ Ally Support Total')).toBeInTheDocument();
    expect(screen.getByText('🏰 Formation Defence Total')).toBeInTheDocument();
    expect(screen.getByText('📊 Team ELO Delta')).toBeInTheDocument();
  });

  it('shows correct focus fire metric values', () => {
    const battleLog = createTeamBattleLog();
    renderWithRouter(<TeamBattleMetrics battleLog={battleLog} />);

    expect(screen.getByText('12.5')).toBeInTheDocument();
    expect(screen.getByText('3.2')).toBeInTheDocument();
  });

  it('shows ELO delta computed from participants', () => {
    const battleLog = createTeamBattleLog();
    renderWithRouter(<TeamBattleMetrics battleLog={battleLog} />);

    // Team 1: (1015-1000) + (1015-1000) = +30
    expect(screen.getByText('+30')).toBeInTheDocument();
    // Team 2: (985-1000) + (985-1000) = -30
    expect(screen.getByText('-30')).toBeInTheDocument();
  });

  it('shows winner badge on winning team', () => {
    const battleLog = createTeamBattleLog();
    renderWithRouter(<TeamBattleMetrics battleLog={battleLog} />);

    expect(screen.getByText(/Team 1.*🏆/)).toBeInTheDocument();
  });

  it('shows focus fire event count', () => {
    const battleLog = createTeamBattleLog();
    renderWithRouter(<TeamBattleMetrics battleLog={battleLog} />);

    expect(screen.getByText(/1 focus fire event detected/)).toBeInTheDocument();
  });

  it('does not render for non-team battle types', () => {
    const battleLog = createTeamBattleLog({ battleType: 'league_1v1' });
    // Override battleLog to not have teamBattle flag
    battleLog.battleLog = { events: [] } as unknown as BattleLogResponse['battleLog'];
    const { container } = renderWithRouter(<TeamBattleMetrics battleLog={battleLog} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders vertical layout on mobile', () => {
    const battleLog = createTeamBattleLog();
    renderWithRouter(<TeamBattleMetrics battleLog={battleLog} isMobile={true} />);

    // Both teams should still be visible
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('handles 3v3 battles correctly', () => {
    const battleLog = createTeamBattleLog({ battleType: 'league_3v3' });
    // Add a 5th and 6th participant
    battleLog.participants = [
      ...battleLog.participants!,
      {
        robotId: 5,
        robotName: 'Epsilon',
        owner: 'Stable A',
        ownerId: 10,
        imageUrl: null,
        teamIndex: 0,
        team: 1,
        role: null,
        placement: null,
        finalHP: 20,
        maxHP: 100,
        maxShield: 20,
        destroyed: false,
        yielded: false,
        damageDealt: 45,
        eloBefore: 1000,
        eloAfter: 1015,
        credits: 27000,
        streamingRevenue: 500,
        prestigeAwarded: 10,
        fameAwarded: 5,
        stance: 'balanced',
        loadoutType: 'single',
        mainWeaponName: 'Axe',
        mainWeaponRangeBand: 'close',
        offhandWeaponName: null,
        offhandWeaponRangeBand: null,
      },
      {
        robotId: 6,
        robotName: 'Zeta',
        owner: 'Stable B',
        ownerId: 20,
        imageUrl: null,
        teamIndex: 1,
        team: 2,
        role: null,
        placement: null,
        finalHP: 0,
        maxHP: 100,
        maxShield: 20,
        destroyed: true,
        yielded: false,
        damageDealt: 30,
        eloBefore: 1000,
        eloAfter: 985,
        credits: 5400,
        streamingRevenue: 100,
        prestigeAwarded: 0,
        fameAwarded: 0,
        stance: 'defensive',
        loadoutType: 'single',
        mainWeaponName: 'Hammer',
        mainWeaponRangeBand: 'close',
        offhandWeaponName: null,
        offhandWeaponRangeBand: null,
      },
    ];
    renderWithRouter(<TeamBattleMetrics battleLog={battleLog} />);

    expect(screen.getByText('Epsilon')).toBeInTheDocument();
    expect(screen.getByText('Zeta')).toBeInTheDocument();
  });
});
