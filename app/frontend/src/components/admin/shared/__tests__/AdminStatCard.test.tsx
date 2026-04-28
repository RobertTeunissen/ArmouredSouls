/**
 * Unit Tests for AdminStatCard
 *
 * Tests rendering with all prop combinations: value, label, trend
 * indicators (up/down/neutral), color variants, and optional icon.
 *
 * _Requirements: 26.1_
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminStatCard } from '../AdminStatCard';

describe('AdminStatCard', () => {
  it('should render label and string value', () => {
    render(<AdminStatCard label="Total Players" value="1,234" />);

    expect(screen.getByText('Total Players')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('should render numeric value', () => {
    render(<AdminStatCard label="Battles Today" value={42} />);

    expect(screen.getByText('Battles Today')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render up trend indicator with trend value', () => {
    render(
      <AdminStatCard label="Revenue" value="$500" trend="up" trendValue="+12%" />,
    );

    const trendEl = screen.getByLabelText('Trend: up +12%');
    expect(trendEl).toBeInTheDocument();
    expect(trendEl).toHaveClass('text-success');
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('should render down trend indicator with trend value', () => {
    render(
      <AdminStatCard label="Active Users" value={80} trend="down" trendValue="-5%" />,
    );

    const trendEl = screen.getByLabelText('Trend: down -5%');
    expect(trendEl).toBeInTheDocument();
    expect(trendEl).toHaveClass('text-error');
    expect(screen.getByText('-5%')).toBeInTheDocument();
  });

  it('should not render neutral trend indicator (neutral trends are hidden)', () => {
    render(
      <AdminStatCard label="Cycle" value={100} trend="neutral" />,
    );

    // Neutral trends are not rendered in the current implementation
    expect(screen.queryByLabelText(/Trend: neutral/)).not.toBeInTheDocument();
  });

  it('should render trend without trend value', () => {
    render(<AdminStatCard label="Score" value={50} trend="up" />);

    const trendEl = screen.getByLabelText('Trend: up');
    expect(trendEl).toBeInTheDocument();
  });

  it('should not render trend indicator when trend is not provided', () => {
    render(<AdminStatCard label="Count" value={10} />);

    expect(screen.queryByLabelText(/Trend:/)).not.toBeInTheDocument();
  });

  it('should apply the correct color accent class', () => {
    const colors = ['primary', 'success', 'warning', 'error', 'info'] as const;
    const expectedBorderClasses = [
      'border-primary/40',
      'border-success/40',
      'border-warning/40',
      'border-error/40',
      'border-info/40',
    ];

    colors.forEach((color, idx) => {
      const { container } = render(
        <AdminStatCard label={`Label ${color}`} value={idx} color={color} />,
      );

      const card = container.firstElementChild as HTMLElement;
      expect(card.className).toContain(expectedBorderClasses[idx]);
    });
  });

  it('should default to primary color when no color is specified', () => {
    const { container } = render(
      <AdminStatCard label="Default" value={0} />,
    );

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-primary/40');
  });

  it('should render an icon when provided', () => {
    render(
      <AdminStatCard label="With Icon" value={5} icon={<span data-testid="custom-icon">🎮</span>} />,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('should not render icon container when icon is not provided', () => {
    const { container } = render(
      <AdminStatCard label="No Icon" value={5} />,
    );

    const iconContainers = container.querySelectorAll('[aria-hidden="true"]');
    // Only trend icons would have aria-hidden, not icon containers
    // With no trend and no icon, there should be none
    expect(iconContainers.length).toBe(0);
  });
});
