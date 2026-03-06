/**
 * Accessibility Tests for BattleReadinessCheck and CreditWarning
 *
 * Covers ARIA labels, roles, and alert regions.
 * Requirements: 25.1-25.7
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import BattleReadinessCheck from '../BattleReadinessCheck';
import CreditWarning from '../CreditWarning';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock useBattleReadiness
vi.mock('../../../hooks/useBattleReadiness', () => ({
  useBattleReadiness: vi.fn().mockReturnValue({
    isReady: false,
    issues: [
      { message: 'No robot created', action: 'Create a robot', link: '/robots/create' },
      { message: 'No weapon equipped', action: 'Equip a weapon', link: '/robots/1' },
    ],
  }),
}));

// Mock useCreditValidation
vi.mock('../../../hooks/useCreditValidation', () => ({
  useCreditValidation: vi.fn().mockReturnValue({
    canAfford: true,
    isLowReserve: false,
    isCriticalBudget: false,
    remainingAfterPurchase: 500000,
  }),
  CREDIT_THRESHOLDS: {
    LOW_RESERVE: 50000,
    CRITICAL_BUDGET: 600000,
  },
}));

// Mock formatters
vi.mock('../../../utils/formatters', () => ({
  formatCurrency: (val: number) => `₡${val.toLocaleString()}`,
}));

// ============================================================
// BattleReadinessCheck Accessibility Tests
// ============================================================
describe('BattleReadinessCheck Accessibility', () => {
  const defaultProps = {
    robots: [],
    credits: 50000,
    onComplete: vi.fn(),
  };

  it('should have aria-label on the main container', () => {
    render(
      <MemoryRouter>
        <BattleReadinessCheck {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Battle Readiness Check')).toBeInTheDocument();
  });

  it('should have aria-label on Complete Tutorial button', () => {
    render(
      <MemoryRouter>
        <BattleReadinessCheck {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Complete Tutorial')).toBeInTheDocument();
  });

  it('should have aria-disabled on disabled Complete button', () => {
    render(
      <MemoryRouter>
        <BattleReadinessCheck {...defaultProps} />
      </MemoryRouter>
    );
    const btn = screen.getByLabelText('Complete Tutorial');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('should have issues list with proper list roles', () => {
    render(
      <MemoryRouter>
        <BattleReadinessCheck {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByRole('list', { name: 'Readiness issues' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
  });

  it('should have accessible emoji labels', () => {
    render(
      <MemoryRouter>
        <BattleReadinessCheck {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByLabelText('Warning')).toBeInTheDocument();
  });
});

// ============================================================
// CreditWarning Accessibility Tests
// ============================================================
describe('CreditWarning Accessibility', () => {
  it('should have role="alert" on facility block message', () => {
    render(<CreditWarning currentCredits={1000000} purchaseCost={100000} onboardingStep={2} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Facility purchases are locked/)).toBeInTheDocument();
  });

  it('should have role="alert" on insufficient funds message', async () => {
    const { useCreditValidation } = await import('../../../hooks/useCreditValidation') as any;
    useCreditValidation.mockReturnValue({
      canAfford: false,
      isLowReserve: false,
      isCriticalBudget: false,
      remainingAfterPurchase: -100000,
    });

    render(<CreditWarning currentCredits={50000} purchaseCost={200000} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Insufficient credits/)).toBeInTheDocument();
  });
});
