/**
 * Unit Tests for AdminLayout
 *
 * Tests the AdminLayout component which provides the admin portal shell:
 * - Sidebar renders all 7 navigation sections with correct links
 * - Header renders page title based on current route and "← Back to Game" link
 * - Active route is visually highlighted
 * - Responsive sidebar collapse at 768px breakpoint (w-16 vs w-60)
 *
 * _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
  { label: 'Practice Arena', path: '/admin/practice-arena' },
  { label: 'Battle Logs', path: '/admin/battles' },
  { label: 'Robot Stats', path: '/admin/robot-stats' },
  { label: 'League Health', path: '/admin/league-health' },
  { label: 'Weapons', path: '/admin/weapons' },
  { label: 'Players', path: '/admin/players' },
  { label: 'Economy', path: '/admin/economy' },
  { label: 'Security', path: '/admin/security' },
  { label: 'Image Uploads', path: '/admin/image-uploads' },
  { label: 'Changelog', path: '/admin/changelog' },
  { label: 'Achievements', path: '/admin/achievements' },
  { label: 'Tuning', path: '/admin/tuning' },
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

      // 18 nav items in the sidebar
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

    it('should render "← Back to Game" link pointing to /dashboard', () => {
      renderLayout('/admin/dashboard');

      const backLink = screen.getByText('← Back to Game');
      expect(backLink).toBeInTheDocument();
      expect(backLink.closest('a')).toHaveAttribute('href', '/dashboard');
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
   * Requirement 1.3: When the viewport width is below 768px, the Sidebar
   * SHALL collapse to display only icons without text labels.
   *
   * The sidebar uses Tailwind responsive classes: w-16 (collapsed) and
   * md:w-60 (expanded at ≥768px). We verify the CSS classes are present.
   */
  describe('Responsive sidebar collapse', () => {
    it('should have w-16 class for collapsed state (below 768px)', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      expect(sidebar.className).toContain('w-16');
    });

    it('should have md:w-60 class for expanded state (at 768px and above)', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      expect(sidebar.className).toContain('md:w-60');
    });

    it('should hide text labels below md breakpoint using hidden md:inline classes', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });

      // Section headings use "hidden md:block"
      for (const section of NAVIGATION_SECTIONS) {
        const heading = within(sidebar).getByText(section);
        expect(heading.className).toContain('hidden');
        expect(heading.className).toContain('md:block');
      }
    });

    it('should hide nav item text labels below md breakpoint using hidden md:inline classes', () => {
      renderLayout();

      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });

      // Nav item labels use "hidden md:inline"
      const dashboardLabel = within(sidebar).getByText('Dashboard');
      expect(dashboardLabel.className).toContain('hidden');
      expect(dashboardLabel.className).toContain('md:inline');
    });

    it('should offset main content area by sidebar width with responsive margin', () => {
      renderLayout();

      // The main content wrapper uses ml-16 md:ml-60
      const sidebar = screen.getByRole('complementary', { name: /admin sidebar navigation/i });
      const mainWrapper = sidebar.nextElementSibling;

      expect(mainWrapper).not.toBeNull();
      expect(mainWrapper!.className).toContain('ml-16');
      expect(mainWrapper!.className).toContain('md:ml-60');
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
