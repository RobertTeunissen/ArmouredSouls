/**
 * User API utilities
 * Provides functions to interact with user-related endpoints
 */

import { api } from './api';

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
  return api.get<StableStatistics>('/api/user/stats');
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
  return api.get<ProfileData>('/api/user/profile');
};

/**
 * Update user profile fields
 */
export const updateProfile = async (
  updates: ProfileUpdateRequest
): Promise<ProfileData> => {
  return api.put<ProfileData>('/api/user/profile', updates);
};
