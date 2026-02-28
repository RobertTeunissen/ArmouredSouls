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

// Mock Navigation component
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
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

describe('RobotsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
    
    // Default mock implementations
    mockedApiClient.get.mockImplementation((url: string) => {
      if (url.includes('/api/robots')) {
        return Promise.resolve({ data: mockRobots });
      }
      if (url.includes('/api/facilities')) {
        return Promise.resolve({ data: mockFacilities });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
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
        expect(screen.getByText(/\(2\/3\)/)).toBeInTheDocument(); // 2 robots, max 3 (roster level 2)
      });
    });

    it('should display ELO for each robot', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('1450')).toBeInTheDocument();
        expect(screen.getByText('1380')).toBeInTheDocument();
      });
    });

    it('should display league and league points', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/silver.*LP: 45/i)).toBeInTheDocument();
        expect(screen.getByText(/bronze.*LP: 78/i)).toBeInTheDocument();
      });
    });

    it('should display win/loss/draw records', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('23W-12L-3D (60.5%)')).toBeInTheDocument();
        expect(screen.getByText('15W-18L-2D (42.9%)')).toBeInTheDocument();
      });
    });

    it('should display weapon names', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Laser Rifle')).toBeInTheDocument();
        expect(screen.getByText('Plasma Sword')).toBeInTheDocument();
      });
    });

    it('should display battle readiness status', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/85%.*Battle Ready/)).toBeInTheDocument();
        expect(screen.getByText(/60%.*Damaged/)).toBeInTheDocument();
      });
    });

    it('should sort robots by ELO (highest first)', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const robotNames = screen.getAllByRole('heading', { level: 3 });
        expect(robotNames[0]).toHaveTextContent('Iron Fist'); // ELO 1450
        expect(robotNames[1]).toHaveTextContent('Steel Thunder'); // ELO 1380
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty state when no robots', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/robots')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([]),
          });
        }
        if (url.includes('/api/facilities')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockFacilities),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText("You don't have any robots yet.")).toBeInTheDocument();
        expect(screen.getByText('Create your first robot to start battling!')).toBeInTheDocument();
        expect(screen.getByText('Create Your First Robot')).toBeInTheDocument();
      });
    });

    it('should navigate to create robot page from empty state', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/robots')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([]),
          });
        }
        if (url.includes('/api/facilities')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockFacilities),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      });

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load robots')).toBeInTheDocument();
      });
    });

    it('should logout and redirect on 401 error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 401,
        });
      });

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Repair All Button', () => {
    it('should display repair all button with cost', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        // Total repair cost: 7500 + 20000 = 27500
        // With 25% discount (level 5 repair bay): 20625
        expect(screen.getByText(/Repair All:.*20,625.*\(25% off\)/)).toBeInTheDocument();
      });
    });

    it('should disable repair all button when no repairs needed', async () => {
      const robotsWithNoRepairs = mockRobots.map(r => ({
        ...r,
        currentHP: r.maxHP,
        repairCost: 0,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/robots')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(robotsWithNoRepairs),
          });
        }
        if (url.includes('/api/facilities')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockFacilities),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const repairButton = screen.getByRole('button', { name: /Repair All/ });
        expect(repairButton).toBeDisabled();
      });
    });

    it('should calculate repair cost from HP damage', async () => {
      const robotsWithHPDamage = [
        {
          ...mockRobots[0],
          currentHP: 440, // 560 damage
          maxHP: 1000,
          repairCost: 0, // No repairCost set
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/robots')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(robotsWithHPDamage),
          });
        }
        if (url.includes('/api/facilities')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockFacilities),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        // 560 damage * 50 credits = 28000
        // With 25% discount: 21000
        expect(screen.getByText(/Repair All:.*21,000.*\(25% off\)/)).toBeInTheDocument();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/robots')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(threeRobots),
          });
        }
        if (url.includes('/api/facilities')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockFacilities),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

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
    it('should navigate to robot detail page when card is clicked', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const robotCard = screen.getByText('Iron Fist').closest('div[class*="cursor-pointer"]');
        if (robotCard) {
          fireEvent.click(robotCard);
          expect(mockNavigate).toHaveBeenCalledWith('/robots/1');
        }
      });
    });

    it('should navigate to robot detail page when View Details is clicked', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const viewDetailsButtons = screen.getAllByText(/View Details/);
        fireEvent.click(viewDetailsButtons[0]);
        expect(mockNavigate).toHaveBeenCalledWith('/robots/1');
      });
    });

    it('should navigate to create robot page when Create button is clicked', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /Create New Robot/ });
        fireEvent.click(createButton);
        expect(mockNavigate).toHaveBeenCalledWith('/robots/create');
      });
    });
  });

  describe('HP and Shield Bars', () => {
    it('should display HP percentage', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('85%')).toBeInTheDocument(); // Iron Fist: 850/1000
        expect(screen.getByText('60%')).toBeInTheDocument(); // Steel Thunder: 600/1000
      });
    });

    it('should display shield percentage', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument(); // Iron Fist: 200/200
        expect(screen.getByText('75%')).toBeInTheDocument(); // Steel Thunder: 150/200
      });
    });

    it('should apply correct color class to HP bar', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        const hpBars = document.querySelectorAll('[class*="bg-green-500"], [class*="bg-yellow-500"]');
        expect(hpBars.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Portrait Placeholder', () => {
    it('should display robot name initial in portrait', async () => {
      renderWithRouter(<RobotsPage />);
      
      await waitFor(() => {
        expect(screen.getByText('I')).toBeInTheDocument(); // Iron Fist
        expect(screen.getByText('S')).toBeInTheDocument(); // Steel Thunder
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
