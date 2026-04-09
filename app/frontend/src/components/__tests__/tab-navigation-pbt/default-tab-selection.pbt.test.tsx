import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import TabNavigation from '../../TabNavigation';
import { ALL_TABS, isOwnerOnlyTab } from './helpers';

/**
 * Property 1: Default Tab Selection
 * **Validates: Requirements 1.2**
 *
 * For any page load of the Robot Detail Page, the Overview tab should be the active tab by default.
 */
describe('Property 1: Default Tab Selection (Property-Based Test)', () => {
  it('should always have Overview tab as active when activeTab is "overview"', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isOwner) => {
          const mockOnTabChange = vi.fn();

          const { container } = render(
            <BrowserRouter>
              <TabNavigation
                activeTab="overview"
                onTabChange={mockOnTabChange}
                isOwner={isOwner}
              />
            </BrowserRouter>
          );

          const overviewTab = screen.getByRole('tab', { name: /overview/i });
          expect(overviewTab).toHaveAttribute('aria-selected', 'true');
          expect(overviewTab).toHaveClass('bg-primary');
          expect(overviewTab).toHaveClass('text-white');

          const allTabs = screen.getAllByRole('tab');
          const activeTabs = allTabs.filter(tab =>
            tab.getAttribute('aria-selected') === 'true'
          );
          expect(activeTabs).toHaveLength(1);
          expect(activeTabs[0]).toBe(overviewTab);

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always render Overview tab regardless of ownership state', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom(...ALL_TABS),
        (isOwner, activeTab) => {
          if (!isOwner && isOwnerOnlyTab(activeTab)) {
            return true;
          }

          const mockOnTabChange = vi.fn();

          const { container } = render(
            <BrowserRouter>
              <TabNavigation
                activeTab={activeTab}
                onTabChange={mockOnTabChange}
                isOwner={isOwner}
              />
            </BrowserRouter>
          );

          const overviewTab = screen.getByRole('tab', { name: /overview/i });
          expect(overviewTab).toBeInTheDocument();

          if (activeTab === 'overview') {
            expect(overviewTab).toHaveAttribute('aria-selected', 'true');
            expect(overviewTab).toHaveClass('bg-primary');
          } else {
            expect(overviewTab).toHaveAttribute('aria-selected', 'false');
            expect(overviewTab).not.toHaveClass('bg-primary');
          }

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain Overview as default across multiple render cycles', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        (isOwnerStates) => {
          const mockOnTabChange = vi.fn();

          for (const isOwner of isOwnerStates) {
            const { container } = render(
              <BrowserRouter>
                <TabNavigation
                  activeTab="overview"
                  onTabChange={mockOnTabChange}
                  isOwner={isOwner}
                />
              </BrowserRouter>
            );

            const overviewTab = screen.getByRole('tab', { name: /overview/i });
            expect(overviewTab).toHaveAttribute('aria-selected', 'true');
            expect(overviewTab).toHaveClass('bg-primary');

            container.remove();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
