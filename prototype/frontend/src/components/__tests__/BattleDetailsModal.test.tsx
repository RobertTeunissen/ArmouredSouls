import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import BattleDetailsModal from '../BattleDetailsModal';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

const mockBattleData = {
  id: 1,
  robot1_id: 10,
  robot2_id: 20,
  robot1_name: 'TestBot1',
  robot2_name: 'TestBot2',
  winner_id: 10,
  robot1_hp_remaining: 50,
  robot2_hp_remaining: 0,
  battle_log: 'Round 1: TestBot1 attacks TestBot2\nRound 2: TestBot2 attacks TestBot1\nTestBot1 wins!',
  created_at: '2026-02-10T10:00:00Z',
  robot1_attributes: {
    armor: 50,
    speed: 60,
    power: 70,
  },
  robot2_attributes: {
    armor: 45,
    speed: 55,
    power: 65,
  },
};

describe('BattleDetailsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: mockBattleData });
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
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith('/api/admin/battles/1');
      expect(screen.getByText('TestBot1')).toBeInTheDocument();
      expect(screen.getByText('TestBot2')).toBeInTheDocument();
    });
  });

  it('displays winner information', async () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/winner/i)).toBeInTheDocument();
    });
  });

  it('displays HP remaining for both robots', async () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/50/)).toBeInTheDocument();
      expect(screen.getByText(/0/)).toBeInTheDocument();
    });
  });

  it('displays battle log', async () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/round 1/i)).toBeInTheDocument();
    });
  });

  it('displays battle timestamp', async () => {
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/2026/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/battle details/i)).toBeInTheDocument();
    });
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);
    
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows loading state while fetching battle data', () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => {}));
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('API Error'));
    const onClose = vi.fn();
    render(<BattleDetailsModal isOpen={true} onClose={onClose} battleId={1} />);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('handles draw battles correctly', async () => {
    const drawBattle = { ...mockBattleData, winner_id: null };
    mockedAxios.get.mockResolvedValue({ data: drawBattle });
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
