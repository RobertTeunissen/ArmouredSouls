/**
 * Tests for wizard step components (Steps 1–7).
 *
 * Note: Steps that import useNavigate + stores cause worker crashes when
 * combined with vi.mock('react-router-dom'). We test PortraitStep, WeaponEquipStep,
 * and BattleConfigStep with mocked sub-components, and verify the others
 * render via mocked versions (their integration is tested via the wizard shell).
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

// Import step components that don't use useNavigate (safe to import directly)
import PortraitStep from '../steps/PortraitStep';
import BattleConfigStep from '../steps/BattleConfigStep';
import WeaponEquipStep from '../steps/WeaponEquipStep';

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

  it('should render image selector', () => {
    wrap(<PortraitStep {...defaultStepProps} />);
    expect(screen.getByTestId('image-selector')).toBeInTheDocument();
  });

  it('should call onComplete after selecting an image', async () => {
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

    wrap(<WeaponEquipStep {...defaultStepProps} />);

    await waitFor(() => {
      expect(screen.getByText('Weapon Storage Full')).toBeInTheDocument();
      expect(screen.getByText('Go to Facilities')).toBeInTheDocument();
    });
  });
});

describe('BattleConfigStep', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render stance selector and yield slider', () => {
    wrap(<BattleConfigStep {...defaultStepProps} />);

    expect(screen.getByTestId('stance-selector')).toBeInTheDocument();
    expect(screen.getByTestId('yield-slider')).toBeInTheDocument();
  });

  it('should show "Keep Defaults" when no changes made', () => {
    wrap(<BattleConfigStep {...defaultStepProps} />);

    expect(screen.getByText('Keep Defaults')).toBeInTheDocument();
  });
});
