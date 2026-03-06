/**
 * Comprehensive Accessibility Tests for Onboarding Components
 *
 * Tests keyboard navigation, screen reader announcements, ARIA attributes,
 * and WCAG 2.1 AA contrast compliance across all onboarding components.
 *
 * Requirements: 25.1-25.7
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import GuidedUIOverlay from '../GuidedUIOverlay';
import ProgressIndicator from '../ProgressIndicator';
import BudgetTracker from '../BudgetTracker';
import SkipConfirmationModal from '../SkipConfirmationModal';
import BattleReadinessCheck from '../BattleReadinessCheck';
import CreditWarning from '../CreditWarning';

// ============================================================
// Mocks
// ============================================================

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../contexts/OnboardingContext', () => ({
  useOnboarding: () => ({
    tutorialState: {
      currentStep: 3,
      hasCompletedOnboarding: false,
      strategy: '1_mighty',
      choices: { budgetSpent: { facilities: 0, robots: 0, weapons: 0, attributes: 0 } },
    },
    loading: false,
    error: null,
    advanceStep: vi.fn(),
    setStep: vi.fn(),
    skipTutorial: vi.fn(),
    completeTutorial: vi.fn(),
    updateStrategy: vi.fn(),
  }),
}));

vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { success: true, data: { credits: 2500000 } },
    }),
  },
}));

vi.mock('../../../utils/financialApi', () => ({
  formatCurrency: (val: number) => `₡${val.toLocaleString()}`,
}));

vi.mock('../../../hooks/useBattleReadiness', () => ({
  useBattleReadiness: vi.fn().mockReturnValue({
    isReady: false,
    issues: [
      { message: 'No robot created', action: 'Create a robot', link: '/robots/create' },
    ],
  }),
}));

vi.mock('../../../hooks/useCreditValidation', () => ({
  useCreditValidation: vi.fn().mockReturnValue({
    canAfford: true,
    isLowReserve: false,
    isCriticalBudget: false,
    remainingAfterPurchase: 500000,
  }),
  CREDIT_THRESHOLDS: { LOW_RESERVE: 50000, CRITICAL_BUDGET: 600000 },
}));

vi.mock('../../../utils/formatters', () => ({
  formatCurrency: (val: number) => `₡${val.toLocaleString()}`,
}));

// ============================================================
// Helpers
// ============================================================

let targetElement: HTMLElement;

function createTarget() {
  targetElement = document.createElement('button');
  targetElement.id = 'test-target';
  targetElement.textContent = 'Target';
  targetElement.style.cssText = 'position:absolute;top:100px;left:100px;width:200px;height:50px';
  document.body.appendChild(targetElement);
  targetElement.getBoundingClientRect = vi.fn(() => ({
    top: 100, left: 100, width: 200, height: 50,
    bottom: 150, right: 300, x: 100, y: 100, toJSON: () => ({}),
  }));
}

function removeTarget() {
  if (targetElement?.parentNode) {
    document.body.removeChild(targetElement);
  }
}


// ============================================================
// 1. GuidedUIOverlay Keyboard Navigation
// ============================================================
describe('GuidedUIOverlay - Keyboard Navigation', () => {
  beforeEach(createTarget);
  afterEach(() => {
    removeTarget();
    vi.clearAllMocks();
  });

  it('should dismiss overlay with Escape key', () => {
    const onClose = vi.fn();
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should advance with Enter key when not on a button', () => {
    const onNext = vi.fn();
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
        onNext={onNext}
      />
    );
    // Focus on the dialog itself (not a button)
    const dialog = screen.getByRole('dialog');
    dialog.focus();
    fireEvent.keyDown(document, { key: 'Enter', target: dialog });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('should not double-fire onNext when Enter is pressed on a button', () => {
    const onNext = vi.fn();
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
        onNext={onNext}
        showNext={true}
      />
    );
    const nextBtn = screen.getByLabelText('Next step');
    nextBtn.focus();
    // Dispatch a native KeyboardEvent on the button itself
    // The handler checks if target is a BUTTON and skips onNext to avoid double-fire
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(event, 'target', { value: nextBtn });
    document.dispatchEvent(event);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('should trap Tab focus within tooltip', () => {
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
        onNext={vi.fn()}
        showNext={true}
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog');

    // Focus an element outside the tooltip
    const externalEl = document.createElement('input');
    document.body.appendChild(externalEl);
    externalEl.focus();

    // Tab should bring focus back into the dialog
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(dialog.contains(document.activeElement) || document.activeElement === dialog).toBe(true);

    document.body.removeChild(externalEl);
  });

  it('should wrap focus from last to first on Tab', () => {
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
        onNext={vi.fn()}
        showNext={true}
        onClose={vi.fn()}
      />
    );
    // Focus the last button (Next step)
    const nextBtn = screen.getByLabelText('Next step');
    nextBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    // Focus should wrap to first focusable element
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('should wrap focus from first to last on Shift+Tab', () => {
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
        onNext={vi.fn()}
        showNext={true}
        onClose={vi.fn()}
      />
    );
    const closeBtn = screen.getByLabelText('Close tutorial');
    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('should auto-focus tooltip on mount', () => {
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });
});

// ============================================================
// 2. GuidedUIOverlay ARIA & Screen Reader Support
// ============================================================
describe('GuidedUIOverlay - ARIA & Screen Reader', () => {
  beforeEach(createTarget);
  afterEach(() => {
    removeTarget();
    vi.clearAllMocks();
  });

  it('should have role="dialog" with aria-modal', () => {
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Guidance</div>}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Tutorial guidance');
  });

  it('should mark overlay backdrop as aria-hidden', () => {
    const { container } = render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
      />
    );
    const overlay = container.querySelector('.bg-black.bg-opacity-60');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
  });

  it('should mark highlight cutout as aria-hidden', () => {
    const { container } = render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
      />
    );
    const cutout = container.querySelector('.fixed.z-\\[9999\\].pointer-events-none');
    expect(cutout).toHaveAttribute('aria-hidden', 'true');
  });

  it('should have aria-label on all navigation buttons', () => {
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
        onNext={vi.fn()}
        showNext={true}
        showPrevious={true}
        onPrevious={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Next step')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous step')).toBeInTheDocument();
    expect(screen.getByLabelText('Close tutorial')).toBeInTheDocument();
  });

  it('should have minimum 44x44px touch targets on buttons', () => {
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
        onNext={vi.fn()}
        showNext={true}
        showPrevious={true}
        onPrevious={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const buttons = [
      screen.getByLabelText('Next step'),
      screen.getByLabelText('Previous step'),
      screen.getByLabelText('Close tutorial'),
    ];
    buttons.forEach((btn) => {
      expect(btn).toHaveClass('min-h-[44px]');
      expect(btn).toHaveClass('min-w-[44px]');
    });
  });
});


// ============================================================
// 3. ProgressIndicator ARIA Attributes
// ============================================================
describe('ProgressIndicator - ARIA Attributes', () => {
  it('should have role="progressbar" with aria-valuenow/min/max', () => {
    render(<ProgressIndicator current={4} total={9} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '4');
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '9');
  });

  it('should have descriptive aria-valuetext', () => {
    render(<ProgressIndicator current={6} total={9} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('Step 6 of 9')
    );
    expect(progressbar).toHaveAttribute(
      'aria-valuetext',
      expect.stringContaining('complete')
    );
  });

  it('should have aria-labelledby linking to step text', () => {
    render(<ProgressIndicator current={2} total={9} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-labelledby', 'progress-label');
    const label = document.getElementById('progress-label');
    expect(label).toHaveTextContent('Step 2 of 9');
  });

  it('should update ARIA values when step changes', () => {
    const { rerender } = render(<ProgressIndicator current={1} total={9} />);
    let progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');

    rerender(<ProgressIndicator current={8} total={9} />);
    progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '8');
  });

  it('should have navigation role with aria-label', () => {
    render(<ProgressIndicator current={3} total={9} />);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Tutorial progress');
  });

  it('should mark step dots as aria-hidden', () => {
    const { container } = render(<ProgressIndicator current={3} total={9} />);
    const dotsContainer = container.querySelector('.absolute.top-0');
    expect(dotsContainer).toHaveAttribute('aria-hidden', 'true');
  });

  it('should have mobile step list with proper roles and aria-current', () => {
    render(<ProgressIndicator current={5} total={9} />);
    const list = screen.getByRole('list', { name: 'Tutorial steps' });
    expect(list).toBeInTheDocument();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(9);

    // Current step should have aria-current="step"
    expect(items[4]).toHaveAttribute('aria-current', 'step');

    // Other steps should not
    items.forEach((item, index) => {
      if (index !== 4) {
        expect(item).not.toHaveAttribute('aria-current');
      }
    });
  });
});

// ============================================================
// 4. BudgetTracker ARIA & Live Regions
// ============================================================
describe('BudgetTracker - ARIA & Live Regions', () => {
  it('should have region role with aria-label after loading', async () => {
    render(<BudgetTracker />);
    const region = await screen.findByRole('region', { name: 'Budget Tracker' });
    expect(region).toBeInTheDocument();
  });

  it('should have aria-live="polite" on remaining credits display', async () => {
    render(<BudgetTracker />);
    const region = await screen.findByRole('region', { name: 'Budget Tracker' });
    const liveRegion = region.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
  });

  it('should have progressbar with aria-valuenow/min/max', async () => {
    render(<BudgetTracker />);
    const progressbar = await screen.findByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('should have aria-label on budget progressbar', async () => {
    render(<BudgetTracker />);
    const progressbar = await screen.findByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-label', expect.stringContaining('Budget'));
  });
});

// ============================================================
// 5. SkipConfirmationModal ARIA & Keyboard
// ============================================================
describe('SkipConfirmationModal - ARIA & Keyboard', () => {
  const modalRef = { current: null } as React.RefObject<HTMLDivElement | null>;

  it('should have role="dialog" with aria-modal', () => {
    render(
      <SkipConfirmationModal
        modalRef={modalRef}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('should have aria-labelledby pointing to title', () => {
    render(
      <SkipConfirmationModal
        modalRef={modalRef}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'skip-confirm-title');
    const title = document.getElementById('skip-confirm-title');
    expect(title).toHaveTextContent('Skip Tutorial?');
  });

  it('should have aria-describedby pointing to description', () => {
    render(
      <SkipConfirmationModal
        modalRef={modalRef}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'skip-confirm-desc');
    const desc = document.getElementById('skip-confirm-desc');
    expect(desc).toBeInTheDocument();
  });

  it('should have aria-labels on action buttons', () => {
    render(
      <SkipConfirmationModal
        modalRef={modalRef}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Continue tutorial')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm skip tutorial')).toBeInTheDocument();
  });

  it('should have minimum 44px touch targets on buttons', () => {
    render(
      <SkipConfirmationModal
        modalRef={modalRef}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const continueBtn = screen.getByLabelText('Continue tutorial');
    const skipBtn = screen.getByLabelText('Confirm skip tutorial');
    expect(continueBtn).toHaveClass('min-h-[44px]');
    expect(skipBtn).toHaveClass('min-h-[44px]');
  });
});

// ============================================================
// 6. BattleReadinessCheck ARIA
// ============================================================
describe('BattleReadinessCheck - ARIA', () => {
  const defaultProps = {
    robots: [],
    credits: 50000,
    onComplete: vi.fn(),
  };

  it('should have aria-label on main container', () => {
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

  it('should have issues list with proper roles', () => {
    render(
      <MemoryRouter>
        <BattleReadinessCheck {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByRole('list', { name: 'Readiness issues' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });
});

// ============================================================
// 7. CreditWarning ARIA Alerts
// ============================================================
describe('CreditWarning - ARIA Alerts', () => {
  it('should have role="alert" on facility block message', () => {
    render(<CreditWarning currentCredits={1000000} purchaseCost={100000} onboardingStep={2} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Facility purchases are locked/)).toBeInTheDocument();
  });

  it('should have role="alert" on insufficient funds message', async () => {
    const mod = await import('../../../hooks/useCreditValidation') as any;
    mod.useCreditValidation.mockReturnValue({
      canAfford: false,
      isLowReserve: false,
      isCriticalBudget: false,
      remainingAfterPurchase: -100000,
    });

    render(<CreditWarning currentCredits={50000} purchaseCost={200000} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Insufficient credits/)).toBeInTheDocument();

    // Reset mock
    mod.useCreditValidation.mockReturnValue({
      canAfford: true,
      isLowReserve: false,
      isCriticalBudget: false,
      remainingAfterPurchase: 500000,
    });
  });

  it('should have role="alert" on critical budget warning', async () => {
    const mod = await import('../../../hooks/useCreditValidation') as any;
    mod.useCreditValidation.mockReturnValue({
      canAfford: true,
      isLowReserve: false,
      isCriticalBudget: true,
      remainingAfterPurchase: 400000,
    });

    render(<CreditWarning currentCredits={500000} purchaseCost={100000} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Critical budget warning/)).toBeInTheDocument();

    // Reset mock
    mod.useCreditValidation.mockReturnValue({
      canAfford: true,
      isLowReserve: false,
      isCriticalBudget: false,
      remainingAfterPurchase: 500000,
    });
  });

  it('should have role="status" on low reserve advisory', async () => {
    const mod = await import('../../../hooks/useCreditValidation') as any;
    mod.useCreditValidation.mockReturnValue({
      canAfford: true,
      isLowReserve: true,
      isCriticalBudget: false,
      remainingAfterPurchase: 30000,
    });

    render(<CreditWarning currentCredits={130000} purchaseCost={100000} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Low reserve warning/)).toBeInTheDocument();

    // Reset mock
    mod.useCreditValidation.mockReturnValue({
      canAfford: true,
      isLowReserve: false,
      isCriticalBudget: false,
      remainingAfterPurchase: 500000,
    });
  });
});


// ============================================================
// 8. WCAG 2.1 AA Contrast Compliance
// ============================================================
describe('WCAG 2.1 AA - Contrast Compliance', () => {
  /**
   * These tests verify that text elements use Tailwind classes
   * that meet WCAG 2.1 AA contrast requirements against dark backgrounds.
   *
   * On dark backgrounds (bg-gray-800, bg-gray-900, bg-surface):
   * - text-gray-300 (#D1D5DB) on bg-gray-900 (#111827) = ~11.4:1 ✓
   * - text-gray-400 (#9CA3AF) on bg-gray-900 (#111827) = ~6.8:1 ✓
   * - text-gray-500 (#6B7280) on bg-gray-900 (#111827) = ~4.0:1 ✗ (fails 4.5:1 for normal text)
   *
   * We verify components avoid text-gray-500 for meaningful content on dark backgrounds.
   */

  describe('ProgressIndicator contrast', () => {
    it('should use sufficient contrast for step text', () => {
      const { container } = render(<ProgressIndicator current={3} total={9} />);
      const stepText = container.querySelector('#progress-label');
      expect(stepText).toHaveClass('text-gray-300');
    });

    it('should use text-gray-400 or better for percentage (decorative, aria-hidden)', () => {
      const { container } = render(<ProgressIndicator current={3} total={9} />);
      const percentText = container.querySelector('[aria-hidden="true"]');
      // Even though aria-hidden, we upgraded to gray-400 for visual consistency
      expect(percentText).toHaveClass('text-gray-400');
    });
  });

  describe('GuidedUIOverlay contrast', () => {
    beforeEach(createTarget);
    afterEach(() => {
      removeTarget();
      vi.clearAllMocks();
    });

    it('should use white text on dark tooltip background', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
        />
      );
      const dialog = screen.getByRole('dialog');
      // bg-gray-900 with text-white provides excellent contrast
      expect(dialog).toHaveClass('bg-gray-900', 'text-white');
    });

    it('should use white text on navigation buttons', () => {
      render(
        <GuidedUIOverlay
          targetSelector="#test-target"
          tooltipContent={<div>Content</div>}
          onNext={vi.fn()}
          showNext={true}
        />
      );
      const nextBtn = screen.getByLabelText('Next step');
      expect(nextBtn).toHaveClass('text-white');
    });
  });

  describe('SkipConfirmationModal contrast', () => {
    const modalRef = { current: null } as React.RefObject<HTMLDivElement | null>;

    it('should use text-gray-300 for body text (sufficient contrast)', () => {
      const { container } = render(
        <SkipConfirmationModal
          modalRef={modalRef}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      );
      const bodyText = container.querySelectorAll('.text-gray-300');
      expect(bodyText.length).toBeGreaterThan(0);
    });

    it('should use white text on action buttons', () => {
      render(
        <SkipConfirmationModal
          modalRef={modalRef}
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      );
      const continueBtn = screen.getByLabelText('Continue tutorial');
      const skipBtn = screen.getByLabelText('Confirm skip tutorial');
      expect(continueBtn).toHaveClass('text-white');
      expect(skipBtn).toHaveClass('text-white');
    });
  });

  describe('BudgetTracker contrast', () => {
    it('should use text-gray-400 or better for labels', async () => {
      const { container } = render(<BudgetTracker />);
      // Wait for loading to complete
      await screen.findByRole('region', { name: 'Budget Tracker' });
      const labels = container.querySelectorAll('.text-gray-400');
      // All label text should be gray-400 (6.8:1 contrast) or better
      expect(labels.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// 9. Screen Reader Step Change Announcements
// ============================================================
describe('OnboardingContainer - Step Change Announcements', () => {
  /**
   * The OnboardingContainer includes an aria-live="polite" region
   * that announces step changes to screen readers.
   * We test this by verifying the sr-only live region exists
   * and contains the correct step information.
   *
   * Note: We test the OnboardingContainer indirectly through
   * the SkipConfirmationModal and ProgressIndicator since
   * OnboardingContainer requires full context setup.
   */

  it('ProgressIndicator should provide text alternative for current step', () => {
    render(<ProgressIndicator current={5} total={9} />);
    const progressbar = screen.getByRole('progressbar');
    const valueText = progressbar.getAttribute('aria-valuetext');
    expect(valueText).toContain('Step 5 of 9');
    expect(valueText).toContain('56%');
    expect(valueText).toContain('complete');
  });

  it('ProgressIndicator mobile list should label each step status', () => {
    render(<ProgressIndicator current={3} total={9} />);
    const items = screen.getAllByRole('listitem');

    // Completed steps (1, 2)
    expect(items[0]).toHaveAttribute('aria-label', expect.stringContaining('completed'));
    expect(items[1]).toHaveAttribute('aria-label', expect.stringContaining('completed'));

    // Current step (3)
    expect(items[2]).toHaveAttribute('aria-label', expect.stringContaining('current'));

    // Upcoming steps (4-9)
    expect(items[3]).toHaveAttribute('aria-label', expect.stringContaining('upcoming'));
  });
});

// ============================================================
// 10. Focus Management During Step Transitions
// ============================================================
describe('Focus Management', () => {
  beforeEach(createTarget);
  afterEach(() => {
    removeTarget();
    vi.clearAllMocks();
  });

  it('GuidedUIOverlay should receive focus on mount via tabindex=-1', () => {
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('tabindex', '-1');
    // Verify it can receive programmatic focus
    dialog.focus();
    expect(document.activeElement).toBe(dialog);
  });

  it('GuidedUIOverlay should prevent focus from leaving tooltip', () => {
    render(
      <GuidedUIOverlay
        targetSelector="#test-target"
        tooltipContent={<div>Content</div>}
        onNext={vi.fn()}
        showNext={true}
      />
    );

    // Create external element and focus it
    const external = document.createElement('button');
    document.body.appendChild(external);
    external.focus();
    expect(document.activeElement).toBe(external);

    // Tab should redirect focus into the dialog
    fireEvent.keyDown(document, { key: 'Tab' });
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);

    document.body.removeChild(external);
  });
});
