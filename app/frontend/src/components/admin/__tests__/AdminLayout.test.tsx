/**
 * Unit Tests for AdminLayout
 *
 * Tests the AdminLayout component which provides the admin portal shell:
 * - Sidebar renders all 7 navigation sections with correct links
 * - Header renders page title based on current route and "← Back to Game" link
 * - Active route is visually highlighted
 * - Below 768px the sidebar is replaced by a hamburger + navigation drawer
 *
 * _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminLayout from '../AdminLayout';

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const NAVIGATION_SECTIONS = [
  'Overview',
  'Game Operations',
  'Battle Data',
  'Player Management',
  'Security & Moderation',
  'Content',
  'Maintenance',
];

const NAVIGATION_ITEMS = [
  { label: 'Dashboard', path: '/admin/dashboard' },
  { label: 'Cycle Controls', path: '/admin/cycles' },
  { label: 'Season Control', path: '/admin/seasons' },
  { label: 'Practice Arena', path: '/admin/practice-arena' },
  { label: 'Battle Logs', path: '/admin/battles' },
  { label: 'Robot Stats', path: '/admin/robot-stats' },
  { label: 'League Health', path: '/admin/league-health' },
  { label: 'League History', path: '/admin/league-history' },
  { label: 'Tournaments', path: '/admin/tournaments' },
  { label: 'Weapons', path: '/admin/weapons' },
  { label: 'Players', path: '/admin/players' },
  { label: 'Economy', path: '/admin/economy' },
  { label: 'Automatons', path: '/admin/automatons' },
  { label: 'Security', path: '/admin/security' },
  { label: 'Image Uploads', path: '/admin/image-uploads' },
  { label: 'Changelog', path: '/admin/changelog' },
  { label: 'Achievements', path: '/admin/achievements' },
  { label: 'Tuning', path: '/admin/tuning' },
  { label: 'Refinement', path: '/admin/refinement' },
  { label: 'Subscriptions', path: '/admin/subscriptions' },
  { label: 'Search Analytics', path: '/admin/search-analytics' },
  { label: 'Repair Log', path: '/admin/repair-log' },
  { label: 'Audit Log', path: '/admin/audit-log' },
];

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Render AdminLayout at a given route path */
function renderLayout(initialPath = '/admin/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/*" element={<AdminLayout />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('AdminLayout', () => {
  /**
   * Requirement 1.2: The Sidebar SHALL group navigation links into the
   * following sections: Overview, Game Operations, Battle Data, Player
   * Management, Security & Moderation, Content, and Maintenance.
   */
  describe('Sidebar navigation sections', () => {
    it('should render all 7 navigation section headings', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });

      for (const section of NAVIGATION_SECTIONS) {
        expect(within(sidebar).getByText(section)).toBeInTheDocument();
      }
    });

    it('should render all navigation item links', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      const links = within(sidebar).getAllByRole('link');

      for (const item of NAVIGATION_ITEMS) {
        const link = links.find((l) => l.getAttribute('href') === item.path);
        expect(link).toBeDefined();
      }
    });

    it('should render exactly the expected number of navigation links', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      const links = within(sidebar).getAllByRole('link');

      // Nav items in the sidebar (Overview 1 + Game Ops 3 + Battle Data 6 + Player Mgmt 3
      // + Security 2 + Content 5 + Maintenance 2)
      expect(links.length).toBe(NAVIGATION_ITEMS.length);
    });
  });

  /**
   * Requirement 1.7: The Admin_Layout SHALL render a header bar displaying
   * the page title and a link to return to the player-facing dashboard.
   */
  describe('Header bar', () => {
    it('should render the page title based on current route', () => {
      renderLayout('/admin/dashboard');

      expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    });

    it('should render a "Back to Game" link pointing to /dashboard (shortened to "Game" below sm)', () => {
      renderLayout('/admin/dashboard');

      const backLink = screen.getByRole('link', { name: 'Back to Game' });
      expect(backLink).toHaveAttribute('href', '/dashboard');
      expect(within(backLink).getByText('Game')).toHaveClass('sm:hidden');
      expect(within(backLink).getByText('Back to Game')).toHaveClass('hidden', 'sm:inline');
    });

    it('should update page title when navigating to different routes', () => {
      renderLayout('/admin/battles');

      expect(screen.getByRole('heading', { level: 1, name: 'Battle Logs' })).toBeInTheDocument();
    });

    it('should show "Admin" as fallback title for unknown routes', () => {
      renderLayout('/admin/unknown-page');

      expect(screen.getByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument();
    });

    it('should display correct titles for various routes', () => {
      const routeTitlePairs = [
        { path: '/admin/security', title: 'Security' },
        { path: '/admin/players', title: 'Players' },
        { path: '/admin/economy', title: 'Economy' },
        { path: '/admin/automatons', title: 'Automaton Stables' },
        { path: '/admin/audit-log', title: 'Audit Log' },
      ];

      for (const { path, title } of routeTitlePairs) {
        const { unmount } = renderLayout(path);
        expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
        unmount();
      }
    });
  });

  /**
   * Requirement 1.5: The Sidebar SHALL visually highlight the navigation
   * link corresponding to the currently active route.
   */
  describe('Active route highlighting', () => {
    it('should highlight the active navigation link with active styles', () => {
      renderLayout('/admin/dashboard');

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      const dashboardLink = within(sidebar).getAllByRole('link').find(
        (l) => l.getAttribute('href') === '/admin/dashboard',
      );

      expect(dashboardLink).toBeDefined();
      expect(dashboardLink!.className).toContain('bg-primary/15');
      expect(dashboardLink!.className).toContain('text-primary');
    });

    it('should not highlight inactive navigation links with active styles', () => {
      renderLayout('/admin/dashboard');

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      const battlesLink = within(sidebar).getAllByRole('link').find(
        (l) => l.getAttribute('href') === '/admin/battles',
      );

      expect(battlesLink).toBeDefined();
      expect(battlesLink!.className).not.toContain('bg-primary/15');
      expect(battlesLink!.className).toContain('text-secondary');
    });

    it('should highlight the correct link when on a different route', () => {
      renderLayout('/admin/security');

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      const securityLink = within(sidebar).getAllByRole('link').find(
        (l) => l.getAttribute('href') === '/admin/security',
      );

      expect(securityLink).toBeDefined();
      expect(securityLink!.className).toContain('bg-primary/15');
      expect(securityLink!.className).toContain('text-primary');
    });

    it('should use exact match for /admin/cycles to avoid highlighting on /admin/cycles/history', () => {
      renderLayout('/admin/cycles/history');

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      const cyclesLink = within(sidebar).getAllByRole('link').find(
        (l) => l.getAttribute('href') === '/admin/cycles',
      );

      // Cycle Controls should NOT be highlighted when on a sub-route
      expect(cyclesLink!.className).not.toContain('bg-primary/15');
    });
  });

  /**
   * Below 768px (md) the sidebar is hidden and a hamburger in the header opens
   * the full, labelled navigation in a drawer. This replaced the 64px icon rail
   * (admin dashboard redesign, decision D5); from md the sidebar is unchanged.
   */
  describe('Responsive layout', () => {
    it('should hide the sidebar below md and show it from md at full width', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      expect(sidebar).toHaveClass('hidden', 'md:flex', 'w-60');
    });

    it('should show section headings and labels in the sidebar (no icon-only rail)', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      for (const section of NAVIGATION_SECTIONS) {
        expect(within(sidebar).getByText(section)).not.toHaveClass('hidden');
      }
      expect(within(sidebar).getByText('Dashboard')).not.toHaveClass('hidden');
    });

    it('should offset the main content by the sidebar width from md only', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      const mainWrapper = sidebar.nextElementSibling;

      expect(mainWrapper).not.toBeNull();
      expect(mainWrapper!.className).toContain('md:ml-60');
      expect(mainWrapper!.className).not.toMatch(/(^|\s)ml-16(\s|$)/);
    });

    it('should show the hamburger button below md only', () => {
      renderLayout();

      const button = screen.getByRole('button', { name: 'Open navigation' });
      expect(button).toHaveClass('md:hidden');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Navigation grouping', () => {
    it('should list Search Analytics last under Content, not under Overview', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      const overview = within(sidebar).getByText('Overview').parentElement!;
      const content = within(sidebar).getByText('Content').parentElement!;

      expect(within(overview).queryByText('Search Analytics')).not.toBeInTheDocument();
      const contentLinks = within(content).getAllByRole('link');
      expect(contentLinks.at(-1)).toHaveAttribute('href', '/admin/search-analytics');
    });
  });

  describe('Mobile navigation drawer', () => {
    it('should open a labelled dialog with every navigation link', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));

      const dialog = screen.getByRole('dialog', { name: 'Admin Portal' });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'true');
      expect(within(dialog).getAllByRole('link')).toHaveLength(NAVIGATION_ITEMS.length);
      for (const section of NAVIGATION_SECTIONS) {
        expect(within(dialog).getByText(section)).toBeInTheDocument();
      }
    });

    it('should move focus into the drawer and highlight the active page', async () => {
      const user = userEvent.setup();
      renderLayout('/admin/security');

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
      const security = within(dialog).getAllByRole('link').find((l) => l.getAttribute('href') === '/admin/security');
      expect(security!.className).toContain('bg-primary/15');
    });

    it('should close on Escape and return focus to the hamburger', async () => {
      const user = userEvent.setup();
      renderLayout();
      const trigger = screen.getByRole('button', { name: 'Open navigation' });

      await user.click(trigger);
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('should close from the close button and the backdrop', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      await user.click(screen.getByRole('button', { name: 'Close navigation' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      await user.click(screen.getByTestId('admin-nav-backdrop'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should keep Tab focus inside the drawer', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      const dialog = screen.getByRole('dialog');
      const close = within(dialog).getByRole('button', { name: 'Close navigation' });
      expect(close).toHaveFocus();

      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(within(dialog).getAllByRole('link').at(-1)).toHaveFocus();

      await user.tab();
      expect(close).toHaveFocus();
    });

    it('should close after choosing a page', async () => {
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole('button', { name: 'Open navigation' }));
      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getAllByRole('link').find((l) => l.getAttribute('href') === '/admin/players')!);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Players' })).toBeInTheDocument();
    });
  });

  /**
   * Requirement 1.1: The Admin_Layout SHALL render a persistent Sidebar on
   * the left side and a content area on the right side.
   */
  describe('Layout structure', () => {
    it('should render the sidebar with "Admin Portal" branding', () => {
      renderLayout();

      expect(screen.getByText('Admin Portal')).toBeInTheDocument();
    });

    it('should render a main content area', () => {
      renderLayout();

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should render the sidebar as a fixed element', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      expect(sidebar.className).toContain('fixed');
    });
  });

  /**
   * Requirement 1.6: The Admin_Layout SHALL not render the player-facing
   * Navigation component. We verify the layout does not include common
   * player-facing navigation elements.
   */
  describe('No player-facing navigation', () => {
    it('should not render player-facing navigation elements', () => {
      renderLayout();

      // The admin layout should not contain typical player nav items
      expect(screen.queryByText('My Stable')).not.toBeInTheDocument();
      expect(screen.queryByText('Weapon Shop')).not.toBeInTheDocument();
    });
  });
});
