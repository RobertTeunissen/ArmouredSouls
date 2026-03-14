import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { renderHook } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

/**
 * Bug Condition Exploration Tests - Mobile Responsiveness Defects
 *
 * These tests encode the EXPECTED (correct) behavior. On unfixed code,
 * they will FAIL — confirming the bugs exist. After the fix is applied,
 * they will PASS — confirming the bugs are resolved.
 *
 * **Validates: Requirements 1.1, 1.11, 1.12**
 */

describe('Bug Condition: Mobile Responsiveness Defects', () => {
  /**
   * Test 1 - Breakpoint Mismatch
   *
   * The Navigation component switches to mobile layout at Tailwind lg: (1024px).
   * The useIsMobile hooks should return true for viewports < 1024px to match.
   *
   * Bug Condition: isBugCondition(input) where viewportWidth < 1024
   *   AND hookBreakpoint != navigationBreakpoint
   *
   * On unfixed code, useIsMobile returns false in [768, 1023] — the "dead zone"
   * where Navigation renders mobile but hooks say "desktop". Test will FAIL.
   *
   * **Validates: Requirements 1.1, 1.12**
   */
  describe('Test 1 - Breakpoint Mismatch: useIsMobile dead zone [768, 1023]', () => {
    let originalInnerWidth: number;

    beforeEach(() => {
      originalInnerWidth = window.innerWidth;
    });

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it('useIsMobile (useIsMobile.ts) should return true for any viewport in [768, 1023]', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 768, max: 1023 }),
          async (viewportWidth) => {
            // Set window.innerWidth to the generated viewport width
            Object.defineProperty(window, 'innerWidth', {
              writable: true,
              configurable: true,
              value: viewportWidth,
            });

            // Re-import to get fresh module state
            vi.resetModules();
            const { useIsMobile } = await import('../hooks/useIsMobile');

            const { result } = renderHook(() => useIsMobile());

            // Expected: hook returns true for viewports < 1024 (aligned with Navigation lg: breakpoint)
            expect(result.current).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('useIsMobile (useMediaQuery.ts) should return true for any viewport in [768, 1023]', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 768, max: 1023 }),
          async (viewportWidth) => {
            // Mock matchMedia to simulate the viewport width
            Object.defineProperty(window, 'matchMedia', {
              writable: true,
              configurable: true,
              value: vi.fn().mockImplementation((query: string) => {
                // Parse max-width from the query
                const maxWidthMatch = query.match(/\(max-width:\s*(\d+)px\)/);
                let matches = false;
                if (maxWidthMatch) {
                  const maxWidth = parseInt(maxWidthMatch[1], 10);
                  matches = viewportWidth <= maxWidth;
                }
                return {
                  matches,
                  media: query,
                  onchange: null,
                  addListener: vi.fn(),
                  removeListener: vi.fn(),
                  addEventListener: vi.fn(),
                  removeEventListener: vi.fn(),
                  dispatchEvent: vi.fn(),
                };
              }),
            });

            vi.resetModules();
            const { useIsMobile } = await import('../hooks/useMediaQuery');

            const { result } = renderHook(() => useIsMobile());

            // Expected: hook returns true for viewports < 1024 (aligned with Navigation lg: breakpoint)
            expect(result.current).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Test 2 - Design Token Violations
   *
   * Pages should use Tailwind design tokens (bg-background, bg-surface, etc.)
   * instead of hardcoded gray values (bg-gray-900, bg-gray-800, etc.).
   *
   * On unfixed code, multiple pages contain hardcoded gray patterns — test will FAIL.
   *
   * **Validates: Requirements 1.11**
   */
  describe('Test 2 - Design Token Violations: hardcoded gray patterns in page components', () => {
    const HARDCODED_GRAY_PATTERNS = [
      'bg-gray-900',
      'bg-gray-800',
      'bg-gray-700',
      'text-gray-400',
      'text-gray-500',
      'border-gray-700',
    ];

    const AFFECTED_PAGE_FILES = [
      'LeagueStandingsPage.tsx',
      'AdminPage.tsx',
      'FinancialReportPage.tsx',
      'HallOfRecordsPage.tsx',
      'DashboardPage.tsx',
      'TournamentDetailPage.tsx',
      'CreateRobotPage.tsx',
    ];

    it('should have no hardcoded gray patterns in any affected page component', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...AFFECTED_PAGE_FILES),
          (fileName) => {
            const filePath = path.resolve(
              __dirname,
              '..',
              'pages',
              fileName,
            );
            const source = fs.readFileSync(filePath, 'utf-8');

            const foundPatterns = HARDCODED_GRAY_PATTERNS.filter((pattern) =>
              source.includes(pattern),
            );

            // Expected: no hardcoded gray patterns (design tokens should be used instead)
            expect(foundPatterns).toEqual([]);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
