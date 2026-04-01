import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import BattleDetailsModal from '../../BattleDetailsModal';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mock1v1Battle = {
  id: 42,
  robot1: {
    id: 10,
    name: 'IronClaw',
    maxHP: 100,
    loadout: 'balanced',
    stance: 'aggressive',
    attributes: {
      attack: 75,
      defense: 60,
      speed: 50,
      accuracy: 80,
      evasion: 45,
    },
  },
  robot2: {
    id: 20,
    name: 'SteelFang',
    maxHP: 100,
    loadout: 'defensive',
    stance: 'cautious',
    attributes: {
      attack: 55,
      defense: 85,
      speed: 40,
      accuracy: 70,
      evasion: 35,
    },
  },
  winnerId: 10,
  winnerName: 'IronClaw',
  leagueType: 'gold',
  durationSeconds: 38,
  robot1FinalHP: 42,
  robot2FinalHP: 0,
  robot1FinalShield: 5,
  robot2FinalShield: 0,
  robot1DamageDealt: 120,
  robot2DamageDealt: 58,
  robot1ELOBefore: 1200,
  robot2ELOBefore: 1180,
  robot1ELOAfter: 1220,
  robot2ELOAfter: 1160,
  robot1Destroyed: false,
  robot2Destroyed: true,
  robot1Yielded: false,
  robot2Yielded: false,
  winnerReward: 500,
  loserReward: 100,
  robot1PrestigeAwarded: 5,
  robot1FameAwarded: 10,
  robot2PrestigeAwarded: 0,
  robot2FameAwarded: 0,
  battleLog: {
    detailedCombatEvents: [],
  },
  participants: [],
};

const mockCombatEvents = [
  {
    timestamp: 1.0,
    type: 'attack',
    attacker: 'IronClaw',
    defender: 'SteelFang',
    damage: 25,
    hit: true,
    critical: false,
    robot1HP: 100,
    robot2HP: 75,
    robot1Shield: 10,
    robot2Shield: 5,
    message: 'IronClaw attacks SteelFang for 25 damage',
    formulaBreakdown: {
      calculation: 'attack * modifier - defense',
      components: { attack: 75, modifier: 1.2, defense: 60 },
      result: 25,
    },
  },
  {
    timestamp: 2.5,
    type: 'critical',
    attacker: 'IronClaw',
    defender: 'SteelFang',
    damage: 50,
    hit: true,
    critical: true,
    robot1HP: 100,
    robot2HP: 25,
    robot1Shield: 10,
    robot2Shield: 0,
    message: 'IronClaw lands a critical hit on SteelFang for 50 damage!',
    formulaBreakdown: {
      calculation: 'attack * critMultiplier - defense',
      components: { attack: 75, critMultiplier: 2.0, defense: 60 },
      result: 50,
    },
  },
];

const mock2v2Battle = {
  id: 99,
  battleFormat: '2v2',
  robot1: { id: 10, name: 'IronClaw', attributes: { attack: 75, defense: 60 } },
  robot2: { id: 30, name: 'ThunderBot', attributes: { attack: 65, defense: 70 } },
  winnerId: 10,
  winnerName: 'IronClaw',
  leagueType: 'gold',
  durationSeconds: 55,
  robot1FinalHP: 30,
  robot2FinalHP: 0,
  robot1ELOBefore: 1200,
  robot2ELOBefore: 1150,
  robot1ELOAfter: 1225,
  robot2ELOAfter: 1125,
  teams: {
    team1: {
      id: 1,
      activeRobot: { id: 10, name: 'IronClaw' },
      reserveRobot: { id: 11, name: 'BronzeFist' },
      stableId: 1,
      league: 'gold',
    },
    team2: {
      id: 2,
      activeRobot: { id: 30, name: 'ThunderBot' },
      reserveRobot: { id: 31, name: 'StormBlade' },
      stableId: 2,
      league: 'gold',
    },
  },
  participants: [
    { robotId: 10, team: 1, role: 'active', credits: 300, streamingRevenue: null, eloBefore: 1200, eloAfter: 1225, prestigeAwarded: 3, fameAwarded: 5, damageDealt: 80, finalHP: 30, yielded: false, destroyed: false },
    { robotId: 11, team: 1, role: 'reserve', credits: 150, streamingRevenue: null, eloBefore: 1100, eloAfter: 1115, prestigeAwarded: 1, fameAwarded: 2, damageDealt: 40, finalHP: 50, yielded: false, destroyed: false },
    { robotId: 30, team: 2, role: 'active', credits: 100, streamingRevenue: null, eloBefore: 1150, eloAfter: 1125, prestigeAwarded: 0, fameAwarded: 0, damageDealt: 60, finalHP: 0, yielded: false, destroyed: true },
    { robotId: 31, team: 2, role: 'reserve', credits: 50, streamingRevenue: null, eloBefore: 1050, eloAfter: 1035, prestigeAwarded: 0, fameAwarded: 0, damageDealt: 20, finalHP: 10, yielded: false, destroyed: false },
  ],
  battleLog: { detailedCombatEvents: [] },
};

