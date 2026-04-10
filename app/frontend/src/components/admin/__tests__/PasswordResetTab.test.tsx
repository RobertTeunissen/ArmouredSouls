import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PasswordResetTab } from '../PasswordResetTab';

vi.mock('../../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

import apiClient from '../../../utils/apiClient';
const mockedApiClient = vi.mocked(apiClient);

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockSearchResults = {
  users: [
    { id: 1, username: 'player1', email: 'player1@example.com', stableName: 'Iron Fist' },
    { id: 2, username: 'player2', email: 'player2@example.com', stableName: null },
  ],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function searchAndSelectUser(): Promise<void> {
  mockedApiClient.get.mockResolvedValueOnce({ data: mockSearchResults });

  const searchInput = screen.getByLabelText('Search users');
  fireEvent.change(searchInput, { target: { value: 'player1' } });
  fireEvent.submit(searchInput.closest('form')!);

  await waitFor(() => {
    expect(screen.getByText('player1')).toBeInTheDocument();
  });

  fireEvent.click(screen.getByText('player1'));
}

function fillPasswordForm(password: string, confirm: string): void {
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: confirm } });
}

function getSubmitButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Reset Password' });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('PasswordResetTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input and form elements', () => {
    render(<PasswordResetTab />);

    expect(screen.getByTestId('password-reset-tab')).toBeInTheDocument();
    expect(screen.getByLabelText('Search users')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('🔑 Password Reset')).toBeInTheDocument();
  });

  it('should display search results after API call', async () => {
    render(<PasswordResetTab />);

    mockedApiClient.get.mockResolvedValueOnce({ data: mockSearchResults });

    const searchInput = screen.getByLabelText('Search users');
    fireEvent.change(searchInput, { target: { value: 'player' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('player1')).toBeInTheDocument();
    });

    expect(screen.getByText('player2')).toBeInTheDocument();
    expect(screen.getByText('(Iron Fist)')).toBeInTheDocument();
    expect(screen.getByText('· player1@example.com')).toBeInTheDocument();
    expect(screen.getByText('· ID: 1')).toBeInTheDocument();

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/admin/users/search', {
      params: { q: 'player' },
    });
  });

  it('should show "No users found" for empty results', async () => {
    render(<PasswordResetTab />);

    mockedApiClient.get.mockResolvedValueOnce({ data: { users: [] } });

    const searchInput = screen.getByLabelText('Search users');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
  });

  describe('password validation', () => {
    beforeEach(async () => {
      render(<PasswordResetTab />);
      await searchAndSelectUser();
    });

    it('should show error for password too short', async () => {
      fillPasswordForm('Ab1', 'Ab1');
      fireEvent.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('should show error for missing uppercase letter', async () => {
      fillPasswordForm('abcdefg1', 'abcdefg1');
      fireEvent.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one uppercase letter')).toBeInTheDocument();
      });
    });

    it('should show error for missing lowercase letter', async () => {
      fillPasswordForm('ABCDEFG1', 'ABCDEFG1');
      fireEvent.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one lowercase letter')).toBeInTheDocument();
      });
    });

    it('should show error for missing number', async () => {
      fillPasswordForm('Abcdefgh', 'Abcdefgh');
      fireEvent.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one number')).toBeInTheDocument();
      });
    });
  });

  it('should validate password confirmation match', async () => {
    render(<PasswordResetTab />);
    await searchAndSelectUser();

    fillPasswordForm('ValidPass1', 'DifferentPass1');
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('should disable submit button during request (loading state)', async () => {
    render(<PasswordResetTab />);
    await searchAndSelectUser();

    // Make the post hang so we can observe the loading state
    mockedApiClient.post.mockReturnValue(new Promise(() => {}));

    fillPasswordForm('ValidPass1', 'ValidPass1');
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Resetting...' });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  it('should show success message on 200 response', async () => {
    render(<PasswordResetTab />);
    await searchAndSelectUser();

    mockedApiClient.post.mockResolvedValueOnce({
      data: { success: true, userId: 1, username: 'player1' },
    });

    fillPasswordForm('ValidPass1', 'ValidPass1');
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText('Password successfully reset for player1')).toBeInTheDocument();
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/admin/users/1/reset-password', {
      password: 'ValidPass1',
    });
  });

  it('should show error message on API error', async () => {
    render(<PasswordResetTab />);
    await searchAndSelectUser();

    mockedApiClient.post.mockRejectedValueOnce({
      response: { data: { error: 'User not found' } },
    });

    fillPasswordForm('ValidPass1', 'ValidPass1');
    fireEvent.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument();
    });
  });
});
