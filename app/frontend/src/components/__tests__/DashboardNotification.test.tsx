/**
 * Unit tests for DashboardNotification component.
 *
 * Verifies:
 * - Renders all four variants with correct styling
 * - Displays icon, message, detail, action button, and dismiss button
 * - Action button triggers onAction callback
 * - Dismiss button triggers onDismiss callback
 * - Omits action/dismiss buttons when callbacks not provided
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DashboardNotification from '../DashboardNotification';

describe('DashboardNotification', () => {
  it('should render message and icon', () => {
    render(
      <DashboardNotification variant="warning" icon="⚠️" message="Test warning" />,
    );

    expect(screen.getByText('Test warning')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('should render detail text when provided', () => {
    render(
      <DashboardNotification
        variant="info"
        icon="ℹ️"
        message="Main message"
        detail="Additional detail"
      />,
    );

    expect(screen.getByText('Additional detail')).toBeInTheDocument();
  });

  it('should not render detail when not provided', () => {
    const { container } = render(
      <DashboardNotification variant="info" icon="ℹ️" message="No detail" />,
    );

    // Only the message span, no detail span
    const spans = container.querySelectorAll('span');
    const texts = Array.from(spans).map(s => s.textContent);
    expect(texts).not.toContain('undefined');
  });

  it('should render action button when actionLabel and onAction are provided', () => {
    const onAction = vi.fn();
    render(
      <DashboardNotification
        variant="danger"
        icon="🔧"
        message="Fix this"
        actionLabel="Fix Now"
        onAction={onAction}
      />,
    );

    expect(screen.getByRole('button', { name: 'Fix Now' })).toBeInTheDocument();
  });

  it('should not render action button when actionLabel is missing', () => {
    render(
      <DashboardNotification variant="success" icon="🏆" message="You won" />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should call onAction when action button is clicked', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <DashboardNotification
        variant="warning"
        icon="📋"
        message="Subscribe"
        actionLabel="Manage"
        onAction={onAction}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Manage' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('should render dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();
    render(
      <DashboardNotification
        variant="warning"
        icon="⏳"
        message="Season ending"
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <DashboardNotification
        variant="warning"
        icon="⏳"
        message="Season ending"
        onDismiss={onDismiss}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should apply success variant styling', () => {
    const { container } = render(
      <DashboardNotification variant="success" icon="🏆" message="Promoted!" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-success');
    expect(wrapper.className).toContain('bg-success/10');
  });

  it('should apply danger variant styling', () => {
    const { container } = render(
      <DashboardNotification variant="danger" icon="🔧" message="No weapon" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-error');
    expect(wrapper.className).toContain('bg-error/10');
  });

  it('should apply warning variant styling', () => {
    const { container } = render(
      <DashboardNotification variant="warning" icon="⚠️" message="Damaged" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-warning');
    expect(wrapper.className).toContain('bg-warning/10');
  });

  it('should apply info variant styling', () => {
    const { container } = render(
      <DashboardNotification variant="info" icon="👥" message="Create team" />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-primary');
    expect(wrapper.className).toContain('bg-primary/10');
  });

  it('should render both action and dismiss buttons together', () => {
    render(
      <DashboardNotification
        variant="warning"
        icon="⏳"
        message="Season ending"
        actionLabel="View"
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();
  });

  it('should have min-h-[44px] on action button for touch targets', () => {
    render(
      <DashboardNotification
        variant="danger"
        icon="🔧"
        message="Fix"
        actionLabel="Fix Now"
        onAction={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Fix Now' });
    expect(button.className).toContain('min-h-[44px]');
  });
});
