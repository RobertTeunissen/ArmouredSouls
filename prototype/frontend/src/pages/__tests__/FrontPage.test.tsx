// Component tests for FrontPage
// **Validates: Requirements 11.11**

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    refreshUser: vi.fn(),
    user: null,
    token: null,
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  }),
}));

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

import FrontPage from '../FrontPage';

describe('FrontPage component tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('default rendering', () => {
    it('renders with login view by default', () => {
      render(<FrontPage />);

      // Login tab should be selected
      const loginTab = screen.getByRole('tab', { name: /login/i });
      expect(loginTab).toHaveAttribute('aria-selected', 'true');

      // Register tab should not be selected
      const registerTab = screen.getByRole('tab', { name: /register/i });
      expect(registerTab).toHaveAttribute('aria-selected', 'false');

      // Login form heading should be visible
      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    });

    it('displays the logo and branding', () => {
      render(<FrontPage />);

      expect(screen.getByAltText('Armoured Souls')).toBeInTheDocument();
      expect(screen.getByText('ARMOURED SOULS')).toBeInTheDocument();
    });
  });

  describe('tab navigation accessibility', () => {
    it('tabs have role="tab" and aria-selected attributes', () => {
      render(<FrontPage />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(2);

      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute('aria-selected');
      });
    });

    it('navigation has aria-label', () => {
      render(<FrontPage />);

      expect(screen.getByRole('navigation', { name: /authentication/i })).toBeInTheDocument();
    });
  });

  describe('view switching', () => {
    it('switches to registration form when Register tab is clicked', async () => {
      const user = userEvent.setup();
      render(<FrontPage />);

      await user.click(screen.getByRole('tab', { name: /register/i }));

      expect(screen.getByRole('tab', { name: /register/i })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: /login/i })).toHaveAttribute(
        'aria-selected',
        'false',
      );
      expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
    });

    it('switches back to login form when Login tab is clicked', async () => {
      const user = userEvent.setup();
      render(<FrontPage />);

      // Go to register
      await user.click(screen.getByRole('tab', { name: /register/i }));
      // Go back to login
      await user.click(screen.getByRole('tab', { name: /login/i }));

      expect(screen.getByRole('tab', { name: /login/i })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    });
  });

  describe('login form fields', () => {
    it('has identifier and password fields', () => {
      render(<FrontPage />);

      expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });
  });

  describe('registration form fields', () => {
    it('has username, email, password, and confirm password fields', async () => {
      const user = userEvent.setup();
      render(<FrontPage />);

      await user.click(screen.getByRole('tab', { name: /register/i }));

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });
  });
});
