import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DropdownMenu } from '../DropdownMenu';
import { MobileDrawer } from '../MobileDrawer';
import { allPages, isNavPageImplemented } from '../types';
import { workshopPath } from '../../../utils/robotRoutes';

vi.mock('../../../assets/icons/close.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

const robots = [{ id: 12, name: 'Iron Fist' }, { id: 34, name: 'Gobbelientje' }];

describe('robot links in the navigation (#504 Workshop)', () => {
  it('treats the Workshop as a reachable page', () => {
    expect(isNavPageImplemented('/robots/12/prepare')).toBe(true);
    expect(isNavPageImplemented('/robots/12')).toBe(true);
    expect(isNavPageImplemented('/robots/abc/prepare')).toBe(false);
    expect(isNavPageImplemented('/robots/12/prepare/extra')).toBe(false);
  });

  it('links each robot in the desktop Robots dropdown to its Workshop', () => {
    // Same item list Navigation builds for the Robots menu
    const items = [
      allPages.robots.items[0],
      ...robots.map((robot) => ({ path: workshopPath(robot.id), label: robot.name, indent: true })),
      ...allPages.robots.items.slice(1),
    ];
    render(
      <MemoryRouter>
        <DropdownMenu label="Robots" items={items} isActive={false} checkActive={() => false} />
      </MemoryRouter>,
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Robots/ }).parentElement as HTMLElement);

    expect(screen.getByRole('link', { name: 'Iron Fist' })).toHaveAttribute('href', '/robots/12/prepare');
    expect(screen.getByRole('link', { name: 'Gobbelientje' })).toHaveAttribute('href', '/robots/34/prepare');
    expect(screen.queryByRole('button', { name: 'Iron Fist' })).not.toBeInTheDocument();
  });

  it('links each robot in the mobile drawer to its Workshop', () => {
    render(
      <MemoryRouter>
        <MobileDrawer isOpen onClose={vi.fn()} isActive={() => false} userRobots={robots} isAdmin={false} onLogout={vi.fn()} userId={7} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Iron Fist' })).toHaveAttribute('href', '/robots/12/prepare');
    expect(screen.getByRole('link', { name: 'Gobbelientje' })).toHaveAttribute('href', '/robots/34/prepare');
  });
});
