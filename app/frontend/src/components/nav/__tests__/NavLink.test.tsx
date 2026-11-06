import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NavLink } from '../NavLink';

function LocationDisplay(): React.ReactElement {
  const location = useLocation();
  return <output>{location.pathname}</output>;
}

/** Top-bar entries must be real links so Ctrl/Cmd-click opens a new tab (#573). */
describe('NavLink', () => {
  it('renders an anchor with an href and navigates on a plain click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NavLink to="/guide" isActive={false} onClick={onClick}>📖 Guide</NavLink>
        <LocationDisplay />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: '📖 Guide' });
    expect(link).toHaveAttribute('href', '/guide');
    await user.click(link);
    expect(screen.getByText('/guide')).toBeInTheDocument();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('leaves Ctrl/Cmd-click to the browser instead of navigating in place', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <NavLink to="/guide" isActive={false}>Guide</NavLink>
        <LocationDisplay />
      </MemoryRouter>,
    );

    await user.keyboard('{Meta>}');
    await user.click(screen.getByRole('link', { name: 'Guide' }));
    await user.keyboard('{/Meta}');
    expect(screen.getByText('/dashboard')).toBeInTheDocument();
  });

  it('marks the active entry with aria-current', () => {
    render(
      <MemoryRouter>
        <NavLink to="/guide" isActive>Guide</NavLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders a disabled entry as a non-link', () => {
    render(
      <MemoryRouter>
        <NavLink to="/settings" isActive={false} disabled>Settings</NavLink>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeDisabled();
  });
});
