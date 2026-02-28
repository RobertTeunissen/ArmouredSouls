import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../LoginPage';

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

function renderLoginPage() {
  return render(<LoginPage />);
}

/**
 * Validates: Requirements 11.8
 * Component tests for the enhanced login form that accepts username or email.
 */
describe('LoginPage - Enhanced Login Form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the identifier field labeled "Username or Email"', () => {
    renderLoginPage();

    const label = screen.getByLabelText(/username or email/i);
    expect(label).toBeInTheDocument();
  });

  it('renders the identifier field with placeholder "Enter username or email"', () => {
    renderLoginPage();

    const input = screen.getByPlaceholderText('Enter username or email');
    expect(input).toBeInTheDocument();
  });

  it('accepts a username value in the identifier field', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const identifierInput = screen.getByLabelText(/username or email/i);
    await user.type(identifierInput, 'myusername');

    expect(identifierInput).toHaveValue('myusername');
  });

  it('accepts an email value in the identifier field', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const identifierInput = screen.getByLabelText(/username or email/i);
    await user.type(identifierInput, 'user@example.com');

    expect(identifierInput).toHaveValue('user@example.com');
  });

  it('calls login with identifier and password on form submission', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username or email/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'mypassword');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'mypassword');
    });
  });

  it('calls login with email identifier on form submission', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username or email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'securepass');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'securepass');
    });
  });

  it('navigates to dashboard on successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username or email/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'mypassword');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid username or password'));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username or email/i), 'baduser');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
    });
  });
});
