import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SubscriptionLockIndicator from '../SubscriptionLockIndicator';

describe('SubscriptionLockIndicator', () => {
  it('should render nothing when isLocked is false', () => {
    const { container } = render(<SubscriptionLockIndicator isLocked={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render a lock icon when isLocked is true', () => {
    render(<SubscriptionLockIndicator isLocked={true} />);
    const lockElement = screen.getByRole('img');
    expect(lockElement).toBeInTheDocument();
  });

  it('should have aria-label with generic lock text when no scheduledCycle', () => {
    render(<SubscriptionLockIndicator isLocked={true} />);
    const lockElement = screen.getByRole('img');
    expect(lockElement).toHaveAttribute('aria-label', 'Locked — queued battle');
  });

  it('should have aria-label with cycle number when scheduledCycle is provided', () => {
    render(<SubscriptionLockIndicator isLocked={true} scheduledCycle={42} />);
    const lockElement = screen.getByRole('img');
    expect(lockElement).toHaveAttribute('aria-label', 'Locked — queued battle in cycle 42');
  });

  it('should show tooltip on mouse enter', () => {
    render(<SubscriptionLockIndicator isLocked={true} scheduledCycle={58} />);
    const lockElement = screen.getByRole('img');

    fireEvent.mouseEnter(lockElement);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Locked — queued battle in cycle 58');
  });

  it('should hide tooltip on mouse leave', () => {
    render(<SubscriptionLockIndicator isLocked={true} scheduledCycle={58} />);
    const lockElement = screen.getByRole('img');

    fireEvent.mouseEnter(lockElement);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseLeave(lockElement);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('should show tooltip on focus for keyboard accessibility', () => {
    render(<SubscriptionLockIndicator isLocked={true} scheduledCycle={10} />);
    const lockElement = screen.getByRole('img');

    fireEvent.focus(lockElement);

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Locked — queued battle in cycle 10');
  });

  it('should hide tooltip on blur', () => {
    render(<SubscriptionLockIndicator isLocked={true} scheduledCycle={10} />);
    const lockElement = screen.getByRole('img');

    fireEvent.focus(lockElement);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.blur(lockElement);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('should be focusable with tabIndex 0', () => {
    render(<SubscriptionLockIndicator isLocked={true} />);
    const lockElement = screen.getByRole('img');
    expect(lockElement).toHaveAttribute('tabindex', '0');
  });

  it('should contain an SVG lock icon', () => {
    const { container } = render(<SubscriptionLockIndicator isLocked={true} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
