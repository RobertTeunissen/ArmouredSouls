import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Navigation from '../Navigation';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      username: 'search-player',
      email: null,
      role: 'player',
      currency: 1000,
      prestige: 0,
    },
    logout: vi.fn(),
  }),
}));

vi.mock('../../utils/robotApi', () => ({
  fetchMyRobots: vi.fn().mockResolvedValue([]),
}));

vi.mock('../OnboardingNavBanner', () => ({ default: () => null }));
vi.mock('../season/SeasonProgressIndicator', () => ({ default: () => null }));
vi.mock('../season/SeasonCountdownBanner', () => ({ default: () => null }));
vi.mock('../season/SeasonSummaryModal', () => ({ default: () => null }));

vi.mock('../../assets/logos/logo-b.svg?react', () => ({ default: () => <svg aria-hidden="true" /> }));
vi.mock('../../assets/icons/home.svg?react', () => ({ default: () => <svg aria-hidden="true" /> }));
vi.mock('../../assets/icons/robot.svg?react', () => ({ default: () => <svg aria-hidden="true" /> }));
vi.mock('../../assets/icons/swords.svg?react', () => ({ default: () => <svg aria-hidden="true" /> }));
vi.mock('../../assets/icons/cart.svg?react', () => ({ default: () => <svg aria-hidden="true" /> }));
vi.mock('../../assets/icons/menu.svg?react', () => ({ default: () => <svg aria-hidden="true" /> }));
vi.mock('../../assets/icons/close.svg?react', () => ({ default: () => <svg aria-hidden="true" /> }));

function setViewport(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

function renderNavigation(onOpenSearch: () => void = vi.fn()): void {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Navigation onOpenSearch={onOpenSearch} />
    </MemoryRouter>,
  );
}

function getSearchControls(): HTMLElement[] {
  return screen.getAllByRole('button', { name: 'Open search' });
}

describe('Navigation universal search controls', () => {
  it('renders a labelled desktop Search control with a visible shortcut hint', () => {
    setViewport(1280);
    renderNavigation();

    const desktopSearch = screen.getByText('Search', { exact: true }).closest('button');
    expect(desktopSearch).not.toBeNull();
    expect(desktopSearch).toHaveAttribute('type', 'button');
    expect(desktopSearch).toHaveAttribute('aria-label', 'Open search');
    expect(desktopSearch).toHaveTextContent('Search');
    expect(within(desktopSearch as HTMLElement).getByText('⌘ K')).toBeVisible();
    expect(desktopSearch).toHaveClass('min-h-11', 'focus-visible:outline-2', 'focus-visible:outline-primary');
    expect(desktopSearch?.closest('nav')).toHaveClass('fixed', 'top-0', 'lg:block');
  });

  it('renders the mobile search icon in the fixed top header', () => {
    setViewport(375);
    renderNavigation();

    const mobileSearch = getSearchControls().find((control) => control.closest('header') !== null);
    expect(mobileSearch).toBeDefined();
    expect(mobileSearch).toHaveAttribute('type', 'button');
    expect(mobileSearch).toHaveAttribute('aria-label', 'Open search');
    expect(mobileSearch).toHaveAttribute('title', 'Search');
    expect(mobileSearch).toHaveClass(
      'min-h-11',
      'min-w-11',
      'focus-visible:outline-2',
      'focus-visible:outline-primary',
    );
    expect(mobileSearch?.closest('header')).toHaveClass('fixed', 'top-0');
    expect(mobileSearch?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps Search visibly discoverable without relying on the keyboard shortcut', () => {
    setViewport(1024);
    renderNavigation();

    const controls = getSearchControls();
    expect(controls).toHaveLength(2);
    expect(screen.getByText('Search', { exact: true })).toBeVisible();
    expect(controls.every((control) => control.getAttribute('aria-label') === 'Open search')).toBe(true);
    expect(controls.some((control) => control.getAttribute('title') === 'Search')).toBe(true);
  });

  it('does not place Search in bottom navigation or the More drawer', async () => {
    setViewport(375);
    const user = userEvent.setup();
    renderNavigation();

    const bottomNavigation = screen
      .getAllByRole('navigation')
      .find((navigation) => navigation.className.includes('bottom-0'));
    expect(bottomNavigation).toBeDefined();
    expect(within(bottomNavigation as HTMLElement).queryByRole('button', { name: 'Open search' })).not.toBeInTheDocument();

    await user.click(within(bottomNavigation as HTMLElement).getByRole('button', { name: 'More' }));
    const moreDrawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    expect(within(moreDrawer).queryByRole('button', { name: 'Open search' })).not.toBeInTheDocument();
    expect(within(moreDrawer).queryByTitle('Search')).not.toBeInTheDocument();
  });

  it('activates both desktop and mobile Search controls through the callback', async () => {
    setViewport(1280);
    const user = userEvent.setup();
    const onOpenSearch = vi.fn();
    renderNavigation(onOpenSearch);

    for (const control of getSearchControls()) {
      await user.click(control);
    }

    expect(onOpenSearch).toHaveBeenCalledTimes(2);
  });
});
