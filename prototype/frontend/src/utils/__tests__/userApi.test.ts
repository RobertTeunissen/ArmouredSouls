import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getProfile, updateProfile, getStableStatistics } from '../userApi';
import type { ProfileData, ProfileUpdateRequest, StableStatistics } from '../userApi';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('userApi', () => {
  beforeEach(() => {
    // Clear all mocks before each test
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
  });

  describe('getProfile', () => {
    it('should make correct API call to fetch profile', async () => {
      const mockProfileData: ProfileData = {
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

      mockedAxios.get.mockResolvedValueOnce({ data: mockProfileData });

      const result = await getProfile();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/user/profile',
        {
          headers: {
            Authorization: 'Bearer mock-token',
          },
        }
      );
      expect(result).toEqual(mockProfileData);
    });

    it('should handle network failures', async () => {
      const networkError = new Error('Network error');
      mockedAxios.get.mockRejectedValueOnce(networkError);

      await expect(getProfile()).rejects.toThrow('Network error');
    });

    it('should include auth token from localStorage', async () => {
      const mockToken = 'test-auth-token-123';
      const localStorageMock = {
        getItem: vi.fn(() => mockToken),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true,
      });

      mockedAxios.get.mockResolvedValueOnce({ data: {} });

      await getProfile();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      );
    });
  });

  describe('updateProfile', () => {
    it('should send correct request body for stable name update', async () => {
      const updateRequest: ProfileUpdateRequest = {
        stableName: 'New Stable Name',
      };

      const mockResponse: ProfileData = {
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
        stableName: 'New Stable Name',
        profileVisibility: 'public',
        notificationsBattle: true,
        notificationsLeague: true,
        themePreference: 'dark',
      };

      mockedAxios.put.mockResolvedValueOnce({ data: mockResponse });

      const result = await updateProfile(updateRequest);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        'http://localhost:3001/api/user/profile',
        updateRequest,
        {
          headers: {
            Authorization: 'Bearer mock-token',
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send correct request body for password change', async () => {
      const updateRequest: ProfileUpdateRequest = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass456',
      };

      mockedAxios.put.mockResolvedValueOnce({ data: {} });

      await updateProfile(updateRequest);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        'http://localhost:3001/api/user/profile',
        updateRequest,
        expect.any(Object)
      );
    });

    it('should send correct request body for multiple field updates', async () => {
      const updateRequest: ProfileUpdateRequest = {
        stableName: 'Updated Stable',
        profileVisibility: 'private',
        notificationsBattle: false,
        themePreference: 'light',
      };

      mockedAxios.put.mockResolvedValueOnce({ data: {} });

      await updateProfile(updateRequest);

      expect(mockedAxios.put).toHaveBeenCalledWith(
        'http://localhost:3001/api/user/profile',
        updateRequest,
        {
          headers: {
            Authorization: 'Bearer mock-token',
          },
        }
      );
    });

    it('should handle validation errors from API', async () => {
      const validationError = {
        response: {
          status: 400,
          data: {
            error: 'Validation failed',
            details: {
              stableName: 'Stable name must be between 3 and 30 characters',
            },
          },
        },
      };

      mockedAxios.put.mockRejectedValueOnce(validationError);

      await expect(updateProfile({ stableName: 'ab' })).rejects.toEqual(validationError);
    });

    it('should handle network failures', async () => {
      const networkError = new Error('Network error');
      mockedAxios.put.mockRejectedValueOnce(networkError);

      await expect(updateProfile({ stableName: 'Test' })).rejects.toThrow('Network error');
    });

    it('should handle 401 unauthorized errors', async () => {
      const authError = {
        response: {
          status: 401,
          data: {
            error: 'Invalid or expired token',
          },
        },
      };

      mockedAxios.put.mockRejectedValueOnce(authError);

      await expect(updateProfile({ stableName: 'Test' })).rejects.toEqual(authError);
    });

    it('should handle 409 conflict errors for duplicate stable name', async () => {
      const conflictError = {
        response: {
          status: 409,
          data: {
            error: 'This stable name is already taken',
          },
        },
      };

      mockedAxios.put.mockRejectedValueOnce(conflictError);

      await expect(updateProfile({ stableName: 'TakenName' })).rejects.toEqual(conflictError);
    });
  });

  describe('getStableStatistics', () => {
    it('should make correct API call to fetch stable statistics', async () => {
      const mockStats: StableStatistics = {
        totalBattles: 100,
        wins: 60,
        losses: 35,
        draws: 5,
        winRate: 60.0,
        avgELO: 1500,
        highestLeague: 'gold_2',
        totalRobots: 5,
        robotsReady: 3,
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockStats });

      const result = await getStableStatistics();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:3001/api/user/stats',
        {
          headers: {
            Authorization: 'Bearer mock-token',
          },
        }
      );
      expect(result).toEqual(mockStats);
    });

    it('should handle network failures', async () => {
      const networkError = new Error('Network error');
      mockedAxios.get.mockRejectedValueOnce(networkError);

      await expect(getStableStatistics()).rejects.toThrow('Network error');
    });
  });
});
