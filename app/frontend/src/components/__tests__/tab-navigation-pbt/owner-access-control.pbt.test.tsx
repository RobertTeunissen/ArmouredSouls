import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import TabNavigation from '../../TabNavigation';
import { ALL_TABS, type TabId } from './helpers';

/**
 * Property 2: Owner-Only Tab Access Control
 * **Validates: Requirements 1.6, 6.1**
 *
 * For any robot and any user, when the user is not the robot owner,
 * the Battle Config, Upgrades, and Stats tabs should not be visible or accessible.
 */
describe('Property 2: Owner-Only Tab Access Control (Property-Based Test)', () => {
  it('should never render owner-only tabs when isOwner is false', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_TABS),
        (activeTab) => {
          const mockOnTabChange = vi.fn();

          const { container } = render(
            <BrowserRouter>
              <TabNavigation
                activeTab={activeTab}
                onTabChange={mockOnTabChange}
                isOwner={false}
              />
            </BrowserRouter>
          );

          const battleConfigTab = screen.queryByRole('tab', { name: /battle config/i });
          const upgradesTab = screen.queryByRole('tab', { name: /upgrades/i });
          const statsTab = screen.queryByRole('tab', { name: /stats/i });

          expect(battleConfigTab).not.toBeInTheDocument();
          expect(upgradesTab).not.toBeInTheDocument();
          expect(statsTab).not.toBeInTheDocument();

          const overviewTab = screen.getByRole('tab', { name: /overview/i });
          const matchesTab = screen.getByRole('tab', { name: /matches/i });
          const analyticsTab = screen.getByRole('tab', { name: /analytics/i });

          expect(overviewTab).toBeInTheDocument();
          expect(matchesTab).toBeInTheDocument();
          expect(analyticsTab).toBeInTheDocument();

          const allTabs = screen.getAllByRole('tab');
          expect(allTabs).toHaveLength(3);

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always render all tabs when isOwner is true', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_TABS),
        (activeTab) => {
          const mockOnTabChange = vi.fn();

          const { container } = render(
            <BrowserRouter>
              <TabNavigation
                activeTab={activeTab}
                onTabChange={mockOnTabChange}
                isOwner={true}
              />
            </BrowserRouter>
          );

          expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
          expect(screen.getByRole('tab', { name: /matches/i })).toBeInTheDocument();
          expect(screen.getByRole('tab', { name: /analytics/i })).toBeInTheDocument();
          expect(screen.getByRole('tab', { name: /battle config/i })).toBeInTheDocument();
          expect(screen.getByRole('tab', { name: /upgrades/i })).toBeInTheDocument();
          expect(screen.getByRole('tab', { name: /tuning/i })).toBeInTheDocument();
          expect(screen.getByRole('tab', { name: /stats/i })).toBeInTheDocument();

          const allTabs = screen.getAllByRole('tab');
          expect(allTabs).toHaveLength(7);

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain owner-only access control across multiple ownership states', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isOwner: fc.boolean(),
            activeTab: fc.constantFrom('overview' as TabId, 'matches' as TabId)
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (testCases) => {
          for (const testCase of testCases) {
            const mockOnTabChange = vi.fn();

            const { container } = render(
              <BrowserRouter>
                <TabNavigation
                  activeTab={testCase.activeTab}
                  onTabChange={mockOnTabChange}
                  isOwner={testCase.isOwner}
                />
              </BrowserRouter>
            );

            const battleConfigTab = screen.queryByRole('tab', { name: /battle config/i });
            const upgradesTab = screen.queryByRole('tab', { name: /upgrades/i });

            if (testCase.isOwner) {
              expect(battleConfigTab).toBeInTheDocument();
              expect(upgradesTab).toBeInTheDocument();
              expect(screen.getAllByRole('tab')).toHaveLength(7);
            } else {
              expect(battleConfigTab).not.toBeInTheDocument();
              expect(upgradesTab).not.toBeInTheDocument();
              expect(screen.getAllByRole('tab')).toHaveLength(3);
            }

            expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: /matches/i })).toBeInTheDocument();

            container.remove();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never allow owner-only tabs to be accessible when not owner', () => {
    fc.assert(
      fc.property(
        fc.record({
          isOwner: fc.boolean(),
          attemptedTab: fc.constantFrom('battle-config' as TabId, 'upgrades' as TabId)
        }),
        (testCase) => {
          const mockOnTabChange = vi.fn();

          const { container } = render(
            <BrowserRouter>
              <TabNavigation
                activeTab={testCase.attemptedTab}
                onTabChange={mockOnTabChange}
                isOwner={testCase.isOwner}
              />
            </BrowserRouter>
          );

          const battleConfigTab = screen.queryByRole('tab', { name: /battle config/i });
          const upgradesTab = screen.queryByRole('tab', { name: /upgrades/i });

          if (testCase.isOwner) {
            if (testCase.attemptedTab === 'battle-config') {
              expect(battleConfigTab).toBeInTheDocument();
            } else {
              expect(upgradesTab).toBeInTheDocument();
            }
          } else {
            expect(battleConfigTab).not.toBeInTheDocument();
            expect(upgradesTab).not.toBeInTheDocument();
          }

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });
});
