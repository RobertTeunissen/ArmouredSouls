import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ProfilePage from '../ProfilePage';
import * as userApi from '../../utils/userApi';

// Mock the AuthContext
const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser' },
    logout: mockLogout,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Navigation component
vi.mock('../../components/Navigation', () => ({
  default: () => <div data-testid="navigation">Navigation</div>,
}));

// Mock TutorialSettings component
vi.mock('../../components/TutorialSettings', () => ({
  default: () => <div data-testid="tutorial-settings">Tutorial Settings</div>,
}));

// Mock userApi
vi.mock('../../utils/userApi');

const mockProfileData: userApi.ProfileData = {
  id: 1,
  username: 'testuser',
  role: 'player',
  currency: 1000,
  prestige: 50,
  totalBattles: 10,
  totalWins: 5,
  highestELO: 1200,
  championshipTitles: 0,
  createdAt: '2024-01-01T00:00:00Z',
  stableName: 'Test Stable',
  profileVisibility: 'public',
  notificationsBattle: true,
  notificationsLeague: true,
  themePreference: 'dark',
};

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => 'mock-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Default mock implementation
    vi.mocked(userApi.getProfile).mockResolvedValue(mockProfileData);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderProfilePage = () => {
    return render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );
  };

  describe('Component Rendering', () => {
    it('should render all sections', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      // Check all section headers are present
      expect(screen.getByText('Account Information')).toBeInTheDocument();
      expect(screen.getByText('Stable Identity')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    it('should display profile data correctly', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      expect(screen.getByText('player')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should display error for invalid stable name', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const stableNameInput = screen.getByPlaceholderText('testuser');
      
      // Enter invalid stable name (too short)
      fireEvent.change(stableNameInput, { target: { value: 'ab' } });

      await waitFor(() => {
        expect(screen.getByText('Stable name must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('should display error for invalid password', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      // The "New Password" label is not associated via htmlFor, so find by input type
      const passwordInputs = document.querySelectorAll('input[type="password"]');
      const newPasswordInput = passwordInputs[1] as HTMLInputElement; // Second password input
      
      // Enter invalid password (too short)
      fireEvent.change(newPasswordInput, { target: { value: 'short' } });

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('should clear error when user corrects invalid input', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const stableNameInput = screen.getByPlaceholderText('testuser');
      
      // Enter invalid stable name
      fireEvent.change(stableNameInput, { target: { value: 'ab' } });

      await waitFor(() => {
        expect(screen.getByText('Stable name must be at least 3 characters')).toBeInTheDocument();
      });

      // Correct the input
      fireEvent.change(stableNameInput, { target: { value: 'Valid Name' } });

      await waitFor(() => {
        expect(screen.queryByText('Stable name must be at least 3 characters')).not.toBeInTheDocument();
      });
    });
  });

  describe('Save Button', () => {
    it('should be disabled when form is not dirty', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Changes');
      expect(saveButton).toBeDisabled();
    });

    it('should be enabled when form is dirty', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const stableNameInput = screen.getByPlaceholderText('testuser');
      fireEvent.change(stableNameInput, { target: { value: 'New Stable Name' } });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should be disabled when validation errors exist', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const stableNameInput = screen.getByPlaceholderText('testuser');
      fireEvent.change(stableNameInput, { target: { value: 'ab' } });

      await waitFor(() => {
        const saveButton = screen.getByText('Save Changes');
        expect(saveButton).toBeDisabled();
      });
    });
  });

  describe('Form Submission', () => {
    /** Helper: change stable name and wait for Save button to become enabled */
    async function changeStableNameAndWaitForButton(newName: string): Promise<HTMLElement> {
      const stableNameInput = screen.getByPlaceholderText('testuser');
      // Use native value setter to ensure React picks up the change
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )!.set!;
      await act(async () => {
        nativeInputValueSetter.call(stableNameInput, newName);
        stableNameInput.dispatchEvent(new Event('input', { bubbles: true }));
        stableNameInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Changes/i })).not.toBeDisabled();
      });
      return screen.getByRole('button', { name: /Save Changes/i });
    }

    it('should show success message on successful save', async () => {
      const updatedProfile = { ...mockProfileData, stableName: 'New Stable Name' };
      vi.mocked(userApi.updateProfile).mockResolvedValue(updatedProfile);

      renderProfilePage();
      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const saveButton = await changeStableNameAndWaitForButton('New Stable Name');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });
    });

    it('should display API error messages', async () => {
      vi.mocked(userApi.updateProfile).mockRejectedValue({
        response: { status: 409, data: { error: 'This stable name is already taken' } },
      });

      renderProfilePage();
      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const saveButton = await changeStableNameAndWaitForButton('Taken Name');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('This stable name is already taken')).toBeInTheDocument();
      });
    });

    it('should display validation errors from API', async () => {
      vi.mocked(userApi.updateProfile).mockRejectedValue({
        response: {
          status: 400,
          data: { error: 'Validation failed', details: { stableName: 'Stable name contains inappropriate content' } },
        },
      });

      renderProfilePage();
      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const saveButton = await changeStableNameAndWaitForButton('BadWord');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Stable name contains inappropriate content')).toBeInTheDocument();
      });
    });

    it('should display network error message', async () => {
      vi.mocked(userApi.updateProfile).mockRejectedValue({ request: {} });

      renderProfilePage();
      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const saveButton = await changeStableNameAndWaitForButton('New Name');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Network error. Please check your connection and try again.')).toBeInTheDocument();
      });
    });

    it('should call updateProfile with only changed fields', async () => {
      const updatedProfile = { ...mockProfileData, stableName: 'New Stable Name' };
      vi.mocked(userApi.updateProfile).mockResolvedValue(updatedProfile);

      renderProfilePage();
      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const saveButton = await changeStableNameAndWaitForButton('New Stable Name');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(userApi.updateProfile).toHaveBeenCalledWith({
          stableName: 'New Stable Name',
        });
      });
    });
  });

  describe('Cancel Button', () => {
    it('should clear edited state when cancel is clicked', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const stableNameInput = screen.getByPlaceholderText('testuser') as HTMLInputElement;
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      
      // Initially save button should be disabled
      expect(saveButton).toBeDisabled();
      
      // Make a change
      fireEvent.change(stableNameInput, { target: { value: 'New Stable Name' } });

      // Save button should now be enabled
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      // Save button should be disabled again after cancel
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });
  });
});
