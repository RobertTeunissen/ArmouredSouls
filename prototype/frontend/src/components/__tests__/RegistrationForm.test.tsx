import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegistrationForm from '../RegistrationForm';

vi.mock('../../utils/apiClient', () => ({
  default: {
    post: vi.fn(),
  },
}));

import apiClient from '../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

const mockOnSuccess = vi.fn();

function renderForm() {
  return render(<RegistrationForm onSuccess={mockOnSuccess} />);
}

describe('RegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    renderForm();

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    renderForm();

    const button = screen.getByRole('button', { name: /create account/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('renders the Register heading', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
  });

  it('manages controlled input state', async () => {
    const user = userEvent.setup();
    renderForm();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmInput = screen.getByLabelText(/confirm password/i);

    await user.type(usernameInput, 'testuser');
    await user.type(emailInput, 'test@email');
    await user.type(passwordInput, 'password123');
    await user.type(confirmInput, 'password123');

    expect(usernameInput).toHaveValue('testuser');
    expect(emailInput).toHaveValue('test@email');
    expect(passwordInput).toHaveValue('password123');
    expect(confirmInput).toHaveValue('password123');
  });

  it('marks all fields as required', () => {
    renderForm();

    expect(screen.getByLabelText(/username/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/^password$/i)).toBeRequired();
    expect(screen.getByLabelText(/confirm password/i)).toBeRequired();
  });

  it('uses password type for password fields', () => {
    renderForm();

    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('type', 'password');
  });

  it('shows error when passwords do not match on submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@email');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'different456');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  it('does not show error when passwords match on submit', async () => {
    const mockResponse = {
      data: {
        token: 'test-token',
        user: { id: '1', username: 'testuser', email: 'test@email', currency: 1000, prestige: 0, role: 'player' },
      },
    };
    mockedApiClient.post.mockResolvedValueOnce(mockResponse);

    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@email');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('clears errors when user modifies a field', async () => {
    const user = userEvent.setup();
    renderForm();

    // Fill all required fields, with mismatched passwords
    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@email');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'different456');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Typing in any field should clear the error
    await user.type(screen.getByLabelText(/confirm password/i), '7');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
