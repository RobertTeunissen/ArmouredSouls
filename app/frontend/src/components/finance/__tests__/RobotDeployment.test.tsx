import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RobotDeploymentCard } from '../RobotDeploymentCard';
import { RobotDeploymentDetail } from '../RobotDeploymentDetail';
import { ROBOT, ROBOT_DETAIL_RESPONSE } from './fixtures';

describe('Robot deployment components', () => {
  it('renders exactly the five fixed headline metrics and no profitability ranking', () => {
    const { container } = render(<RobotDeploymentCard robot={ROBOT} expanded={false} onToggle={vi.fn()} />);
    for (const label of ['Fought matches', 'Battle/bye income', 'Streaming revenue', 'Actual repair spend', 'Direct net']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('dt')).toHaveLength(5);
    expect(container.textContent).not.toMatch(/profitable|ranking/i);
  });

  it('renders player-safe allocation references and distinguishes byes from fought income', () => {
    const response = {
      ...ROBOT_DETAIL_RESPONSE,
      data: {
        ...ROBOT_DETAIL_RESPONSE.data,
        items: [
          ...ROBOT_DETAIL_RESPONSE.data.items,
          { provenance: ROBOT_DETAIL_RESPONSE.provenance[0], occurredAt: '2026-03-29T08:00:00.000Z', sourceReference: 'FS-A1', eventKind: 'battle_income' as const, mode: 'league_1v1', fought: true, amount: 4000, repairType: null },
        ],
      },
    };
    const { container } = render(<MemoryRouter><RobotDeploymentDetail response={response} onPageChange={vi.fn()} /></MemoryRouter>);

    const bye = screen.getByText('Bye income').closest('li');
    const foughtBattle = screen.getByText('Battle income').closest('li');
    expect(bye).toHaveTextContent('Bye (not a fought match)');
    expect(bye).not.toHaveTextContent(' · Fought match');
    expect(foughtBattle).toHaveTextContent('Fought match');
    expect(foughtBattle).not.toHaveTextContent('Bye (not a fought match)');
    expect(screen.getByText('Allocation evidence FS-BYE')).toBeInTheDocument();
    expect(screen.getByText('Allocation evidence FS-A1')).toBeInTheDocument();
    expect(container.textContent).not.toContain('financialEventId');
    expect(container.textContent).not.toContain('auditId');
    expect(screen.queryByRole('link', { name: /FS-BYE|FS-A1/ })).not.toBeInTheDocument();
  });

  it('announces pagination state, preserves keyboard access, and disables boundary actions', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(<MemoryRouter><RobotDeploymentDetail response={ROBOT_DETAIL_RESPONSE} onPageChange={onPageChange} /></MemoryRouter>);
    const previous = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });

    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getByText('Page 1 of 2 · 22 events')).toHaveAttribute('aria-live', 'polite');
    next.focus();
    await user.keyboard('{Enter}');
    expect(next).toHaveFocus();
    expect(onPageChange).toHaveBeenCalledWith(2);

    const secondPageResponse = {
      ...ROBOT_DETAIL_RESPONSE,
      data: {
        ...ROBOT_DETAIL_RESPONSE.data,
        page: { ...ROBOT_DETAIL_RESPONSE.data.page, page: 2, hasNextPage: false },
      },
    };
    rerender(<MemoryRouter><RobotDeploymentDetail response={secondPageResponse} onPageChange={onPageChange} /></MemoryRouter>);

    expect(screen.getByText('Page 2 of 2 · 22 events')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    const secondPagePrevious = screen.getByRole('button', { name: 'Previous' });
    secondPagePrevious.focus();
    await user.keyboard('{Enter}');
    expect(secondPagePrevious).toHaveFocus();
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('states page/full-period separation and exposes only subscription management', () => {
    render(<MemoryRouter><RobotDeploymentDetail response={ROBOT_DETAIL_RESPONSE} onPageChange={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText(/transport slice/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage subscriptions' })).toHaveAttribute('href', '/booking-office');
    expect(screen.queryByRole('button', { name: /repair|facility|team/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Loaded-page subtotal/)).toBeInTheDocument();
    expect(screen.getByText(/Full-period total/)).toHaveTextContent('₡13,000');
  });

  it('shows allocation limitations without inventing replacement amounts or actions', () => {
    const limitedRobot = {
      ...ROBOT,
      battleByeIncome: 0,
      directNet: 1000,
      limitations: [{
        code: 'battle_allocation_mismatch' as const,
        message: 'Battle allocation evidence did not conserve the stable award.',
      }],
    };
    render(<RobotDeploymentCard robot={limitedRobot} expanded={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Battle allocation evidence did not conserve');
    expect(screen.getByText('Battle/bye income').nextElementSibling).toHaveTextContent('₡0');
    expect(screen.queryByText(/estimated|apportioned/i)).not.toBeInTheDocument();
  });
});
