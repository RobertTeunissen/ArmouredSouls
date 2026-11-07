import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DropdownMenu } from '../DropdownMenu';
import { MobileDrawer } from '../MobileDrawer';
import { isNavPageImplemented, stableNavItems } from '../types';

vi.mock('../../../assets/icons/close.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

describe('My Stable navigation', () => {
  it('puts the player\'s own stable page first in the Stable menu', () => {
    expect(stableNavItems(7)[0]).toEqual({ path: '/stables/7', label: 'My Stable' });
    expect(isNavPageImplemented('/stables/7')).toBe(true);
    expect(isNavPageImplemented('/stables/abc')).toBe(false);
  });

  it('links to it from the desktop Stable dropdown', () => {
    render(
      <MemoryRouter>
        <DropdownMenu label="Stable" items={stableNavItems(7)} isActive={false} checkActive={() => false} />
      </MemoryRouter>,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Stable/ }).parentElement as HTMLElement);
    expect(screen.getByRole('link', { name: 'My Stable' })).toHaveAttribute('href', '/stables/7');
  });

  it('links to it from the mobile drawer', () => {
    render(
      <MemoryRouter>
        <MobileDrawer isOpen onClose={vi.fn()} isActive={() => false} userRobots={[]} isAdmin={false} onLogout={vi.fn()} userId={7} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'My Stable' })).toHaveAttribute('href', '/stables/7');
  });
});
