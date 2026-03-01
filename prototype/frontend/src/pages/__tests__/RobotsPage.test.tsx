import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RobotsPage from '../RobotsPage';

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import apiClient from '../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

// Mock the AuthContext
const mockLogout = vi.fn();
const mockRefreshUser = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
    refreshUser: mockRefreshUser,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/robots' }),
  };
});

// Mock components that import assets not available in test env
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

vi.mock('../../components/ViewModeToggle', () => ({
  default: ({ viewMode, onViewModeChange }: { viewMode: string; onViewModeChange: (mode: string) => void }) => (
    <div data-testid="view-mode-toggle">
      <button onClick={() => onViewModeChange('grid')}>Grid</button>
      <button onClick={() => onViewModeChange('list')}>List</button>
    </div>
  ),
}));

vi.mock('../../components/RobotImage', () => ({
  default: ({ name }: { name: string }) => <div data-testid="robot-image">{name?.[0]}</div>,
}));

vi.mock('../../components/ConfirmationModal', () => ({
  default: ({ isOpen, title, onConfirm, onCancel }: { isOpen: boolean; title: string; onConfirm: () => void; onCancel: () => void }) =>
    isOpen ? (
      <div data-testid="confirmation-modal">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

const mockRobots = [
  {
    id: 1,
    name: 'Iron Fist',
    elo: 1450,
    currentLeague: 'silver',
    leaguePoints: 45,
    currentHP: 850,
    maxHP: 1000,
    currentShield: 200,
    maxShield: 200,
    wins: 23,
    losses: 12,
    draws: 3,
    totalBattles: 38,
    battleReadiness: 85,
    repairCost: 7500,
    loadoutType: 'single',
    mainWeaponId: 1,
    offhandWeaponId: null,
    mainWeapon: {
      weapon: {
        name: 'Laser Rifle',
        weaponType: 'laser',
      },
    },
    offhandWeapon: null,
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 2,
    name: 'Steel Thunder',
    elo: 1380,
    currentLeague: 'bronze',
    leaguePoints: 78,
    currentHP: 600,
    maxHP: 1000,
    currentShield: 150,
    maxShield: 200,
    wins: 15,
    losses: 18,
    draws: 2,
    totalBattles: 35,
    battleReadiness: 60,
    repairCost: 20000,
    loadoutType: 'weapon_shield',
    mainWeaponId: 2,
    offhandWeaponId: 3,
    mainWeapon: {
      weapon: {
        name: 'Plasma Sword',
        weaponType: 'sword',
      },
    },
    offhandWeapon: {
      weapon: {
        name: 'Energy Shield',
        weaponType: 'shield',
      },
    },
    createdAt: '2026-01-20T00:00:00Z',
  },
];

const mockFacilities = [
  { type: 'repair_bay', currentLevel: 5 },
  { type: 'roster_expansion', currentLevel: 2 },
];

// Helper to set up apiClient mocks with custom robot/facility data
function setupMocks(robots = mockRobots, facilities = mockFacilities) {
  mockedApiClient.get.mockImplementation((url: string) => {
    if (url.includes('/api/robots')) {
      return Promise.resolve({ data: robots });
    }
    if (url.includes('/api/facilities')) {
      return Promise.resolve({ data: facilities });
    }
    return Promise.reject(new Error('Unknown URL'));
  });
}

describe('RobotsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
    setupMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  describe('Loading State', () => {
    it('should display loading message initially', () => {
      renderWithRouter(<RobotsPage />);
      expect(screen.getByText('Loading robots...')).toBeInTheDocument();
    });
  });

  describe('Robot List Display', () => {
    it('should display robots after loading', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Iron Fist')).toBeInTheDocument();
        expect(screen.getByText('Steel Thunder')).toBeInTheDocument();
      });
    });

    it('should display robot count in header', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/My Robots/)).toBeInTheDocument();
        expect(screen.getByText(/\(2\/3\)/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no robots', async () => {
      setupMocks([]);

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText("You don't have any robots yet.")).toBeInTheDocument();
        expect(screen.getByText('Create your first robot to start battling!')).toBeInTheDocument();
        expect(screen.getByText('Create Your First Robot')).toBeInTheDocument();
      });
    });

    it('should navigate to create robot page from empty state', async () => {
      setupMocks([]);

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const createButton = screen.getByText('Create Your First Robot');
        fireEvent.click(createButton);
        expect(mockNavigate).toHaveBeenCalledWith('/robots/create');
      });
    });
  });

  describe('Error State', () => {
    it('should display error message when API fails', async () => {
      mockedApiClient.get.mockRejectedValue(new Error('Server error'));

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load robots')).toBeInTheDocument();
      });
    });

    it('should logout and redirect on 401 error', async () => {
      mockedApiClient.get.mockRejectedValue({
        response: { status: 401 },
      });

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Repair All Button', () => {
    it('should disable repair all button when no repairs needed', async () => {
      const robotsWithNoRepairs = mockRobots.map(r => ({
        ...r,
        currentHP: r.maxHP,
        repairCost: 0,
      }));
      setupMocks(robotsWithNoRepairs);

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const repairButton = screen.getByRole('button', { name: /Repair All/ });
        expect(repairButton).toBeDisabled();
      });
    });
  });

  describe('Robot Capacity', () => {
    it('should display robot capacity based on roster expansion level', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        // Roster level 2 = max 3 robots
        expect(screen.getByText(/\(2\/3\)/)).toBeInTheDocument();
      });
    });

    it('should disable create button when at capacity', async () => {
      const threeRobots = [...mockRobots, { ...mockRobots[0], id: 3, name: 'Third Robot' }];
      setupMocks(threeRobots);

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /Create New Robot/ });
        expect(createButton).toBeDisabled();
      });
    });

    it('should enable create button when below capacity', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /Create New Robot/ });
        expect(createButton).not.toBeDisabled();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to create robot page when Create button is clicked', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /Create New Robot/ });
        fireEvent.click(createButton);
        expect(mockNavigate).toHaveBeenCalledWith('/robots/create');
      });
    });
  });

  describe('API Calls', () => {
    it('should fetch robots via apiClient', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(mockedApiClient.get).toHaveBeenCalledWith('/api/robots');
      });
    });

    it('should fetch facilities via apiClient', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(mockedApiClient.get).toHaveBeenCalledWith('/api/facilities');
      });
    });
  });
});
