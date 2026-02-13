/**
 * User API utilities
 * Provides functions to interact with user-related endpoints
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Get authentication headers with token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

/**
 * Stable Statistics (aggregate across all robots)
 */
export interface StableStatistics {
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // Percentage
  avgELO: number;
  highestLeague: string | null;
  totalRobots: number;
  robotsReady: number;
}

export const getStableStatistics = async (): Promise<StableStatistics> => {
  const response = await axios.get(
    `${API_BASE_URL}/user/stats`,
    getAuthHeaders()
  );
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
  const response = await axios.get(
    `${API_BASE_URL}/user/profile`,
    getAuthHeaders()
  );
  return response.data;
};

/**
 * Update user profile fields
 */
export const updateProfile = async (
  updates: ProfileUpdateRequest
): Promise<ProfileData> => {
  const response = await axios.put(
    `${API_BASE_URL}/user/profile`,
    updates,
    getAuthHeaders()
  );
  return response.data;
};
