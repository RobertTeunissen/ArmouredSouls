import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenu } from '../DropdownMenu';
import { MobileDrawer } from '../MobileDrawer';
import { allPages, implementedPages } from '../types';

vi.mock('../../../assets/icons/close.svg?react', () => ({
  default: () => <svg aria-hidden="true" />,
}));

function LocationDisplay(): React.ReactElement {
  const location = useLocation();
  return <output>{location.pathname}</output>;
}

describe('Finance Center player navigation', () => {
  it('defines exactly one player Finance Center destination and no legacy labels', () => {
    const financeItems = Object.values(allPages).flatMap((category) => category.items).filter((item) => item.path === '/income');
    expect(financeItems).toEqual([{ path: '/income', label: 'Finance Center' }]);
    expect(JSON.stringify(allPages)).not.toContain('Income Dashboard');
    expect(JSON.stringify(allPages)).not.toContain('Cycle Summary');
    expect(implementedPages.has('/income')).toBe(true);
    expect(implementedPages.has('/cycle-summary')).toBe(false);
    expect(JSON.stringify(allPages)).not.toContain('/admin/economy');
  });

  it('marks the desktop entry active and navigates to /income', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <DropdownMenu label="Stable" items={allPages.stable.items} isActive checkActive={(path) => path === '/income'} />
        <LocationDisplay />
      </MemoryRouter>,
    );
    await user.hover(screen.getByRole('button', { name: /Stable/ }));
    const item = await screen.findByRole('button', { name: 'Finance Center' });
    expect(item.className).toContain('bg-primary/10');
    await user.click(item);
    expect(screen.getByText('/income')).toBeInTheDocument();
  });

  it('marks the mobile entry active, navigates, and closes the drawer', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={['/income']}>
        <MobileDrawer isOpen onClose={onClose} isActive={(path) => path === '/income'} userRobots={[]} isAdmin={false} onLogout={vi.fn()} />
        <LocationDisplay />
      </MemoryRouter>,
    );
    const item = screen.getByRole('button', { name: 'Finance Center' });
    expect(item.className).toContain('bg-primary/10');
    await user.click(item);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('/income')).toBeInTheDocument();
  });
});
