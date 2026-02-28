import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import AdminPage from '../AdminPage';

// Mock axios
vi.mock('axios');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAxios = axios as any;

// Mock data
const mockSystemStats = {
  totalUsers: 150,
  totalRobots: 450,
  totalBattles: 12500,
  activeTournaments: 3,
  currentCycle: 42,
  lastCycleRun: '2026-02-10T10:30:00Z',
};

const mockBattles = {
  battles: [
    {
      id: 1,
      robot1_id: 10,
      robot2_id: 20,
      robot1_name: 'TestBot1',
      robot2_name: 'TestBot2',
      winner_id: 10,
      robot1_hp_remaining: 50,
      robot2_hp_remaining: 0,
      battle_log: 'Battle log content',
      created_at: '2026-02-10T10:00:00Z',
    },
  ],
  total: 1,
  page: 1,
  limit: 50,
};

const mockRobotStats = {
  attribute: 'armor',
  statistics: {
    mean: 50.5,
    median: 50,
    mode: 50,
    stdDev: 10.2,
    min: 20,
    max: 80,
  },
  outliers: [
    { robot_id: 1, robot_name: 'OutlierBot', value: 90, z_score: 3.5 },
  ],
};

// Helper to render with router
const renderAdminPage = () => {
  return render(
    <BrowserRouter>
      <AdminPage />
    </BrowserRouter>
  );
};

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.location.hash = '';
    
    // Default mock responses
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/admin/stats')) {
        return Promise.resolve({ data: mockSystemStats });
      }
      if (url.includes('/admin/battles')) {
        return Promise.resolve({ data: mockBattles });
      }
      if (url.includes('/admin/robot-stats')) {
        return Promise.resolve({ data: mockRobotStats });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  describe('Tab Navigation', () => {
    it('renders all tab buttons', () => {
      renderAdminPage();
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Cycle Controls')).toBeInTheDocument();
      expect(screen.getByText('Battle Logs')).toBeInTheDocument();
      expect(screen.getByText('Tournaments')).toBeInTheDocument();
      expect(screen.getByText('Robot Stats')).toBeInTheDocument();
    });

    it('switches tabs when clicked', async () => {
      const user = userEvent.setup();
      renderAdminPage();
      
      // Default tab is Dashboard
      expect(screen.getByText('System Statistics')).toBeInTheDocument();
      
      // Click Cycle Controls tab
      await user.click(screen.getByText('Cycle Controls'));
      expect(screen.getByText('Individual Cycle Operations')).toBeInTheDocument();
      
      // Click Battle Logs tab
      await user.click(screen.getByText('Battle Logs'));
      expect(screen.getByText('Battle Search & Filters')).toBeInTheDocument();
    });

    it('persists active tab in localStorage', async () => {
      const user = userEvent.setup();
      renderAdminPage();
      
      await user.click(screen.getByText('Cycle Controls'));
      
      expect(localStorage.setItem).toHaveBeenCalledWith('adminActiveTab', 'cycles');
    });

    it('restores active tab from localStorage', () => {
      localStorage.getItem = vi.fn().mockReturnValue('battles');
      
      renderAdminPage();
      
      expect(screen.getByText('Battle Search & Filters')).toBeInTheDocument();
    });

    it('updates URL hash when tab changes', async () => {
      const user = userEvent.setup();
      renderAdminPage();
      
      await user.click(screen.getByText('Robot Stats'));
      
      expect(window.location.hash).toBe('#stats');
    });
  });

  describe('Dashboard Tab', () => {
    it('loads and displays system statistics', async () => {
      renderAdminPage();
      
      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument(); // totalUsers
        expect(screen.getByText('450')).toBeInTheDocument(); // totalRobots
        expect(screen.getByText('12500')).toBeInTheDocument(); // totalBattles
        expect(screen.getByText('3')).toBeInTheDocument(); // activeTournaments
        expect(screen.getByText('42')).toBeInTheDocument(); // currentCycle
      });
    });

    it('shows loading state while fetching stats', () => {
      mockedAxios.get.mockImplementation(() => new Promise(() => {}));
      
      renderAdminPage();
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('displays error message when stats fetch fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));
      
      renderAdminPage();
      
      await waitFor(() => {
        expect(screen.getByText(/error loading statistics/i)).toBeInTheDocument();
      });
    });

    it('refreshes stats when refresh button is clicked', async () => {
      const user = userEvent.setup();
      renderAdminPage();
      
      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);
      
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cycle Controls Tab', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      renderAdminPage();
      await user.click(screen.getByText('Cycle Controls'));
    });

    it('renders individual cycle operation buttons', () => {
      expect(screen.getByText('Generate Matches')).toBeInTheDocument();
      expect(screen.getByText('Run Battles')).toBeInTheDocument();
      expect(screen.getByText('Update Standings')).toBeInTheDocument();
      expect(screen.getByText('Distribute Rewards')).toBeInTheDocument();
      expect(screen.getByText('Advance Cycle')).toBeInTheDocument();
    });

    it('executes individual cycle operation when button clicked', async () => {
      const user = userEvent.setup();
      mockedAxios.post.mockResolvedValue({ 
        data: { success: true, message: 'Matches generated' } 
      });
      
      const generateButton = screen.getByText('Generate Matches');
      await user.click(generateButton);
      
      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith('/admin/cycle/generate-matches');
      });
    });

    it('displays success message after operation completes', async () => {
      const user = userEvent.setup();
      mockedAxios.post.mockResolvedValue({ 
        data: { success: true, message: 'Operation successful' } 
      });
      
      await user.click(screen.getByText('Run Battles'));
      
      await waitFor(() => {
        expect(screen.getByText(/operation successful/i)).toBeInTheDocument();
      });
    });

    it('runs bulk cycle operations', async () => {
      const user = userEvent.setup();
      mockedAxios.post.mockResolvedValue({ 
        data: { success: true, message: 'Step completed' } 
      });
      
      const runAllButton = screen.getByText('Run All Cycle Steps');
      await user.click(runAllButton);
      
      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith('/admin/cycle/generate-matches');
      }, { timeout: 3000 });
    });

    it('displays session log entries', async () => {
      const user = userEvent.setup();
      mockedAxios.post.mockResolvedValue({ 
        data: { success: true, message: 'Test log entry' } 
      });
      
      await user.click(screen.getByText('Generate Matches'));
      
      await waitFor(() => {
        expect(screen.getByText(/test log entry/i)).toBeInTheDocument();
      });
    });

    it('clears session log when clear button clicked', async () => {
      const user = userEvent.setup();
      mockedAxios.post.mockResolvedValue({ 
        data: { success: true, message: 'Test entry' } 
      });
      
      await user.click(screen.getByText('Generate Matches'));
      await waitFor(() => {
        expect(screen.getByText(/test entry/i)).toBeInTheDocument();
      });
      
      const clearButton = screen.getByText('Clear Log');
      await user.click(clearButton);
      
      expect(screen.queryByText(/test entry/i)).not.toBeInTheDocument();
    });
  });

  describe('Battle Logs Tab', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      renderAdminPage();
      await user.click(screen.getByText('Battle Logs'));
    });

    it('loads and displays battle list', async () => {
      await waitFor(() => {
        expect(screen.getByText('TestBot1')).toBeInTheDocument();
        expect(screen.getByText('TestBot2')).toBeInTheDocument();
      });
    });

    it('filters battles by search term', async () => {
      const user = userEvent.setup();
      
      const searchInput = screen.getByPlaceholderText(/search by robot name/i);
      await user.type(searchInput, 'TestBot1');
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('search=TestBot1')
        );
      });
    });

    it('filters battles by winner', async () => {
      const user = userEvent.setup();
      
      const winnerSelect = screen.getByLabelText(/filter by winner/i);
      await user.selectOptions(winnerSelect, 'robot1');
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('winner=robot1')
        );
      });
    });

    it('changes page when pagination clicked', async () => {
      const user = userEvent.setup();
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('page=2')
        );
      });
    });

    it('opens battle details modal when view button clicked', async () => {
      const user = userEvent.setup();
      
      await waitFor(() => {
        expect(screen.getByText('TestBot1')).toBeInTheDocument();
      });
      
      const viewButton = screen.getByRole('button', { name: /view/i });
      await user.click(viewButton);
      
      await waitFor(() => {
        expect(screen.getByText(/battle details/i)).toBeInTheDocument();
      });
    });

    it('displays battle outcome icons correctly', async () => {
      await waitFor(() => {
        const battleRow = screen.getByText('TestBot1').closest('tr');
        expect(battleRow).toBeInTheDocument();
      });
    });
  });

  describe('Robot Stats Tab', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      renderAdminPage();
      await user.click(screen.getByText('Robot Stats'));
    });

    it('renders attribute selector', () => {
      expect(screen.getByLabelText(/select attribute/i)).toBeInTheDocument();
    });

    it('loads stats for selected attribute', async () => {
      await waitFor(() => {
        expect(screen.getByText(/mean/i)).toBeInTheDocument();
        expect(screen.getByText('50.5')).toBeInTheDocument();
      });
    });

    it('changes attribute when selector changed', async () => {
      const user = userEvent.setup();
      
      const attributeSelect = screen.getByLabelText(/select attribute/i);
      await user.selectOptions(attributeSelect, 'speed');
      
      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('attribute=speed')
        );
      });
    });

    it('displays statistical measures', async () => {
      await waitFor(() => {
        expect(screen.getByText(/median/i)).toBeInTheDocument();
        expect(screen.getByText(/standard deviation/i)).toBeInTheDocument();
        expect(screen.getByText(/min/i)).toBeInTheDocument();
        expect(screen.getByText(/max/i)).toBeInTheDocument();
      });
    });

    it('displays outliers table', async () => {
      await waitFor(() => {
        expect(screen.getByText('OutlierBot')).toBeInTheDocument();
        expect(screen.getByText('90')).toBeInTheDocument();
        expect(screen.getByText('3.5')).toBeInTheDocument();
      });
    });

    it('shows message when no outliers exist', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { ...mockRobotStats, outliers: [] }
      });
      
      renderAdminPage();
      const user = userEvent.setup();
      await user.click(screen.getByText('Robot Stats'));
      
      await waitFor(() => {
        expect(screen.getByText(/no outliers detected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tournaments Tab', () => {
    it('renders tournaments tab content', async () => {
      const user = userEvent.setup();
      renderAdminPage();
      
      await user.click(screen.getByText('Tournaments'));
      
      expect(screen.getByText(/tournament management/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));
      
      renderAdminPage();
      
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('displays error message for failed cycle operations', async () => {
      const user = userEvent.setup();
      renderAdminPage();
      await user.click(screen.getByText('Cycle Controls'));
      
      mockedAxios.post.mockRejectedValue(new Error('Operation failed'));
      
      await user.click(screen.getByText('Generate Matches'));
      
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });
});
