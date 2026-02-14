import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import StatisticalRankings from '../StatisticalRankings';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
 * Property 5: Rank Display Format
 * **Validates: Requirements 2.3**
 * 
 * For any robot ranking, the displayed rank should follow the format "#X of Y" 
 * where X is the robot's position and Y is the total number of robots.
 * 
 * This property test verifies that across all valid ranking scenarios (different ranks,
 * different totals, different categories), the rank display always follows the exact
 * format "#X of Y".
 */
describe('Property 5: Rank Display Format (Property-Based Test)', () => {
  it('should always display rank in format "#X of Y" for any valid ranking', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate random rank (position)
        fc.integer({ min: 1, max: 1000 }),
        // Generate random total (must be >= rank)
        fc.integer({ min: 1, max: 1000 }),
        async (robotId, rank, total) => {
          // Ensure total >= rank (valid ranking scenario)
          const validTotal = Math.max(rank, total);
          
          // Calculate percentile
          const percentile = (1 - (rank - 1) / validTotal) * 100;
          
          // Create mock ranking data with all required categories
          const mockRankings = {
            combatCategory: { rank, total: validTotal, percentile, value: 100 },
            defenseCategory: { rank, total: validTotal, percentile, value: 100 },
            chassisCategory: { rank, total: validTotal, percentile, value: 100 },
            aiCategory: { rank, total: validTotal, percentile, value: 100 },
            teamCategory: { rank, total: validTotal, percentile, value: 100 },
            totalDamageDealt: { rank, total: validTotal, percentile, value: 1000 },
            winRate: { rank, total: validTotal, percentile, value: 0.75 },
            elo: { rank, total: validTotal, percentile, value: 1500 },
            kdRatio: { rank, total: validTotal, percentile, value: 2.5 },
          };
          
          // Mock axios response
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          // Wait for component to load - use findAllByText since there might be multiple from previous iterations
          const headers = await screen.findAllByText(/Statistical Rankings/i);
          expect(headers.length).toBeGreaterThan(0);
          
          // Property: Every ranking card must display rank in format "#X of Y"
          const expectedFormat = `#${rank} of ${validTotal}`;
          const rankDisplays = screen.getAllByText(expectedFormat);
          
          // Property: There should be at least 9 ranking cards (9 categories) - might be more from previous iterations
          expect(rankDisplays.length).toBeGreaterThanOrEqual(9);
          
          // Property: Each rank display must match the exact format
          rankDisplays.forEach(display => {
            expect(display.textContent).toBe(expectedFormat);
          });
          
          cleanup(); // Clean up after each iteration
        }
      ),
      { numRuns: 100 } // Minimum 100 iterations as specified in design
    );
  });

  it('should display correct rank format for edge case rankings', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate edge case scenarios
        fc.constantFrom(
          { rank: 1, total: 1 },      // Only robot
          { rank: 1, total: 1000 },   // First place
          { rank: 1000, total: 1000 }, // Last place
          { rank: 500, total: 1000 },  // Middle
          { rank: 1, total: 10 },      // Small pool, first
          { rank: 10, total: 10 }      // Small pool, last
        ),
        async (robotId, scenario) => {
          const { rank, total } = scenario;
          const percentile = (1 - (rank - 1) / total) * 100;
          
          // Create mock ranking data
          const mockRankings = {
            combatCategory: { rank, total, percentile, value: 100 },
            defenseCategory: { rank, total, percentile, value: 100 },
            chassisCategory: { rank, total, percentile, value: 100 },
            aiCategory: { rank, total, percentile, value: 100 },
            teamCategory: { rank, total, percentile, value: 100 },
            totalDamageDealt: { rank, total, percentile, value: 1000 },
            winRate: { rank, total, percentile, value: 0.75 },
            elo: { rank, total, percentile, value: 1500 },
            kdRatio: { rank, total, percentile, value: 2.5 },
          };
          
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          const headers = await screen.findAllByText(/Statistical Rankings/i);
          expect(headers.length).toBeGreaterThan(0);
          
          // Property: Rank format must be correct for edge cases
          const expectedFormat = `#${rank} of ${total}`;
          const rankDisplays = screen.getAllByText(expectedFormat);
          
          expect(rankDisplays.length).toBeGreaterThanOrEqual(9);
          
          cleanup(); // Clean up after each iteration
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display different rank formats for different categories correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate different ranks for different categories
        fc.record({
          combatRank: fc.integer({ min: 1, max: 500 }),
          defenseRank: fc.integer({ min: 1, max: 500 }),
          chassisRank: fc.integer({ min: 1, max: 500 }),
          aiRank: fc.integer({ min: 1, max: 500 }),
          teamRank: fc.integer({ min: 1, max: 500 }),
          damageRank: fc.integer({ min: 1, max: 500 }),
          winRateRank: fc.integer({ min: 1, max: 500 }),
          eloRank: fc.integer({ min: 1, max: 500 }),
          kdRank: fc.integer({ min: 1, max: 500 }),
          total: fc.integer({ min: 500, max: 1000 }),
        }),
        async (robotId, ranks) => {
          const { total } = ranks;
          
          // Create mock ranking data with different ranks per category
          const mockRankings = {
            combatCategory: { 
              rank: ranks.combatRank, 
              total, 
              percentile: (1 - (ranks.combatRank - 1) / total) * 100, 
              value: 100 
            },
            defenseCategory: { 
              rank: ranks.defenseRank, 
              total, 
              percentile: (1 - (ranks.defenseRank - 1) / total) * 100, 
              value: 100 
            },
            chassisCategory: { 
              rank: ranks.chassisRank, 
              total, 
              percentile: (1 - (ranks.chassisRank - 1) / total) * 100, 
              value: 100 
            },
            aiCategory: { 
              rank: ranks.aiRank, 
              total, 
              percentile: (1 - (ranks.aiRank - 1) / total) * 100, 
              value: 100 
            },
            teamCategory: { 
              rank: ranks.teamRank, 
              total, 
              percentile: (1 - (ranks.teamRank - 1) / total) * 100, 
              value: 100 
            },
            totalDamageDealt: { 
              rank: ranks.damageRank, 
              total, 
              percentile: (1 - (ranks.damageRank - 1) / total) * 100, 
              value: 1000 
            },
            winRate: { 
              rank: ranks.winRateRank, 
              total, 
              percentile: (1 - (ranks.winRateRank - 1) / total) * 100, 
              value: 0.75 
            },
            elo: { 
              rank: ranks.eloRank, 
              total, 
              percentile: (1 - (ranks.eloRank - 1) / total) * 100, 
              value: 1500 
            },
            kdRatio: { 
              rank: ranks.kdRank, 
              total, 
              percentile: (1 - (ranks.kdRank - 1) / total) * 100, 
              value: 2.5 
            },
          };
          
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          const headers = await screen.findAllByText(/Statistical Rankings/i);
          expect(headers.length).toBeGreaterThan(0);
          
          // Property: Each category must display its specific rank in correct format
          const categories = [
            { rank: ranks.combatRank, name: 'Combat' },
            { rank: ranks.defenseRank, name: 'Defense' },
            { rank: ranks.chassisRank, name: 'Chassis' },
            { rank: ranks.aiRank, name: 'AI' },
            { rank: ranks.teamRank, name: 'Team' },
            { rank: ranks.damageRank, name: 'Total Damage' },
            { rank: ranks.winRateRank, name: 'Win Rate' },
            { rank: ranks.eloRank, name: 'ELO Rating' },
            { rank: ranks.kdRank, name: 'K/D Ratio' },
          ];
          
          // Verify each category displays correct rank format
          for (const category of categories) {
            const expectedFormat = `#${category.rank} of ${total}`;
            // Use getAllByText since multiple categories might have the same rank
            const rankDisplays = screen.getAllByText(expectedFormat);
            expect(rankDisplays.length).toBeGreaterThan(0);
          }
          
          cleanup(); // Clean up after each iteration
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout for property-based test

  it('should maintain rank format consistency across multiple renders', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate array of ranking scenarios (reduced to 2 for performance)
        fc.array(
          fc.record({
            rank: fc.integer({ min: 1, max: 1000 }),
            total: fc.integer({ min: 1, max: 1000 }),
          }),
          { minLength: 1, maxLength: 2 }
        ),
        async (robotId, scenarios) => {
          for (const scenario of scenarios) {
            const { rank, total } = scenario;
            const validTotal = Math.max(rank, total);
            const percentile = (1 - (rank - 1) / validTotal) * 100;
            
            const mockRankings = {
              combatCategory: { rank, total: validTotal, percentile, value: 100 },
              defenseCategory: { rank, total: validTotal, percentile, value: 100 },
              chassisCategory: { rank, total: validTotal, percentile, value: 100 },
              aiCategory: { rank, total: validTotal, percentile, value: 100 },
              teamCategory: { rank, total: validTotal, percentile, value: 100 },
              totalDamageDealt: { rank, total: validTotal, percentile, value: 1000 },
              winRate: { rank, total: validTotal, percentile, value: 0.75 },
              elo: { rank, total: validTotal, percentile, value: 1500 },
              kdRatio: { rank, total: validTotal, percentile, value: 2.5 },
            };
            
            mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
            
            render(<StatisticalRankings robotId={robotId} />);
            
            const headers = await screen.findAllByText(/Statistical Rankings/i);
            expect(headers.length).toBeGreaterThan(0);
            
            // Property: Format must be consistent across renders
            const expectedFormat = `#${rank} of ${validTotal}`;
            const rankDisplays = screen.getAllByText(expectedFormat);
            
            expect(rankDisplays.length).toBeGreaterThanOrEqual(9);
            
            // Verify format structure: starts with #, contains " of ", ends with number
            rankDisplays.forEach(display => {
              const text = display.textContent || '';
              expect(text).toMatch(/^#\d+ of \d+$/);
              expect(text).toBe(expectedFormat);
            });
            
            cleanup(); // Clean up between iterations
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout

  it('should display rank format with correct spacing and punctuation', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate random rank and total
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        async (robotId, rank, total) => {
          const validTotal = Math.max(rank, total);
          const percentile = (1 - (rank - 1) / validTotal) * 100;
          
          const mockRankings = {
            combatCategory: { rank, total: validTotal, percentile, value: 100 },
            defenseCategory: { rank, total: validTotal, percentile, value: 100 },
            chassisCategory: { rank, total: validTotal, percentile, value: 100 },
            aiCategory: { rank, total: validTotal, percentile, value: 100 },
            teamCategory: { rank, total: validTotal, percentile, value: 100 },
            totalDamageDealt: { rank, total: validTotal, percentile, value: 1000 },
            winRate: { rank, total: validTotal, percentile, value: 0.75 },
            elo: { rank, total: validTotal, percentile, value: 1500 },
            kdRatio: { rank, total: validTotal, percentile, value: 2.5 },
          };
          
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          const headers = await screen.findAllByText(/Statistical Rankings/i);
          expect(headers.length).toBeGreaterThan(0);
          
          // Property: Format must have exact spacing and punctuation
          const rankDisplays = screen.getAllByText(`#${rank} of ${validTotal}`);
          
          rankDisplays.forEach(display => {
            const text = display.textContent || '';
            
            // Must start with # (no space before)
            expect(text).toMatch(/^#/);
            
            // Must have exactly one space after rank number
            expect(text).toMatch(/^#\d+ of/);
            
            // Must have exactly one space before total number
            expect(text).toMatch(/of \d+$/);
            
            // Must not have extra spaces
            expect(text).not.toMatch(/  /); // No double spaces
            expect(text).not.toMatch(/# /); // No space after #
            expect(text).not.toMatch(/ $/); // No trailing space
            expect(text).not.toMatch(/^ /); // No leading space
          });
          
          cleanup(); // Clean up after each iteration
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout
});

/**
 * Property 6: Percentile Badge Display
 * **Validates: Requirements 2.4**
 * 
 * For any robot ranking, when the percentile is in the top 10%, a gold badge should be displayed;
 * when in the top 25%, a silver badge; when in the top 50%, a bronze badge.
 * 
 * This property test verifies that across all valid percentile values (0-100),
 * the correct badge is displayed based on the percentile thresholds:
 * - Top 10% (percentile >= 90): Gold badge (bg-yellow-500, "Top 10%")
 * - Top 25% (percentile >= 75): Silver badge (bg-gray-400, "Top 25%")
 * - Top 50% (percentile >= 50): Bronze badge (bg-amber-700, "Top 50%")
 * - Below 50%: No badge
 */
describe('Property 6: Percentile Badge Display (Property-Based Test)', () => {
  it('should display gold badge for top 10% (percentile >= 90)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate percentile in top 10% range
        fc.float({ min: 90, max: 100, noNaN: true }),
        async (robotId, percentile) => {
          // Calculate rank and total that would produce this percentile
          // percentile = (1 - (rank - 1) / total) * 100
          // Solving for rank: rank = 1 + total * (1 - percentile / 100)
          const total = 1000;
          const rank = Math.max(1, Math.floor(1 + total * (1 - percentile / 100)));
          
          // Create mock ranking data
          const mockRankings = {
            combatCategory: { rank, total, percentile, value: 100 },
            defenseCategory: { rank, total, percentile, value: 100 },
            chassisCategory: { rank, total, percentile, value: 100 },
            aiCategory: { rank, total, percentile, value: 100 },
            teamCategory: { rank, total, percentile, value: 100 },
            totalDamageDealt: { rank, total, percentile, value: 1000 },
            winRate: { rank, total, percentile, value: 0.75 },
            elo: { rank, total, percentile, value: 1500 },
            kdRatio: { rank, total, percentile, value: 2.5 },
          };
          
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          await screen.findAllByText(/Statistical Rankings/i);
          
          // Property: Gold badge must be displayed for top 10%
          const goldBadges = screen.getAllByText('Top 10%');
          expect(goldBadges.length).toBeGreaterThanOrEqual(9); // All 9 categories
          
          // Property: Gold badge must have yellow background (bg-yellow-500)
          goldBadges.forEach(badge => {
            expect(badge).toHaveClass('bg-yellow-500');
            expect(badge).toHaveClass('text-white');
          });
          
          // Property: No silver or bronze badges should be displayed
          expect(screen.queryByText('Top 25%')).toBeNull();
          expect(screen.queryByText('Top 50%')).toBeNull();
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display silver badge for top 25% (75 <= percentile < 90)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate percentile in top 25% range (but not top 10%)
        fc.float({ min: 75, max: Math.fround(89.99), noNaN: true }),
        async (robotId, percentile) => {
          const total = 1000;
          const rank = Math.max(1, Math.floor(1 + total * (1 - percentile / 100)));
          
          const mockRankings = {
            combatCategory: { rank, total, percentile, value: 100 },
            defenseCategory: { rank, total, percentile, value: 100 },
            chassisCategory: { rank, total, percentile, value: 100 },
            aiCategory: { rank, total, percentile, value: 100 },
            teamCategory: { rank, total, percentile, value: 100 },
            totalDamageDealt: { rank, total, percentile, value: 1000 },
            winRate: { rank, total, percentile, value: 0.75 },
            elo: { rank, total, percentile, value: 1500 },
            kdRatio: { rank, total, percentile, value: 2.5 },
          };
          
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          await screen.findAllByText(/Statistical Rankings/i);
          
          // Property: Silver badge must be displayed for top 25%
          const silverBadges = screen.getAllByText('Top 25%');
          expect(silverBadges.length).toBeGreaterThanOrEqual(9);
          
          // Property: Silver badge must have gray background (bg-gray-400)
          silverBadges.forEach(badge => {
            expect(badge).toHaveClass('bg-gray-400');
            expect(badge).toHaveClass('text-white');
          });
          
          // Property: No gold or bronze badges should be displayed
          expect(screen.queryByText('Top 10%')).toBeNull();
          expect(screen.queryByText('Top 50%')).toBeNull();
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display bronze badge for top 50% (50 <= percentile < 75)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate percentile in top 50% range (but not top 25%)
        fc.float({ min: 50, max: Math.fround(74.99), noNaN: true }),
        async (robotId, percentile) => {
          const total = 1000;
          const rank = Math.max(1, Math.floor(1 + total * (1 - percentile / 100)));
          
          const mockRankings = {
            combatCategory: { rank, total, percentile, value: 100 },
            defenseCategory: { rank, total, percentile, value: 100 },
            chassisCategory: { rank, total, percentile, value: 100 },
            aiCategory: { rank, total, percentile, value: 100 },
            teamCategory: { rank, total, percentile, value: 100 },
            totalDamageDealt: { rank, total, percentile, value: 1000 },
            winRate: { rank, total, percentile, value: 0.75 },
            elo: { rank, total, percentile, value: 1500 },
            kdRatio: { rank, total, percentile, value: 2.5 },
          };
          
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          await screen.findAllByText(/Statistical Rankings/i);
          
          // Property: Bronze badge must be displayed for top 50%
          const bronzeBadges = screen.getAllByText('Top 50%');
          expect(bronzeBadges.length).toBeGreaterThanOrEqual(9);
          
          // Property: Bronze badge must have amber background (bg-amber-700)
          bronzeBadges.forEach(badge => {
            expect(badge).toHaveClass('bg-amber-700');
            expect(badge).toHaveClass('text-white');
          });
          
          // Property: No gold or silver badges should be displayed
          expect(screen.queryByText('Top 10%')).toBeNull();
          expect(screen.queryByText('Top 25%')).toBeNull();
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display no badge for below top 50% (percentile < 50)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate percentile below 50%
        fc.float({ min: 0, max: Math.fround(49.99), noNaN: true }),
        async (robotId, percentile) => {
          const total = 1000;
          const rank = Math.max(1, Math.floor(1 + total * (1 - percentile / 100)));
          
          const mockRankings = {
            combatCategory: { rank, total, percentile, value: 100 },
            defenseCategory: { rank, total, percentile, value: 100 },
            chassisCategory: { rank, total, percentile, value: 100 },
            aiCategory: { rank, total, percentile, value: 100 },
            teamCategory: { rank, total, percentile, value: 100 },
            totalDamageDealt: { rank, total, percentile, value: 1000 },
            winRate: { rank, total, percentile, value: 0.75 },
            elo: { rank, total, percentile, value: 1500 },
            kdRatio: { rank, total, percentile, value: 2.5 },
          };
          
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          await screen.findAllByText(/Statistical Rankings/i);
          
          // Property: No badges should be displayed for below 50%
          expect(screen.queryByText('Top 10%')).toBeNull();
          expect(screen.queryByText('Top 25%')).toBeNull();
          expect(screen.queryByText('Top 50%')).toBeNull();
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display correct badge for edge case percentiles', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate edge case percentiles
        fc.constantFrom(
          { percentile: 100, expectedBadge: 'Top 10%', expectedColor: 'bg-yellow-500' },
          { percentile: 90, expectedBadge: 'Top 10%', expectedColor: 'bg-yellow-500' },
          { percentile: 89.99, expectedBadge: 'Top 25%', expectedColor: 'bg-gray-400' },
          { percentile: 75, expectedBadge: 'Top 25%', expectedColor: 'bg-gray-400' },
          { percentile: 74.99, expectedBadge: 'Top 50%', expectedColor: 'bg-amber-700' },
          { percentile: 50, expectedBadge: 'Top 50%', expectedColor: 'bg-amber-700' },
          { percentile: 49.99, expectedBadge: null, expectedColor: null },
          { percentile: 0, expectedBadge: null, expectedColor: null }
        ),
        async (robotId, scenario) => {
          const { percentile, expectedBadge, expectedColor } = scenario;
          const total = 1000;
          const rank = Math.max(1, Math.floor(1 + total * (1 - percentile / 100)));
          
          const mockRankings = {
            combatCategory: { rank, total, percentile, value: 100 },
            defenseCategory: { rank, total, percentile, value: 100 },
            chassisCategory: { rank, total, percentile, value: 100 },
            aiCategory: { rank, total, percentile, value: 100 },
            teamCategory: { rank, total, percentile, value: 100 },
            totalDamageDealt: { rank, total, percentile, value: 1000 },
            winRate: { rank, total, percentile, value: 0.75 },
            elo: { rank, total, percentile, value: 1500 },
            kdRatio: { rank, total, percentile, value: 2.5 },
          };
          
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          await screen.findAllByText(/Statistical Rankings/i);
          
          // Property: Correct badge must be displayed for edge cases
          if (expectedBadge) {
            const badges = screen.getAllByText(expectedBadge);
            expect(badges.length).toBeGreaterThanOrEqual(9);
            
            badges.forEach(badge => {
              expect(badge).toHaveClass(expectedColor!);
              expect(badge).toHaveClass('text-white');
            });
          } else {
            // No badge should be displayed
            expect(screen.queryByText('Top 10%')).toBeNull();
            expect(screen.queryByText('Top 25%')).toBeNull();
            expect(screen.queryByText('Top 50%')).toBeNull();
          }
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display different badges for different categories with varying percentiles', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate different percentiles for different categories
        fc.record({
          combatPercentile: fc.float({ min: 0, max: 100, noNaN: true }),
          defensePercentile: fc.float({ min: 0, max: 100, noNaN: true }),
          chassisPercentile: fc.float({ min: 0, max: 100, noNaN: true }),
          aiPercentile: fc.float({ min: 0, max: 100, noNaN: true }),
          teamPercentile: fc.float({ min: 0, max: 100, noNaN: true }),
          damagePercentile: fc.float({ min: 0, max: 100, noNaN: true }),
          winRatePercentile: fc.float({ min: 0, max: 100, noNaN: true }),
          eloPercentile: fc.float({ min: 0, max: 100, noNaN: true }),
          kdPercentile: fc.float({ min: 0, max: 100, noNaN: true }),
        }),
        async (robotId, percentiles) => {
          const total = 1000;
          
          // Helper function to get expected badge
          const getExpectedBadge = (percentile: number) => {
            if (percentile >= 90) return 'Top 10%';
            if (percentile >= 75) return 'Top 25%';
            if (percentile >= 50) return 'Top 50%';
            return null;
          };
          
          // Create mock ranking data with different percentiles per category
          const mockRankings = {
            combatCategory: { 
              rank: Math.max(1, Math.floor(1 + total * (1 - percentiles.combatPercentile / 100))), 
              total, 
              percentile: percentiles.combatPercentile, 
              value: 100 
            },
            defenseCategory: { 
              rank: Math.max(1, Math.floor(1 + total * (1 - percentiles.defensePercentile / 100))), 
              total, 
              percentile: percentiles.defensePercentile, 
              value: 100 
            },
            chassisCategory: { 
              rank: Math.max(1, Math.floor(1 + total * (1 - percentiles.chassisPercentile / 100))), 
              total, 
              percentile: percentiles.chassisPercentile, 
              value: 100 
            },
            aiCategory: { 
              rank: Math.max(1, Math.floor(1 + total * (1 - percentiles.aiPercentile / 100))), 
              total, 
              percentile: percentiles.aiPercentile, 
              value: 100 
            },
            teamCategory: { 
              rank: Math.max(1, Math.floor(1 + total * (1 - percentiles.teamPercentile / 100))), 
              total, 
              percentile: percentiles.teamPercentile, 
              value: 100 
            },
            totalDamageDealt: { 
              rank: Math.max(1, Math.floor(1 + total * (1 - percentiles.damagePercentile / 100))), 
              total, 
              percentile: percentiles.damagePercentile, 
              value: 1000 
            },
            winRate: { 
              rank: Math.max(1, Math.floor(1 + total * (1 - percentiles.winRatePercentile / 100))), 
              total, 
              percentile: percentiles.winRatePercentile, 
              value: 0.75 
            },
            elo: { 
              rank: Math.max(1, Math.floor(1 + total * (1 - percentiles.eloPercentile / 100))), 
              total, 
              percentile: percentiles.eloPercentile, 
              value: 1500 
            },
            kdRatio: { 
              rank: Math.max(1, Math.floor(1 + total * (1 - percentiles.kdPercentile / 100))), 
              total, 
              percentile: percentiles.kdPercentile, 
              value: 2.5 
            },
          };
          
          mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
          
          render(<StatisticalRankings robotId={robotId} />);
          
          await screen.findAllByText(/Statistical Rankings/i);
          
          // Property: Each category must display the correct badge based on its percentile
          const allPercentiles = Object.values(percentiles);
          const expectedGoldCount = allPercentiles.filter(p => p >= 90).length;
          const expectedSilverCount = allPercentiles.filter(p => p >= 75 && p < 90).length;
          const expectedBronzeCount = allPercentiles.filter(p => p >= 50 && p < 75).length;
          
          const goldBadges = screen.queryAllByText('Top 10%');
          const silverBadges = screen.queryAllByText('Top 25%');
          const bronzeBadges = screen.queryAllByText('Top 50%');
          
          expect(goldBadges.length).toBe(expectedGoldCount);
          expect(silverBadges.length).toBe(expectedSilverCount);
          expect(bronzeBadges.length).toBe(expectedBronzeCount);
          
          // Verify badge colors
          goldBadges.forEach(badge => expect(badge).toHaveClass('bg-yellow-500'));
          silverBadges.forEach(badge => expect(badge).toHaveClass('bg-gray-400'));
          bronzeBadges.forEach(badge => expect(badge).toHaveClass('bg-amber-700'));
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout

  it('should maintain badge consistency across multiple renders', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random robot ID
        fc.integer({ min: 1, max: 10000 }),
        // Generate array of percentile scenarios (reduced to 2 for performance)
        fc.array(
          fc.float({ min: 0, max: 100, noNaN: true }),
          { minLength: 1, maxLength: 2 }
        ),
        async (robotId, percentiles) => {
          for (const percentile of percentiles) {
            const total = 1000;
            const rank = Math.max(1, Math.floor(1 + total * (1 - percentile / 100)));
            
            const mockRankings = {
              combatCategory: { rank, total, percentile, value: 100 },
              defenseCategory: { rank, total, percentile, value: 100 },
              chassisCategory: { rank, total, percentile, value: 100 },
              aiCategory: { rank, total, percentile, value: 100 },
              teamCategory: { rank, total, percentile, value: 100 },
              totalDamageDealt: { rank, total, percentile, value: 1000 },
              winRate: { rank, total, percentile, value: 0.75 },
              elo: { rank, total, percentile, value: 1500 },
              kdRatio: { rank, total, percentile, value: 2.5 },
            };
            
            mockedAxios.get.mockResolvedValueOnce({ data: mockRankings });
            
            render(<StatisticalRankings robotId={robotId} />);
            
            await screen.findAllByText(/Statistical Rankings/i);
            
            // Property: Badge display must be consistent with percentile value
            if (percentile >= 90) {
              const badges = screen.getAllByText('Top 10%');
              expect(badges.length).toBeGreaterThanOrEqual(9);
              badges.forEach(badge => expect(badge).toHaveClass('bg-yellow-500'));
            } else if (percentile >= 75) {
              const badges = screen.getAllByText('Top 25%');
              expect(badges.length).toBeGreaterThanOrEqual(9);
              badges.forEach(badge => expect(badge).toHaveClass('bg-gray-400'));
            } else if (percentile >= 50) {
              const badges = screen.getAllByText('Top 50%');
              expect(badges.length).toBeGreaterThanOrEqual(9);
              badges.forEach(badge => expect(badge).toHaveClass('bg-amber-700'));
            } else {
              expect(screen.queryByText('Top 10%')).toBeNull();
              expect(screen.queryByText('Top 25%')).toBeNull();
              expect(screen.queryByText('Top 50%')).toBeNull();
            }
            
            cleanup();
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 30000); // 30 second timeout
});


/**
 * Property 7: Rankings Reflect Current Stats
 * **Validates: Requirements 2.5**
 * 
 * For any robot, when attribute values change, the displayed rankings should update 
 * to reflect the new calculated positions.
 * 
 * This property test verifies that when robot statistics change (simulated by re-fetching data),
 * the component correctly updates to display the new rankings.
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
          // Ensure rankings are different to test update behavior
          if (initialRanking.rank === updatedRanking.rank && initialRanking.total === updatedRanking.total) {
            // Skip this test case if rankings are identical
            return true;
          }
          
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
          
          // Clear any previous mocks
          mockedAxios.get.mockClear();
          
          mockedAxios.get.mockResolvedValueOnce({ data: initialMockRankings });
          
          const { unmount } = render(<StatisticalRankings robotId={robotId} />);
          
          try {
            // Wait for initial render
            await waitFor(() => {
              const initialRankDisplays = screen.queryAllByText(`#${initialRanking.rank} of ${initialTotal}`);
              expect(initialRankDisplays.length).toBeGreaterThanOrEqual(9);
            }, { timeout: 3000 });
            
            // Verify initial rankings are displayed
            const initialRankDisplays = screen.getAllByText(`#${initialRanking.rank} of ${initialTotal}`);
            expect(initialRankDisplays.length).toBeGreaterThanOrEqual(9);
            
            // Unmount and remount with new data to simulate stats change
            unmount();
            cleanup();
            
            mockedAxios.get.mockClear();
            mockedAxios.get.mockResolvedValueOnce({ data: updatedMockRankings });
            
            render(<StatisticalRankings robotId={robotId} />);
            
            // Wait for updated render
            await waitFor(() => {
              const updatedRankDisplays = screen.queryAllByText(`#${updatedRanking.rank} of ${updatedTotal}`);
              expect(updatedRankDisplays.length).toBeGreaterThanOrEqual(9);
            }, { timeout: 3000 });
            
            // Verify updated rankings are displayed
            const updatedRankDisplays = screen.getAllByText(`#${updatedRanking.rank} of ${updatedTotal}`);
            expect(updatedRankDisplays.length).toBeGreaterThanOrEqual(9);
            
            // Verify old rankings are no longer displayed (only if they're different from updated)
            const oldRankFormat = `#${initialRanking.rank} of ${initialTotal}`;
            const newRankFormat = `#${updatedRanking.rank} of ${updatedTotal}`;
            if (oldRankFormat !== newRankFormat) {
              const oldRankDisplays = screen.queryAllByText(oldRankFormat);
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
