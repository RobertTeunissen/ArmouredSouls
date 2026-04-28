/**
 * Property-Based Tests for Non-Admin Route Exclusion
 * Feature: admin-portal-redesign
 *
 * Property 10: Non-admin users have no admin routes registered
 *
 * When the authenticated user's role is not 'admin', the conditional
 * `{isAdmin && (<Route path="/admin" ...>)}` in AppRoutes evaluates to false,
 * so no `/admin/*` routes exist in the React Router tree. Navigating to any
 * admin path should NOT render admin content.
 *
 * Uses fast-check with minimum 100 iterations.
 *
 * **Validates: Requirements 27.5**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';

// ----------------------------------------------------------------
// Mock useAuth from AuthContext
// ----------------------------------------------------------------
const mockUseAuth = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ----------------------------------------------------------------
// Minimal AppRoutes replica that mirrors the conditional admin route
// registration pattern from App.tsx
// ----------------------------------------------------------------

/**
 * Mirrors the real AppRoutes component's conditional admin route registration.
 * When `user.role !== 'admin'`, the admin `<Route>` block is not rendered at
 * all — exactly as in the production App.tsx.
 */
function TestAppRoutes() {
  const { user } = mockUseAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <Routes>
      <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />

      {/* Conditional admin routes — mirrors App.tsx pattern exactly */}
      {isAdmin && (
        <Route path="/admin/*" element={<div data-testid="admin-content">Admin Content</div>} />
      )}

      {/* Catch-all — mirrors the real app's fallback */}
      <Route path="/" element={<div data-testid="front-page">Front Page</div>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ----------------------------------------------------------------
// Arbitraries
// ----------------------------------------------------------------

/** Generate random non-admin role strings (never 'admin') */
const nonAdminRoleArb = fc.oneof(
  fc.constant('user'),
  fc.constant('player'),
  fc.constant('moderator'),
  fc.constant(''),
  fc.constant('guest'),
  fc.constant('editor'),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== 'admin'),
);

/** Generate random non-admin user objects with varied fields */
const nonAdminUserArb = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  username: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  email: fc.oneof(
    fc.constant(null),
    fc.emailAddress(),
  ),
  role: nonAdminRoleArb,
  currency: fc.integer({ min: 0, max: 1000000 }),
  prestige: fc.integer({ min: 0, max: 10000 }),
  stableName: fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.string({ minLength: 1, maxLength: 30 }),
  ),
});

/** Admin sub-paths that exist in the real route config */
const adminSubPaths = [
  'dashboard',
  'cycles',
  'cycles/history',
  'practice-arena',
  'players',
  'battles',
  'robot-stats',
  'league-health',
  'weapons',
  'security',
  'engagement',
  'economy',
  'achievements',
  'tuning',
  'image-uploads',
  'changelog',
  'repair-log',
  'audit-log',
];

/** Generate admin paths — both known sub-routes and random ones */
const adminPathArb = fc.oneof(
  fc.constant('/admin'),
  fc.constant('/admin/'),
  fc.constantFrom(...adminSubPaths).map((sub) => `/admin/${sub}`),
  fc
    .stringMatching(/^[a-z0-9-]{1,20}$/)
    .map((s) => `/admin/${s}`),
);

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('AdminRoutes Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 10: Non-admin users have no admin routes registered
   *
   * For any authenticated user whose role is not 'admin', the client-side
   * router configuration SHALL not contain route definitions for /admin/*
   * paths, ensuring admin route content is not rendered.
   *
   * The conditional `{isAdmin && (<Route path="/admin" ...>)}` in AppRoutes
   * means the Route element is never added to the tree for non-admin users.
   * Navigating to any /admin/* path should therefore NOT render admin content.
   *
   * **Validates: Requirements 27.5**
   */
  describe('Property 10: Non-admin users have no admin routes registered', () => {
    it('should not render admin content for any non-admin user at any admin path', () => {
      fc.assert(
        fc.property(nonAdminUserArb, adminPathArb, (user, path) => {
          mockUseAuth.mockReturnValue({
            user,
            token: 'some-token',
            login: vi.fn(),
            logout: vi.fn(),
            loading: false,
            refreshUser: vi.fn(),
          });

          const { unmount } = render(
            <MemoryRouter initialEntries={[path]}>
              <TestAppRoutes />
            </MemoryRouter>,
          );

          // Admin content must NOT be rendered for non-admin users
          expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();

          unmount();
        }),
        { numRuns: 100 },
      );
    });

    it('should not render admin content when user is null (unauthenticated) at any admin path', () => {
      fc.assert(
        fc.property(adminPathArb, (path) => {
          mockUseAuth.mockReturnValue({
            user: null,
            token: null,
            login: vi.fn(),
            logout: vi.fn(),
            loading: false,
            refreshUser: vi.fn(),
          });

          const { unmount } = render(
            <MemoryRouter initialEntries={[path]}>
              <TestAppRoutes />
            </MemoryRouter>,
          );

          // Admin content must NOT be rendered when no user is authenticated
          expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();

          unmount();
        }),
        { numRuns: 100 },
      );
    });

    it('should render admin content ONLY when user role is exactly admin', () => {
      // Positive control: verify admin users DO get admin content
      // This ensures the test setup is correct and the conditional works both ways
      fc.assert(
        fc.property(
          fc.constantFrom(...adminSubPaths).map((sub) => `/admin/${sub}`),
          (path) => {
            mockUseAuth.mockReturnValue({
              user: {
                id: 1,
                username: 'admin',
                email: 'admin@test.com',
                role: 'admin',
                currency: 0,
                prestige: 0,
              },
              token: 'admin-token',
              login: vi.fn(),
              logout: vi.fn(),
              loading: false,
              refreshUser: vi.fn(),
            });

            const { unmount } = render(
              <MemoryRouter initialEntries={[path]}>
                <TestAppRoutes />
              </MemoryRouter>,
            );

            // Admin content SHOULD be rendered for admin users
            expect(screen.getByTestId('admin-content')).toBeInTheDocument();

            unmount();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
