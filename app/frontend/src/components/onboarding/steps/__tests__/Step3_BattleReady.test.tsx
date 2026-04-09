/**
 * Tests for Step6_WeaponEducation — per-robot battle-ready wizard
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../../contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    tutorialState: { currentStep: 6, strategy: '2_average', choices: { facilitiesPurchased: [] } },
    refreshState: vi.fn(),
  }),
}));

vi.mock('../../../../utils/apiClient', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url === '/api/robots') return Promise.resolve({ data: [
        { id: 1, name: 'Bot1', mainWeaponId: null, loadoutType: 'single', stance: 'balanced' },
        { id: 2, name: 'Bot2', mainWeaponId: null, loadoutType: 'single', stance: 'balanced' },
      ]});
      if (url === '/api/weapons') return Promise.resolve({ data: [
        { id: 1, name: 'Practice Sword', cost: 50000, baseDamage: 6, cooldown: 3, weaponType: 'melee', handsRequired: 'one', rangeBand: 'melee', loadoutType: 'single' },
        { id: 2, name: 'Training Rifle', cost: 50000, baseDamage: 6, cooldown: 3, weaponType: 'ballistic', handsRequired: 'two', rangeBand: 'mid', loadoutType: 'two_handed' },
      ]});
      if (url === '/api/facilities') return Promise.resolve({ data: { facilities: [] } });
      if (url === '/api/user/profile') return Promise.resolve({ data: { currency: 500000 } });
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: { weaponInventory: { id: 1 }, success: true, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { robot: {} } }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../../../LoadoutSelector', () => ({
  default: ({ onLoadoutChange }: { onLoadoutChange: (v: string) => void }) => (
    <div data-testid="loadout-selector">
      <button onClick={() => onLoadoutChange('single')}>Single</button>
      <button onClick={() => onLoadoutChange('two_handed')}>Two-Handed</button>
    </div>
  ),
}));

vi.mock('../../../StanceSelector', () => ({
  default: ({ onStanceChange }: { onStanceChange: (v: string) => void }) => (
    <div data-testid="stance-selector">
      <button onClick={() => onStanceChange('offensive')}>Offensive</button>
    </div>
  ),
}));

vi.mock('../../../RobotImageSelector', () => ({
  default: ({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) => (
    <div data-testid="image-selector">
      <button onClick={() => onSelect('/img/robot.webp')}>Pick Image</button>
      <button onClick={onClose}>Skip</button>
    </div>
  ),
}));

vi.mock('../../../../../shared/utils/discounts', () => ({
  calculateWeaponWorkshopDiscount: () => 0,
  applyDiscount: (cost: number) => cost,
}));

vi.mock('../../../../utils/weaponImages', () => ({
  getWeaponImagePath: () => 'data:image/svg+xml,<svg/>',
}));

vi.mock('../../../../utils/weaponConstants', () => ({
  ATTRIBUTE_LABELS: [],
}));

describe('Step6_WeaponEducation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render heading and first robot name', async () => {
    const Step6 = (await import('../Step3_BattleReady')).default;
    render(<Step6 />);
    await waitFor(() => {
      expect(screen.getByText('Get Your Robots Battle-Ready')).toBeInTheDocument();
      expect(screen.getByText(/Bot1/)).toBeInTheDocument();
    });
  });

  it('should show loadout selector on initial render', async () => {
    const Step6 = (await import('../Step3_BattleReady')).default;
    render(<Step6 />);
    await waitFor(() => {
      expect(screen.getByTestId('loadout-selector')).toBeInTheDocument();
    });
  });

  it('should show robot progress for multi-robot strategies', async () => {
    const Step6 = (await import('../Step3_BattleReady')).default;
    render(<Step6 />);
    await waitFor(() => {
      expect(screen.getByText(/Robot 1 of 2/)).toBeInTheDocument();
    });
  });

  it('should have a Previous button', async () => {
    const Step6 = (await import('../Step3_BattleReady')).default;
    render(<Step6 />);
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
  });
});
