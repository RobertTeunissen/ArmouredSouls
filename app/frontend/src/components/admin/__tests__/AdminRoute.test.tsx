/**
 * Unit Tests for AdminRoute Guard
 *
 * Tests the four key states of the AdminRoute guard component:
 * 1. Loading state shows spinner
 * 2. Admin user renders children
 * 3. Non-admin user redirects to /dashboard
 * 4. Unauthenticated user redirects to /login
 *
 * _Requirements: 3.1, 3.2, 3.3, 3.4_
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from '../AdminRoute';

// ----------------------------------------------------------------
// Mock useAuth from AuthContext
// ----------------------------------------------------------------
const mockUseAuth = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

/** Render AdminRoute at /admin/dashboard with sibling routes for redirect detection */
function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <div data-testid="admin-content">Admin Content</div>
            </AdminRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('AdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Requirement 3.4: While the authentication state is loading, the
   * Admin_Route_Guard SHALL display a loading indicator instead of redirecting.
   */
  it('should show loading indicator when auth state is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      login: vi.fn(),
      logout: vi.fn(),
      loading: true,
      refreshUser: vi.fn(),
    });

    renderAdminRoute();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });

  /**
   * Requirement 3.1: The Admin_Route_Guard SHALL verify that the authenticated
   * user's role equals 'admin' before rendering any admin page.
   */
  it('should render children when user has admin role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin', currency: 1000, prestige: 50 },
      token: 'valid-token',
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
      refreshUser: vi.fn(),
    });

    renderAdminRoute();

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });

  /**
   * Requirement 3.2: When a non-admin authenticated user navigates to any
   * /admin/* route, the Admin_Route_Guard SHALL redirect to /dashboard.
   */
  it('should redirect non-admin user to /dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, username: 'player1', email: 'player@test.com', role: 'user', currency: 500, prestige: 10 },
      token: 'valid-token',
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
      refreshUser: vi.fn(),
    });

    renderAdminRoute();

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  /**
   * Requirement 3.3: When an unauthenticated user navigates to any /admin/*
   * route, the Admin_Route_Guard SHALL redirect to /login.
   */
  it('should redirect unauthenticated user to /login', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      token: null,
      login: vi.fn(),
      logout: vi.fn(),
      loading: false,
      refreshUser: vi.fn(),
    });

    renderAdminRoute();

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });
});
