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
