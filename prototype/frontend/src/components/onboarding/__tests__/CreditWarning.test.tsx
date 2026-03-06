/**
 * CreditWarning component tests
 * Tests credit validation warnings displayed during onboarding purchases.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CreditWarning from '../CreditWarning';

describe('CreditWarning', () => {
  it('shows nothing when credits are sufficient and above all thresholds', () => {
    const { container } = render(
      <CreditWarning currentCredits={2000000} purchaseCost={100000} />
    );
    // remaining = 1,900,000 — well above all thresholds
    expect(container.firstChild).toBeNull();
  });

  it('shows insufficient credits error when credits < purchaseCost', () => {
    render(<CreditWarning currentCredits={30000} purchaseCost={50000} />);
    expect(screen.getByText(/Insufficient credits/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows low reserve warning when remaining < 50,000', () => {
    render(<CreditWarning currentCredits={700000} purchaseCost={660000} />);
    // remaining = 40,000 — below 50K reserve, but credits > 600K so no critical
    expect(screen.getByText(/Low reserve warning/i)).toBeInTheDocument();
    expect(screen.getByText(/repair costs/i)).toBeInTheDocument();
  });

  it('does not block transaction for low reserve warning', () => {
    render(<CreditWarning currentCredits={700000} purchaseCost={660000} />);
    // Should show advisory role="status", not role="alert"
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl.textContent).toContain('Low reserve warning');
  });

  it('shows critical budget warning when credits < 600,000', () => {
    render(<CreditWarning currentCredits={500000} purchaseCost={100000} />);
    expect(screen.getByText(/Critical budget warning/i)).toBeInTheDocument();
    expect(screen.getByText(/avoid/i)).toBeInTheDocument();
  });

  it('shows both critical and low reserve warnings when applicable', () => {
    render(<CreditWarning currentCredits={500000} purchaseCost={460000} />);
    // credits < 600K → critical; remaining = 40K < 50K → low reserve
    expect(screen.getByText(/Critical budget warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Low reserve warning/i)).toBeInTheDocument();
  });

  it('shows facility block message when onboardingStep < 4', () => {
    render(
      <CreditWarning currentCredits={2000000} purchaseCost={100000} onboardingStep={2} />
    );
    expect(screen.getByText(/Facility purchases are locked/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 4/i)).toBeInTheDocument();
  });

  it('shows facility block for step 1', () => {
    render(
      <CreditWarning currentCredits={2000000} purchaseCost={100000} onboardingStep={1} />
    );
    expect(screen.getByText(/Facility purchases are locked/i)).toBeInTheDocument();
  });

  it('shows facility block for step 3', () => {
    render(
      <CreditWarning currentCredits={2000000} purchaseCost={100000} onboardingStep={3} />
    );
    expect(screen.getByText(/Facility purchases are locked/i)).toBeInTheDocument();
  });

  it('does NOT show facility block when onboardingStep >= 4', () => {
    const { container } = render(
      <CreditWarning currentCredits={2000000} purchaseCost={100000} onboardingStep={4} />
    );
    expect(screen.queryByText(/Facility purchases are locked/i)).not.toBeInTheDocument();
    // No warnings at all since credits are high
    expect(container.firstChild).toBeNull();
  });

  it('does NOT show facility block when onboardingStep is 9', () => {
    const { container } = render(
      <CreditWarning currentCredits={2000000} purchaseCost={100000} onboardingStep={9} />
    );
    expect(screen.queryByText(/Facility purchases are locked/i)).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('does NOT show facility block when onboardingStep is not provided', () => {
    const { container } = render(
      <CreditWarning currentCredits={2000000} purchaseCost={100000} />
    );
    expect(screen.queryByText(/Facility purchases are locked/i)).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('facility block takes priority over other warnings', () => {
    render(
      <CreditWarning currentCredits={30000} purchaseCost={50000} onboardingStep={2} />
    );
    // Even though credits are insufficient, facility block message shows instead
    expect(screen.getByText(/Facility purchases are locked/i)).toBeInTheDocument();
    expect(screen.queryByText(/Insufficient credits/i)).not.toBeInTheDocument();
  });

  it('shows insufficient credits error instead of low reserve when cannot afford', () => {
    render(<CreditWarning currentCredits={30000} purchaseCost={50000} />);
    expect(screen.getByText(/Insufficient credits/i)).toBeInTheDocument();
    expect(screen.queryByText(/Low reserve warning/i)).not.toBeInTheDocument();
  });
});
