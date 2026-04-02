import { create } from 'zustand';
import { fetchMyRobots, Robot } from '../utils/robotApi';

export interface RobotState {
  robots: Robot[];
  loading: boolean;
  error: string | null;
  fetchRobots: () => Promise<void>;
  clear: () => void;
}

const initialState = {
  robots: [] as Robot[],
  loading: false,
  error: null as string | null,
};

export const useRobotStore = create<RobotState>((set) => ({
  ...initialState,

  fetchRobots: async () => {
    set({ loading: true, error: null });
    try {
      const robots = await fetchMyRobots();
      set({ robots, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch robots',
        loading: false,
      });
    }
  },

  clear: () => set({ ...initialState }),
}));