const mockDrawBattle = {
  ...mock1v1Battle,
  id: 77,
  winnerId: null,
  winnerName: '',
  robot1FinalHP: 15,
  robot2FinalHP: 15,
  robot1Destroyed: false,
  robot2Destroyed: false,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  battleId: 42,
};

function renderModal(props: Partial<typeof defaultProps> = {}) {
  return render(<BattleDetailsModal {...defaultProps} {...props} />);
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('BattleDetailsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup localStorage mock to return a token when the component reads it
    vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
      key === 'token' ? 'test-admin-token' : null,
    );
  });

  it('should not render when isOpen is false', () => {
    mockedAxios.get.mockResolvedValue({ data: mock1v1Battle });
    renderModal({ isOpen: false });

    expect(screen.queryByText(/Battle Details/)).not.toBeInTheDocument();
  });

  it('should render loading state', async () => {
    // Make axios hang indefinitely
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    renderModal();

    expect(screen.getByText('Loading battle details...')).toBeInTheDocument();
  });

  it('should render 1v1 battle with robot names and attribute comparison', async () => {
    mockedAxios.get.mockResolvedValue({ data: mock1v1Battle });
    renderModal();

    await waitFor(() => {
      // Robot names appear in the battle summary (may appear multiple times due to rewards section)
      expect(screen.getAllByText('IronClaw').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('SteelFang').length).toBeGreaterThanOrEqual(1);
    });

    // Battle Summary heading
    expect(screen.getByText('Battle Summary')).toBeInTheDocument();

    // Attribute Comparison heading
    expect(screen.getByText('Attribute Comparison')).toBeInTheDocument();

    // Attribute labels rendered from robot1.attributes keys
    expect(screen.getByText('Attack')).toBeInTheDocument();
    expect(screen.getByText('Defense')).toBeInTheDocument();
    expect(screen.getByText('Speed')).toBeInTheDocument();

    // Attribute values rendered (robot1 attack = 75.0, robot2 attack = 55.0)
    expect(screen.getByText('75.0')).toBeInTheDocument();
    expect(screen.getByText('55.0')).toBeInTheDocument();
  });

  it('should render combat log with events', async () => {
    const battleWithEvents = {
      ...mock1v1Battle,
      battleLog: { detailedCombatEvents: mockCombatEvents },
    };
    mockedAxios.get.mockResolvedValue({ data: battleWithEvents });
    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/Combat Log \(2 events\)/)).toBeInTheDocument();
    });

    // Event messages
    expect(screen.getByText(/IronClaw attacks SteelFang for 25 damage/)).toBeInTheDocument();
    expect(screen.getByText(/IronClaw lands a critical hit on SteelFang for 50 damage!/)).toBeInTheDocument();

    // Timestamps
    expect(screen.getByText('[1.0s]')).toBeInTheDocument();
    expect(screen.getByText('[2.5s]')).toBeInTheDocument();
  });

  it('should render 2v2 tag team battle with team layout', async () => {
    mockedAxios.get.mockResolvedValue({ data: mock2v2Battle });
    renderModal({ battleId: 99 });

    await waitFor(() => {
      expect(screen.getByText('Tag Team Battle Summary')).toBeInTheDocument();
    });

    // 2v2 badge(s) in the modal
    const badges = screen.getAllByText('2v2');
    expect(badges.length).toBeGreaterThanOrEqual(1);

    // Team headers (appear in both summary and rewards sections)
    expect(screen.getAllByText('Team 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Team 2').length).toBeGreaterThanOrEqual(1);

    // Active and reserve robot names
    expect(screen.getByText('IronClaw')).toBeInTheDocument();
    expect(screen.getByText('BronzeFist')).toBeInTheDocument();
    expect(screen.getByText('ThunderBot')).toBeInTheDocument();
    expect(screen.getByText('StormBlade')).toBeInTheDocument();

    // Role badges
    const activeBadges = screen.getAllByText('Active');
    const reserveBadges = screen.getAllByText('Reserve');
    expect(activeBadges.length).toBe(2);
    expect(reserveBadges.length).toBe(2);
  });

  it('should render draw result', async () => {
    mockedAxios.get.mockResolvedValue({ data: mockDrawBattle });
    renderModal({ battleId: 77 });

    await waitFor(() => {
      expect(screen.getByText('Battle Summary')).toBeInTheDocument();
    });

    // Draw indicator
    expect(screen.getByText(/Draw/)).toBeInTheDocument();
  });

  /* ------------------------------------------------------------------ */
  /*  Tag Team Winner Display Tests (Requirements 2.6, 2.8, 3.10)       */
  /* ------------------------------------------------------------------ */

  describe('Tag Team Winner Display', () => {
    it('should show Team 1 Wins when winnerId matches team1.id', async () => {
      /**
       * Validates: Requirements 2.6, 2.8
       * BattleDetailsModal winner display should match the winnerId (team ID).
       */
      const team1WinsBattle = {
        ...mock2v2Battle,
        winnerId: 1, // Team 1 ID
        teams: {
          team1: { id: 1, activeRobot: { id: 10, name: 'Alpha' }, reserveRobot: { id: 11, name: 'Beta' }, stableId: 1, league: 'gold' },
          team2: { id: 2, activeRobot: { id: 20, name: 'Gamma' }, reserveRobot: { id: 21, name: 'Delta' }, stableId: 2, league: 'gold' },
        },
      };
      mockedAxios.get.mockResolvedValue({ data: team1WinsBattle });
      renderModal({ battleId: 99 });

      await waitFor(() => {
        expect(screen.getByText('Tag Team Battle Summary')).toBeInTheDocument();
      });

      // Winner display should show "Team 1 Wins!"
      expect(screen.getByText(/🏆 Team 1 Wins!/)).toBeInTheDocument();
    });

    it('should show Team 2 Wins when winnerId matches team2.id', async () => {
      /**
       * Validates: Requirements 2.6, 2.8
       * BattleDetailsModal winner display should match the winnerId (team ID).
       */
      const team2WinsBattle = {
        ...mock2v2Battle,
        winnerId: 2, // Team 2 ID
        teams: {
          team1: { id: 1, activeRobot: { id: 10, name: 'Alpha' }, reserveRobot: { id: 11, name: 'Beta' }, stableId: 1, league: 'gold' },
          team2: { id: 2, activeRobot: { id: 20, name: 'Gamma' }, reserveRobot: { id: 21, name: 'Delta' }, stableId: 2, league: 'gold' },
        },
      };
      mockedAxios.get.mockResolvedValue({ data: team2WinsBattle });
      renderModal({ battleId: 99 });

      await waitFor(() => {
        expect(screen.getByText('Tag Team Battle Summary')).toBeInTheDocument();
      });

      // Winner display should show "Team 2 Wins!"
      expect(screen.getByText(/🏆 Team 2 Wins!/)).toBeInTheDocument();
    });

    it('should show Draw when winnerId is null for tag team battles', async () => {
      /**
       * Validates: Requirements 2.8
       * BattleDetailsModal should show Draw when winnerId is null.
       */
      const drawBattle = {
        ...mock2v2Battle,
        winnerId: null,
        teams: {
          team1: { id: 1, activeRobot: { id: 10, name: 'Alpha' }, reserveRobot: { id: 11, name: 'Beta' }, stableId: 1, league: 'gold' },
          team2: { id: 2, activeRobot: { id: 20, name: 'Gamma' }, reserveRobot: { id: 21, name: 'Delta' }, stableId: 2, league: 'gold' },
        },
      };
      mockedAxios.get.mockResolvedValue({ data: drawBattle });
      renderModal({ battleId: 99 });

      await waitFor(() => {
        expect(screen.getByText('Tag Team Battle Summary')).toBeInTheDocument();
      });

      // Winner display should show "Draw"
      expect(screen.getByText(/⚖️ Draw/)).toBeInTheDocument();
    });

    it('should highlight winning team rewards section', async () => {
      /**
       * Validates: Requirements 2.6, 2.8
       * The winning team's rewards section should be highlighted.
       */
      const team1WinsBattle = {
        ...mock2v2Battle,
        winnerId: 1, // Team 1 ID
        teams: {
          team1: { id: 1, activeRobot: { id: 10, name: 'Alpha' }, reserveRobot: { id: 11, name: 'Beta' }, stableId: 1, league: 'gold' },
          team2: { id: 2, activeRobot: { id: 20, name: 'Gamma' }, reserveRobot: { id: 21, name: 'Delta' }, stableId: 2, league: 'gold' },
        },
        participants: [
          { robotId: 10, team: 1, role: 'active', credits: 300, eloBefore: 1200, eloAfter: 1225, damageDealt: 80, finalHP: 30, yielded: false, destroyed: false },
          { robotId: 11, team: 1, role: 'reserve', credits: 150, eloBefore: 1100, eloAfter: 1115, damageDealt: 40, finalHP: 50, yielded: false, destroyed: false },
          { robotId: 20, team: 2, role: 'active', credits: 100, eloBefore: 1150, eloAfter: 1125, damageDealt: 60, finalHP: 0, yielded: false, destroyed: true },
          { robotId: 21, team: 2, role: 'reserve', credits: 50, eloBefore: 1050, eloAfter: 1035, damageDealt: 20, finalHP: 10, yielded: false, destroyed: false },
        ],
      };
      mockedAxios.get.mockResolvedValue({ data: team1WinsBattle });
      renderModal({ battleId: 99 });

      await waitFor(() => {
        expect(screen.getByText('💰 Battle Rewards')).toBeInTheDocument();
      });

      // The Team 1 rewards section should have the winner highlight class
      // We can verify this by checking the DOM structure
      const rewardsSection = screen.getByText('💰 Battle Rewards').closest('div');
      expect(rewardsSection).toBeInTheDocument();
      
      // Find the Team 1 rewards div - it should have the green border class
      const team1RewardsLabel = screen.getAllByText('Team 1').find(el => 
        el.closest('.p-3')?.classList.contains('bg-green-900/30')
      );
      expect(team1RewardsLabel).toBeInTheDocument();
    });
  });
});
