import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
      expect(screen.getByText('Statistics')).toBeInTheDocument();
      expect(screen.getByText('Privacy Settings')).toBeInTheDocument();
      expect(screen.getByText('Display Preferences')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
    });

    it('should display profile data correctly', async () => {
      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('testuser')).toBeInTheDocument();
      });

      expect(screen.getByText('player')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('₡1,000')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
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

      const newPasswordInput = screen.getByLabelText('New Password');
      
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
    it('should show success message on successful save', async () => {
      const updatedProfile = { ...mockProfileData, stableName: 'New Stable Name' };
      vi.mocked(userApi.updateProfile).mockResolvedValue(updatedProfile);

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const stableNameInput = screen.getByPlaceholderText('testuser');
      fireEvent.change(stableNameInput, { target: { value: 'New Stable Name' } });

      // Find button by text before it changes
      const saveButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Save Changes');
      expect(saveButton).toBeDefined();
      fireEvent.click(saveButton!);

      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });
    });

    it('should display API error messages', async () => {
      const apiError = {
        response: {
          status: 409,
          data: {
            error: 'This stable name is already taken',
          },
        },
      };
      vi.mocked(userApi.updateProfile).mockRejectedValue(apiError);

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const stableNameInput = screen.getByPlaceholderText('testuser');
      fireEvent.change(stableNameInput, { target: { value: 'Taken Name' } });

      const saveButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Save Changes');
      expect(saveButton).toBeDefined();
      fireEvent.click(saveButton!);

      await waitFor(() => {
        expect(screen.getByText('This stable name is already taken')).toBeInTheDocument();
      });
    });

    it('should display validation errors from API', async () => {
      const apiError = {
        response: {
          status: 400,
          data: {
            error: 'Validation failed',
            details: {
              stableName: 'Stable name contains inappropriate content',
            },
          },
        },
      };
      vi.mocked(userApi.updateProfile).mockRejectedValue(apiError);

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const stableNameInput = screen.getByPlaceholderText('testuser');
      fireEvent.change(stableNameInput, { target: { value: 'BadWord' } });

      const saveButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Save Changes');
      expect(saveButton).toBeDefined();
      fireEvent.click(saveButton!);

      await waitFor(() => {
        expect(screen.getByText('Stable name contains inappropriate content')).toBeInTheDocument();
      });
    });

    it('should display network error message', async () => {
      const networkError = {
        request: {},
      };
      vi.mocked(userApi.updateProfile).mockRejectedValue(networkError);

      renderProfilePage();

      await waitFor(() => {
        expect(screen.getByText('My Profile')).toBeInTheDocument();
      });

      const stableNameInput = screen.getByPlaceholderText('testuser');
      fireEvent.change(stableNameInput, { target: { value: 'New Name' } });

      const saveButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Save Changes');
      expect(saveButton).toBeDefined();
      fireEvent.click(saveButton!);

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

      const stableNameInput = screen.getByPlaceholderText('testuser');
      fireEvent.change(stableNameInput, { target: { value: 'New Stable Name' } });

      // Get button before it changes to "Saving..."
      const saveButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Save Changes');
      expect(saveButton).toBeDefined();
      fireEvent.click(saveButton!);

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
      const saveButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Save Changes');
      
      // Initially save button should be disabled
      expect(saveButton).toBeDefined();
      expect(saveButton).toBeDisabled();
      
      // Make a change
      fireEvent.change(stableNameInput, { target: { value: 'New Stable Name' } });

      // Save button should now be enabled
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });

      // Click cancel
      const cancelButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Cancel');
      expect(cancelButton).toBeDefined();
      fireEvent.click(cancelButton!);

      // Save button should be disabled again after cancel
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });
  });
});
