import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import apiClient from '../apiClient';
import { getProfile, updateProfile, getStableStatistics } from '../userApi';
import type { ProfileData, ProfileUpdateRequest, StableStatistics } from '../userApi';

// Mock apiClient (used by the api helper internally)
vi.mock('../apiClient', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockedGet = apiClient.get as Mock;
const mockedPut = apiClient.put as Mock;

// Helper to create AxiosError with proper structure
function createAxiosError(
  status: number | null,
  data?: unknown,
  message = 'Request failed'
): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const error = new AxiosError(
    message,
    status !== null ? 'ERR_BAD_REQUEST' : 'ERR_NETWORK',
    config,
    undefined,
    status !== null
      ? {
          status,
          statusText: 'Error',
          headers: {},
          config,
          data,
        }
      : undefined
  );
  return error;
}

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

      mockedGet.mockResolvedValueOnce({ data: mockProfileData });

      const result = await getProfile();

      expect(mockedGet).toHaveBeenCalledWith('/api/user/profile', { params: undefined });
      expect(result).toEqual(mockProfileData);
    });

    it('should handle network failures', async () => {
      const networkError = createAxiosError(null);
      mockedGet.mockRejectedValueOnce(networkError);

      await expect(getProfile()).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Network error',
      });
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

      mockedPut.mockResolvedValueOnce({ data: mockResponse });

      const result = await updateProfile(updateRequest);

      expect(mockedPut).toHaveBeenCalledWith('/api/user/profile', updateRequest);
      expect(result).toEqual(mockResponse);
    });

    it('should send correct request body for password change', async () => {
      const updateRequest: ProfileUpdateRequest = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass456',
      };

      mockedPut.mockResolvedValueOnce({ data: {} });

      await updateProfile(updateRequest);

      expect(mockedPut).toHaveBeenCalledWith('/api/user/profile', updateRequest);
    });

    it('should handle validation errors from API', async () => {
      const validationError = createAxiosError(400, {
        code: 'VALIDATION_ERROR',
        error: 'Validation failed',
        details: {
          stableName: 'Stable name must be between 3 and 30 characters',
        },
      });

      mockedPut.mockRejectedValueOnce(validationError);

      await expect(updateProfile({ stableName: 'ab' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        statusCode: 400,
        details: {
          stableName: 'Stable name must be between 3 and 30 characters',
        },
      });
    });

    it('should handle network failures', async () => {
      const networkError = createAxiosError(null);
      mockedPut.mockRejectedValueOnce(networkError);

      await expect(updateProfile({ stableName: 'Test' })).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Network error',
      });
    });

    it('should handle 401 unauthorized errors', async () => {
      const authError = createAxiosError(401, {
        code: 'AUTH_INVALID_TOKEN',
        error: 'Invalid or expired token',
      });

      mockedPut.mockRejectedValueOnce(authError);

      await expect(updateProfile({ stableName: 'Test' })).rejects.toMatchObject({
        code: 'AUTH_INVALID_TOKEN',
        message: 'Invalid or expired token',
        statusCode: 401,
      });
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

      mockedGet.mockResolvedValueOnce({ data: mockStats });

      const result = await getStableStatistics();

      expect(mockedGet).toHaveBeenCalledWith('/api/user/stats', { params: undefined });
      expect(result).toEqual(mockStats);
    });

    it('should handle network failures', async () => {
      const networkError = createAxiosError(null);
      mockedGet.mockRejectedValueOnce(networkError);

      await expect(getStableStatistics()).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Network error',
      });
    });
  });
});
