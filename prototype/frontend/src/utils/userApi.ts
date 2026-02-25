/**
 * User API utilities
 * Provides functions to interact with user-related endpoints
 */

import apiClient from './apiClient';

/**
 * Stable Statistics (aggregate across all robots)
 */
export interface StableStatistics {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // Percentage
  highestELO: number;
  highestLeague: string | null;
  highestTagTeamLeague: string | null;
  totalRobots: number;
  prestige: number;
  prestigeRank: string;
  cycleChanges: {
    prestige: number;
    wins: number;
    losses: number;
    highestElo: number;
  } | null;
}

export const getStableStatistics = async (): Promise<StableStatistics> => {
  const response = await apiClient.get('/api/user/stats');
  return response.data;
};

/**
 * Profile Data (complete user profile information)
 */
export interface ProfileData {
  id: number;
  username: string;
  role: string;
  currency: number;
  prestige: number;
  totalBattles: number;
  totalWins: number;
  highestELO: number;
  championshipTitles: number;
  createdAt: string; // ISO 8601
  stableName: string | null;
  profileVisibility: "public" | "private";
  notificationsBattle: boolean;
  notificationsLeague: boolean;
  themePreference: "dark" | "light" | "auto";
}

/**
 * Profile Update Request (all fields optional)
 */
export interface ProfileUpdateRequest {
  stableName?: string;
  profileVisibility?: "public" | "private";
  notificationsBattle?: boolean;
  notificationsLeague?: boolean;
  themePreference?: "dark" | "light" | "auto";
  currentPassword?: string;
  newPassword?: string;
}

/**
 * Get current user's profile information
 */
export const getProfile = async (): Promise<ProfileData> => {
  const response = await apiClient.get('/api/user/profile');
  return response.data;
};

/**
 * Update user profile fields
 */
export const updateProfile = async (
  updates: ProfileUpdateRequest
): Promise<ProfileData> => {
  const response = await apiClient.put('/api/user/profile', updates);
  return response.data;
};
