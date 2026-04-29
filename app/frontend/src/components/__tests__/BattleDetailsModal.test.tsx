import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BattleDetailsModal from '../BattleDetailsModal';

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from '../../utils/apiClient';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedApiClient = apiClient as any;

const mockBattleData = {
  id: 1,
  robot1: {
    id: 10,
    name: 'TestBot1',
    maxHP: 100,
    loadout: 'Standard',
    stance: 'Aggressive',
    attributes: { armor: 50, speed: 60, power: 70 },
  },
  robot2: {
    id: 20,
    name: 'TestBot2',
    maxHP: 100,
    loadout: 'Standard',
    stance: 'Defensive',
    attributes: { armor: 45, speed: 55, power: 65 },
  },
  winnerId: 10,
  robot1FinalHP: 50,
  robot2FinalHP: 0,
  robot1FinalShield: 10,
  robot2FinalShield: 0,
  robot1DamageDealt: 100,
  robot2DamageDealt: 50,
  robot1ELOBefore: 1000,
  robot1ELOAfter: 1020,
  robot2ELOBefore: 1000,
  robot2ELOAfter: 980,
  robot1Destroyed: false,
  robot1Yielded: false,
  robot2Destroyed: true,
  robot2Yielded: false,
  robot1PrestigeAwarded: 5,
  robot1FameAwarded: 10,
  robot2PrestigeAwarded: 0,
  robot2FameAwarded: 0,
  winnerReward: 500,
  loserReward: 100,
  durationSeconds: 120,
  leagueType: 'Bronze',
  battleLog: {
    detailedCombatEvents: [],
  },
  created_at: '2026-02-10T10:00:00Z',
};

describe('BattleDetailsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiClient.get.mockResolvedValue({ data: mockBattleData });
  });

  it('does not render when isOpen is false', () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={false} onClose={onClose} battleId={1} />);
    
    expect(screen.queryByText(/battle details/i)).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', async () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/battle details/i)).toBeInTheDocument();
    });
  });

  it('fetches and displays battle information', async () => {
    const onClose = vi.fn();
    mockedApiClient.get.mockResolvedValue({ data: mockBattleData });
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getAllByText('TestBot1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('TestBot2').length).toBeGreaterThan(0);
    });
  });

  it('displays winner information', async () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Wins/i)).toBeInTheDocument();
    });
  });

  it('displays HP remaining for both robots', async () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/HP: 50/)).toBeInTheDocument();
    });
  });

  it('displays battle log', async () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/No Detailed Combat Events/i)).toBeInTheDocument();
    });
  });

  it('displays battle timestamp', async () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Duration: 120s/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/battle details/i)).toBeInTheDocument();
    });
    
    const closeButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Close');
    expect(closeButton).toBeDefined();
    await user.click(closeButton!);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state while fetching battle data', () => {
    mockedApiClient.get.mockImplementation(() => new Promise(() => {}));
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockedApiClient.get.mockRejectedValue(new Error('API Error'));
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('handles draw battles correctly', async () => {
    const drawBattle = { ...mockBattleData, winnerId: null };
    mockedApiClient.get.mockResolvedValue({ data: drawBattle });
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/draw/i)).toBeInTheDocument();
    });
  });

  it('handles null battleId gracefully', () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={null} />);
    
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
