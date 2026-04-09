/**
 * Tests for Step8_BattleReadiness — attribute investment
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../../contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    refreshState: vi.fn(),
  }),
}));

vi.mock('../../../../utils/apiClient', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url === '/api/robots') return Promise.resolve({ data: [
        { id: 1, name: 'Bot1', imageUrl: null, combatPower: 1, armorPlating: 1 },
      ]});
      if (url === '/api/user/profile') return Promise.resolve({ data: { currency: 200000 } });
      if (url === '/api/facilities') return Promise.resolve({ data: { facilities: [] } });
      if (url.startsWith('/api/robots/')) return Promise.resolve({ data: { id: 1, combatPower: 1, armorPlating: 1 } });
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

vi.mock('../../../RobotImage', () => ({
  default: ({ robotName }: { robotName: string }) => <div data-testid="robot-image">{robotName}</div>,
}));

describe('Step8_BattleReadiness', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should render upgrade heading', async () => {
    const Step8 = (await import('../Step4_Upgrades')).default;
    render(<Step8 />);
    await waitFor(() => {
      expect(screen.getByText('Upgrade Your Robots')).toBeInTheDocument();
    });
  });

  it('should show remaining budget', async () => {
    const Step8 = (await import('../Step4_Upgrades')).default;
    render(<Step8 />);
    await waitFor(() => {
      expect(screen.getByText(/₡200,000/)).toBeInTheDocument();
    });
  });

  it('should show robot with image', async () => {
    const Step8 = (await import('../Step4_Upgrades')).default;
    render(<Step8 />);
    await waitFor(() => {
      expect(screen.getByTestId('robot-image')).toBeInTheDocument();
    });
  });

  it('should show four focus categories', async () => {
    const Step8 = (await import('../Step4_Upgrades')).default;
    render(<Step8 />);
    await waitFor(() => {
      expect(screen.getByText('Combat')).toBeInTheDocument();
      expect(screen.getByText('Defense')).toBeInTheDocument();
      expect(screen.getByText('Mobility')).toBeInTheDocument();
      expect(screen.getByText('AI & Team')).toBeInTheDocument();
    });
  });

  it('should have Upgrade and Skip buttons', async () => {
    const Step8 = (await import('../Step4_Upgrades')).default;
    render(<Step8 />);
    await waitFor(() => {
      expect(screen.getByText('Upgrade')).toBeInTheDocument();
      expect(screen.getByText("Skip — I'll upgrade later")).toBeInTheDocument();
    });
  });
});
