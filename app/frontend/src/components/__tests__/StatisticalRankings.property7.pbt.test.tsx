import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import StatisticalRankings from '../StatisticalRankings';
import apiClient from '../../utils/apiClient';

// Mock apiClient (imported by StatisticalRankings)
vi.mock('../../utils/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

const mockedApiClient = vi.mocked(apiClient);

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * Property-Based Tests for Robot Detail Page Visual Enhancement
 * Feature: robot-detail-page-visual-enhancement
 * Testing Framework: fast-check with minimum 100 iterations
 */

/**
 * Property 7: Rankings Reflect Current Stats
 * **Validates: Requirements 2.5**
 * 
 * For any robot, when attribute values change, the displayed rankings should update 
 * to reflect the new calculated positions.
 */
describe('Property 7: Rankings Reflect Current Stats (Property-Based Test)', () => {
  it('should update rankings when robot stats change', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }),
        fc.record({
          rank: fc.integer({ min: 1, max: 1000 }),
          total: fc.integer({ min: 100, max: 1000 }),
        }),
        fc.record({
          rank: fc.integer({ min: 1, max: 1000 }),
          total: fc.integer({ min: 100, max: 1000 }),
        }),
        async (robotId, initialRanking, updatedRanking) => {
          const initialTotal = Math.max(initialRanking.rank, initialRanking.total);
          const updatedTotal = Math.max(updatedRanking.rank, updatedRanking.total);
          
          const initialPercentile = (1 - (initialRanking.rank - 1) / initialTotal) * 100;
          const updatedPercentile = (1 - (updatedRanking.rank - 1) / updatedTotal) * 100;
          
          const initialMockRankings = {
            combatCategory: { rank: initialRanking.rank, total: initialTotal, percentile: initialPercentile, value: 100 },
            defenseCategory: { rank: initialRanking.rank, total: initialTotal, percentile: initialPercentile, value: 100 },
            chassisCategory: { rank: initialRanking.rank, total: initialTotal, percentile: initialPercentile, value: 100 },
            aiCategory: { rank: initialRanking.rank, total: initialTotal, percentile: initialPercentile, value: 100 },
            teamCategory: { rank: initialRanking.rank, total: initialTotal, percentile: initialPercentile, value: 100 },
            totalDamageDealt: { rank: initialRanking.rank, total: initialTotal, percentile: initialPercentile, value: 1000 },
            winRate: { rank: initialRanking.rank, total: initialTotal, percentile: initialPercentile, value: 0.75 },
            elo: { rank: initialRanking.rank, total: initialTotal, percentile: initialPercentile, value: 1500 },
            kdRatio: { rank: initialRanking.rank, total: initialTotal, percentile: initialPercentile, value: 2.5 },
          };
          
          const updatedMockRankings = {
            combatCategory: { rank: updatedRanking.rank, total: updatedTotal, percentile: updatedPercentile, value: 120 },
            defenseCategory: { rank: updatedRanking.rank, total: updatedTotal, percentile: updatedPercentile, value: 110 },
            chassisCategory: { rank: updatedRanking.rank, total: updatedTotal, percentile: updatedPercentile, value: 105 },
            aiCategory: { rank: updatedRanking.rank, total: updatedTotal, percentile: updatedPercentile, value: 115 },
            teamCategory: { rank: updatedRanking.rank, total: updatedTotal, percentile: updatedPercentile, value: 108 },
            totalDamageDealt: { rank: updatedRanking.rank, total: updatedTotal, percentile: updatedPercentile, value: 1500 },
            winRate: { rank: updatedRanking.rank, total: updatedTotal, percentile: updatedPercentile, value: 0.80 },
            elo: { rank: updatedRanking.rank, total: updatedTotal, percentile: updatedPercentile, value: 1600 },
            kdRatio: { rank: updatedRanking.rank, total: updatedTotal, percentile: updatedPercentile, value: 3.0 },
          };
          
          mockedApiClient.get.mockResolvedValueOnce({ data: initialMockRankings });
          
          const { rerender, unmount } = render(<StatisticalRankings robotId={robotId} />);
          
          try {
            // Wait for initial rankings to load
            await waitFor(() => {
              const displays = screen.getAllByText(`#${initialRanking.rank} / ${initialTotal}`);
              expect(displays.length).toBeGreaterThanOrEqual(9);
            }, { timeout: 2000 });
            
            // Use a different robotId to trigger useEffect re-fetch
            const updatedRobotId = robotId + 10000;
            mockedApiClient.get.mockResolvedValueOnce({ data: updatedMockRankings });
            rerender(<StatisticalRankings robotId={updatedRobotId} />);
            
            await waitFor(() => {
              const updatedRankDisplays = screen.getAllByText(`#${updatedRanking.rank} / ${updatedTotal}`);
              expect(updatedRankDisplays.length).toBeGreaterThanOrEqual(9);
            }, { timeout: 2000 });
            
            if (initialRanking.rank !== updatedRanking.rank || initialTotal !== updatedTotal) {
              const oldRankDisplays = screen.queryAllByText(`#${initialRanking.rank} / ${initialTotal}`);
              expect(oldRankDisplays.length).toBe(0);
            }
          } finally {
            unmount();
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
