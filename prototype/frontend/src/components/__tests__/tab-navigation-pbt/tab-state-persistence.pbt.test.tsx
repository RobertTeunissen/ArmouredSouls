import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import TabNavigation from '../../TabNavigation';
import { ALL_TABS, isOwnerOnlyTab, type TabId } from './helpers';

/**
 * Property 3: Tab State Persistence
 * **Validates: Requirements 1.7**
 *
 * For any tab selection and any subsequent page interaction,
 * the selected tab should remain active until explicitly changed by the user.
 */
describe('Property 3: Tab State Persistence (Property-Based Test)', () => {
  it('should maintain active tab across multiple re-renders without explicit change', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom(...ALL_TABS),
        fc.integer({ min: 1, max: 10 }),
        (isOwner, initialTab, numRerenders) => {
          if (!isOwner && isOwnerOnlyTab(initialTab)) {
            return true;
          }

          const mockOnTabChange = vi.fn();

          const { container, rerender } = render(
            <BrowserRouter>
              <TabNavigation
                activeTab={initialTab}
                onTabChange={mockOnTabChange}
                isOwner={isOwner}
              />
            </BrowserRouter>
          );

          const initialTabElement = screen.getByRole('tab', { name: new RegExp(initialTab.replace('-', ' '), 'i') });
          expect(initialTabElement).toHaveAttribute('aria-selected', 'true');
          expect(initialTabElement).toHaveClass('bg-primary');

          for (let i = 0; i < numRerenders; i++) {
            rerender(
              <BrowserRouter>
                <TabNavigation
                  activeTab={initialTab}
                  onTabChange={mockOnTabChange}
                  isOwner={isOwner}
                />
              </BrowserRouter>
            );

            const tabElement = screen.getByRole('tab', { name: new RegExp(initialTab.replace('-', ' '), 'i') });
            expect(tabElement).toHaveAttribute('aria-selected', 'true');
            expect(tabElement).toHaveClass('bg-primary');
            expect(mockOnTabChange).not.toHaveBeenCalled();
          }

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only change active tab when explicitly changed through onTabChange', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.array(
          fc.constantFrom('overview' as TabId, 'matches' as TabId),
          { minLength: 2, maxLength: 5 }
        ),
        (isOwner, tabSequence) => {
          const mockOnTabChange = vi.fn();
          let currentTab = tabSequence[0];

          const { container, rerender } = render(
            <BrowserRouter>
              <TabNavigation
                activeTab={currentTab}
                onTabChange={mockOnTabChange}
                isOwner={isOwner}
              />
            </BrowserRouter>
          );

          let activeTabElement = screen.getByRole('tab', { name: new RegExp(currentTab.replace('-', ' '), 'i') });
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');

          for (let i = 1; i < tabSequence.length; i++) {
            currentTab = tabSequence[i];
            rerender(
              <BrowserRouter>
                <TabNavigation
                  activeTab={currentTab}
                  onTabChange={mockOnTabChange}
                  isOwner={isOwner}
                />
              </BrowserRouter>
            );

            activeTabElement = screen.getByRole('tab', { name: new RegExp(currentTab.replace('-', ' '), 'i') });
            expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
            expect(activeTabElement).toHaveClass('bg-primary');

            const allTabs = screen.getAllByRole('tab');
            const activeTabs = allTabs.filter(tab =>
              tab.getAttribute('aria-selected') === 'true'
            );
            expect(activeTabs).toHaveLength(1);
          }

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should persist tab state across ownership changes without explicit tab change', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom('overview' as TabId, 'matches' as TabId),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }),
        (initialIsOwner, selectedTab, ownershipChanges) => {
          const mockOnTabChange = vi.fn();

          const { container, rerender } = render(
            <BrowserRouter>
              <TabNavigation
                activeTab={selectedTab}
                onTabChange={mockOnTabChange}
                isOwner={initialIsOwner}
              />
            </BrowserRouter>
          );

          let activeTabElement = screen.getByRole('tab', { name: new RegExp(selectedTab.replace('-', ' '), 'i') });
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');

          for (const newIsOwner of ownershipChanges) {
            rerender(
              <BrowserRouter>
                <TabNavigation
                  activeTab={selectedTab}
                  onTabChange={mockOnTabChange}
                  isOwner={newIsOwner}
                />
              </BrowserRouter>
            );

            activeTabElement = screen.getByRole('tab', { name: new RegExp(selectedTab.replace('-', ' '), 'i') });
            expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
            expect(activeTabElement).toHaveClass('bg-primary');
            expect(mockOnTabChange).not.toHaveBeenCalled();
          }

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain tab state when interacting with other elements', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom(...ALL_TABS),
        (isOwner, selectedTab) => {
          if (!isOwner && isOwnerOnlyTab(selectedTab)) {
            return true;
          }

          const mockOnTabChange = vi.fn();

          const { container } = render(
            <BrowserRouter>
              <TabNavigation
                activeTab={selectedTab}
                onTabChange={mockOnTabChange}
                isOwner={isOwner}
              />
            </BrowserRouter>
          );

          const activeTabElement = screen.getByRole('tab', { name: new RegExp(selectedTab.replace('-', ' '), 'i') });
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');

          activeTabElement.focus();
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(mockOnTabChange).not.toHaveBeenCalled();

          activeTabElement.blur();
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(mockOnTabChange).not.toHaveBeenCalled();

          activeTabElement.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(mockOnTabChange).not.toHaveBeenCalled();

          activeTabElement.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(mockOnTabChange).not.toHaveBeenCalled();

          expect(activeTabElement).toHaveClass('bg-primary');

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain exactly one active tab across all state changes', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            isOwner: fc.boolean(),
            activeTab: fc.constantFrom('overview' as TabId, 'matches' as TabId)
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (stateSequence) => {
          const mockOnTabChange = vi.fn();

          for (const state of stateSequence) {
            const { container } = render(
              <BrowserRouter>
                <TabNavigation
                  activeTab={state.activeTab}
                  onTabChange={mockOnTabChange}
                  isOwner={state.isOwner}
                />
              </BrowserRouter>
            );

            const allTabs = screen.getAllByRole('tab');
            const activeTabs = allTabs.filter(tab =>
              tab.getAttribute('aria-selected') === 'true'
            );
            expect(activeTabs).toHaveLength(1);

            const expectedActiveTab = screen.getByRole('tab', {
              name: new RegExp(state.activeTab.replace('-', ' '), 'i')
            });
            expect(expectedActiveTab).toHaveAttribute('aria-selected', 'true');
            expect(expectedActiveTab).toHaveClass('bg-primary');

            container.remove();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
