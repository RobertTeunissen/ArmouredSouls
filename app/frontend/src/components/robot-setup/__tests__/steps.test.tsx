/**
 * Tests for wizard step components (Steps 1–7).
 *
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 10.1, 10.2, 10.3, 10.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock api
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockPatch = vi.fn();
vi.mock('../../../utils/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

vi.mock('../../../utils/robotApi', () => ({
  equipMainWeapon: vi.fn().mockResolvedValue({ robot: {} }),
  equipOffhandWeapon: vi.fn().mockResolvedValue({ robot: {} }),
}));

vi.mock('../../../utils/teamBattleApi', () => ({
  getMyTeamBattles: vi.fn().mockResolvedValue([]),
  registerTeamBattle: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock('../../../stores', () => ({
  useRobotStore: vi.fn((selector) => {
    const state = { robots: [{ id: 1, name: 'Bot1' }, { id: 2, name: 'Bot2' }] };
    return selector(state);
  }),
}));

vi.mock('../../../stores/subscriptionStore', () => ({
  useSubscriptionStore: vi.fn((selector) => {
    const state = {
      overview: {
        robots: [{
          robotId: 1,
          robotName: 'TestBot',
          subscriptions: [],
          cap: 4,
          heldSlots: [],
        }],
        registeredEvents: [
          { type: 'league_1v1', label: '1v1 League' },
          { type: 'koth', label: 'KotH' },
          { type: 'grand_melee', label: 'Grand Melee' },
        ],
        bookingOfficeLevel: 1,
        nextSchedulingMoments: {},
      },
      fetchOverview: vi.fn(),
    };
    return selector(state);
  }),
  selectOverview: (s: { overview: unknown }) => s.overview,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock RobotImageSelector to avoid complex rendering
vi.mock('../../RobotImageSelector', () => ({
  default: ({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) => (
    <div data-testid="image-selector">
      <button onClick={() => onSelect('/test.webp')}>Select Image</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock StanceSelector and YieldThresholdSlider
vi.mock('../../StanceSelector', () => ({
  default: ({ onStanceChange }: { onStanceChange: (s: string) => void }) => (
    <div data-testid="stance-selector">
      <button onClick={() => onStanceChange('offensive')}>Set Offensive</button>
    </div>
  ),
}));

vi.mock('../../YieldThresholdSlider', () => ({
  default: ({ onThresholdChange }: { onThresholdChange: (t: number) => void }) => (
    <div data-testid="yield-slider">
      <button onClick={() => onThresholdChange(20)}>Set Yield 20</button>
    </div>
  ),
}));

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const defaultStepProps = {
  robotId: 1,
  loadoutType: 'single',
  onComplete: vi.fn(),
  onSkip: vi.fn(),
};

describe('PortraitStep', () => {
  beforeEach(() => { vi.clearAllMocks(); mockPatch.mockResolvedValue({}); });

  it('should render image selector', async () => {
    const { default: PortraitStep } = await import('../steps/PortraitStep');
    wrap(<PortraitStep {...defaultStepProps} />);
    expect(screen.getByTestId('image-selector')).toBeInTheDocument();
  });

  it('should call onComplete after selecting an image', async () => {
    const { default: PortraitStep } = await import('../steps/PortraitStep');
    const user = userEvent.setup();
    const onComplete = vi.fn();
    wrap(<PortraitStep {...defaultStepProps} onComplete={onComplete} />);

    await user.click(screen.getByText('Select Image'));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });
});

describe('WeaponEquipStep', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show equip picker when player owns compatible weapons (sub-state a)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/weapon-inventory') return Promise.resolve([
        { id: 10, weaponId: 1, weapon: { id: 1, name: 'Laser Pistol', weaponType: 'energy', baseDamage: 6, cooldown: 3, cost: 57000, loadoutType: 'single', handsRequired: 'one', rangeBand: 'short' }, equippedOnRobotMain: null, equippedOnRobotOffhand: null },
      ]);
      if (url === '/api/weapon-inventory/storage-status') return Promise.resolve({ currentWeapons: 1, maxCapacity: 5, remainingSlots: 4, isFull: false });
      if (url === '/api/users/me') return Promise.resolve({ currency: 500000 });
      if (url === '/api/weapons') return Promise.resolve([]);
      return Promise.resolve({});
    });

    const { default: WeaponEquipStep } = await import('../steps/WeaponEquipStep');
    wrap(<WeaponEquipStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText('Laser Pistol')).toBeInTheDocument();
    });
  });

  it('should show buy-and-equip when no owned weapons but has storage + credits (sub-state b)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/weapon-inventory') return Promise.resolve([]);
      if (url === '/api/weapon-inventory/storage-status') return Promise.resolve({ currentWeapons: 0, maxCapacity: 5, remainingSlots: 5, isFull: false });
      if (url === '/api/users/me') return Promise.resolve({ currency: 100000 });
      if (url === '/api/weapons') return Promise.resolve([
        { id: 1, name: 'Practice Sword', weaponType: 'melee', baseDamage: 6, cooldown: 3, cost: 50000, loadoutType: 'single', handsRequired: 'one', rangeBand: 'melee' },
      ]);
      return Promise.resolve({});
    });

    const { default: WeaponEquipStep } = await import('../steps/WeaponEquipStep');
    wrap(<WeaponEquipStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText('Practice Sword')).toBeInTheDocument();
      expect(screen.getByText('₡50,000')).toBeInTheDocument();
    });
  });

  it('should show storage full warning (sub-state c)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/api/weapon-inventory') return Promise.resolve([]);
      if (url === '/api/weapon-inventory/storage-status') return Promise.resolve({ currentWeapons: 5, maxCapacity: 5, remainingSlots: 0, isFull: true });
      if (url === '/api/users/me') return Promise.resolve({ currency: 500000 });
      if (url === '/api/weapons') return Promise.resolve([]);
      return Promise.resolve({});
    });

    const { default: WeaponEquipStep } = await import('../steps/WeaponEquipStep');
    wrap(<WeaponEquipStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText('Weapon Storage Full')).toBeInTheDocument();
      expect(screen.getByText('Go to Facilities')).toBeInTheDocument();
    });
  });
});

describe('BattleConfigStep', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render stance selector and yield slider', async () => {
    const { default: BattleConfigStep } = await import('../steps/BattleConfigStep');
    wrap(<BattleConfigStep {...defaultStepProps} />);

    expect(screen.getByTestId('stance-selector')).toBeInTheDocument();
    expect(screen.getByTestId('yield-slider')).toBeInTheDocument();
  });

  it('should show "Keep Defaults" when no changes made', async () => {
    const { default: BattleConfigStep } = await import('../steps/BattleConfigStep');
    wrap(<BattleConfigStep {...defaultStepProps} />);

    expect(screen.getByText('Keep Defaults')).toBeInTheDocument();
  });
});

describe('TuningAllocationStep', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show pool summary when tuning data is available', async () => {
    mockGet.mockResolvedValue({ poolSize: 10, allocated: 0, remaining: 10, facilityLevel: 1 });

    const { default: TuningAllocationStep } = await import('../steps/TuningAllocationStep');
    wrap(<TuningAllocationStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText('10 points')).toBeInTheDocument();
    });
  });

  it('should show upgrade suggestion when no tuning bay', async () => {
    mockGet.mockResolvedValue({ poolSize: 0, allocated: 0, remaining: 0, facilityLevel: 0 });

    const { default: TuningAllocationStep } = await import('../steps/TuningAllocationStep');
    wrap(<TuningAllocationStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText('No tuning points available yet.')).toBeInTheDocument();
    });
  });
});

describe('TeamAssignmentStep', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should show "not enough robots" when stable has only 1 robot', async () => {
    // Override the mock to return only one robot (the current one)
    const { useRobotStore } = await import('../../../stores');
    vi.mocked(useRobotStore).mockImplementation((selector) => {
      const state = { robots: [{ id: 1, name: 'Solo' }] };
      return (selector as (s: typeof state) => unknown)(state);
    });

    const { default: TeamAssignmentStep } = await import('../steps/TeamAssignmentStep');
    wrap(<TeamAssignmentStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText(/need at least 2 robots/)).toBeInTheDocument();
    });
  });

  it('should show create team button when stable has multiple robots', async () => {
    const { useRobotStore } = await import('../../../stores');
    vi.mocked(useRobotStore).mockImplementation((selector) => {
      const state = { robots: [{ id: 1, name: 'Bot1' }, { id: 2, name: 'Bot2' }] };
      return (selector as (s: typeof state) => unknown)(state);
    });

    const { default: TeamAssignmentStep } = await import('../steps/TeamAssignmentStep');
    wrap(<TeamAssignmentStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText('+ Create New Team')).toBeInTheDocument();
    });
  });
});

describe('EventSubscriptionStep', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render event toggles from subscription store', async () => {
    const { default: EventSubscriptionStep } = await import('../steps/EventSubscriptionStep');
    wrap(<EventSubscriptionStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText('1v1 League')).toBeInTheDocument();
      expect(screen.getByText('King of the Hill')).toBeInTheDocument();
    });
  });

  it('should show cap indicator', async () => {
    const { default: EventSubscriptionStep } = await import('../steps/EventSubscriptionStep');
    wrap(<EventSubscriptionStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText('0 / 4')).toBeInTheDocument();
    });
  });

  it('should show warning when no subscriptions selected', async () => {
    const { default: EventSubscriptionStep } = await import('../steps/EventSubscriptionStep');
    wrap(<EventSubscriptionStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText(/without at least one subscription/i)).toBeInTheDocument();
    });
  });
});

describe('AttributeUpgradeStep', () => {
  it('should render with link to upgrades tab', async () => {
    const { default: AttributeUpgradeStep } = await import('../steps/AttributeUpgradeStep');
    wrap(<AttributeUpgradeStep {...defaultStepProps} />);

    expect(screen.getByText('Go to Upgrades →')).toBeInTheDocument();
    expect(screen.getByText('Finish Setup')).toBeInTheDocument();
  });

  it('should call onComplete when Finish Setup is clicked', async () => {
    const { default: AttributeUpgradeStep } = await import('../steps/AttributeUpgradeStep');
    const user = userEvent.setup();
    const onComplete = vi.fn();
    wrap(<AttributeUpgradeStep {...defaultStepProps} onComplete={onComplete} />);

    await user.click(screen.getByText('Finish Setup'));
    expect(onComplete).toHaveBeenCalled();
  });
});
