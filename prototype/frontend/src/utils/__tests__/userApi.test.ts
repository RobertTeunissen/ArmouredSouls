import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '../apiClient';
import { getProfile, updateProfile, getStableStatistics } from '../userApi';
import type { ProfileData, ProfileUpdateRequest, StableStatistics } from '../userApi';

// Mock apiClient
vi.mock('../apiClient', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

describe('userApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      mockedApiClient.get.mockResolvedValueOnce({ data: mockProfileData });

      const result = await getProfile();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/user/profile');
      expect(result).toEqual(mockProfileData);
    });

    it('should handle network failures', async () => {
      const networkError = new Error('Network error');
      mockedApiClient.get.mockRejectedValueOnce(networkError);

      await expect(getProfile()).rejects.toThrow('Network error');
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

      mockedApiClient.put.mockResolvedValueOnce({ data: mockResponse });

      const result = await updateProfile(updateRequest);

      expect(mockedApiClient.put).toHaveBeenCalledWith(
        '/api/user/profile',
        updateRequest
      );
      expect(result).toEqual(mockResponse);
    });

    it('should send correct request body for password change', async () => {
      const updateRequest: ProfileUpdateRequest = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass456',
      };

      mockedApiClient.put.mockResolvedValueOnce({ data: {} });

      await updateProfile(updateRequest);

      expect(mockedApiClient.put).toHaveBeenCalledWith(
        '/api/user/profile',
        updateRequest
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

      mockedApiClient.put.mockRejectedValueOnce(validationError);

      await expect(updateProfile({ stableName: 'ab' })).rejects.toEqual(validationError);
    });

    it('should handle network failures', async () => {
      const networkError = new Error('Network error');
      mockedApiClient.put.mockRejectedValueOnce(networkError);

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

      mockedApiClient.put.mockRejectedValueOnce(authError);

      await expect(updateProfile({ stableName: 'Test' })).rejects.toEqual(authError);
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
        highestELO: 1500,
        highestLeague: 'gold',
        highestTagTeamLeague: null,
        totalRobots: 5,
        prestige: 100,
        prestigeRank: 'Novice',
        cycleChanges: null,
      };

      mockedApiClient.get.mockResolvedValueOnce({ data: mockStats });

      const result = await getStableStatistics();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/user/stats');
      expect(result).toEqual(mockStats);
    });

    it('should handle network failures', async () => {
      const networkError = new Error('Network error');
      mockedApiClient.get.mockRejectedValueOnce(networkError);

      await expect(getStableStatistics()).rejects.toThrow('Network error');
    });
  });
});
