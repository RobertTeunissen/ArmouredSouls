import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { ALL_TABS, isOwnerOnlyTab, renderTabNavigation, type TabId } from './helpers';

/**
 * Property 4: Active Tab Visual Indication
 * **Validates: Requirements 1.8**
 *
 * For any active tab, the tab element should have distinct visual styling
 * (primary color background, white text) that differs from inactive tabs.
 */
describe('Property 4: Active Tab Visual Indication (Property-Based Test)', () => {
  it('should always apply primary color background and white text to active tab', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom(...ALL_TABS),
        (isOwner, activeTab) => {
          if (!isOwner && isOwnerOnlyTab(activeTab)) return true;

          const { container } = renderTabNavigation(activeTab, isOwner);

          const activeTabElement = screen.getByRole('tab', {
            name: new RegExp(activeTab.replace('-', ' '), 'i')
          });

          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(activeTabElement).toHaveClass('bg-primary');
          expect(activeTabElement).toHaveClass('text-white');
          expect(activeTabElement).not.toHaveClass('bg-surface');
          expect(activeTabElement).not.toHaveClass('text-secondary');

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always apply distinct styling to inactive tabs', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom(...ALL_TABS),
        (isOwner, activeTab) => {
          if (!isOwner && isOwnerOnlyTab(activeTab)) return true;

          const { container } = renderTabNavigation(activeTab, isOwner);
          const allTabs = screen.getAllByRole('tab');

          for (const tab of allTabs) {
            const isActive = tab.getAttribute('aria-selected') === 'true';
            if (isActive) {
              expect(tab).toHaveClass('bg-primary');
              expect(tab).toHaveClass('text-white');
              expect(tab).not.toHaveClass('bg-surface');
              expect(tab).not.toHaveClass('text-secondary');
            } else {
              expect(tab).toHaveClass('bg-surface');
              expect(tab).toHaveClass('text-secondary');
              expect(tab).not.toHaveClass('bg-primary');
              expect(tab).not.toHaveClass('text-white');
            }
          }

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain visual distinction between active and inactive tabs across all states', { timeout: 15000 }, () => {
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
          for (const state of stateSequence) {
            const { container } = renderTabNavigation(state.activeTab, state.isOwner);
            const allTabs = screen.getAllByRole('tab');

            const tabsWithActiveStyle = allTabs.filter(tab =>
              tab.classList.contains('bg-primary') && tab.classList.contains('text-white')
            );
            expect(tabsWithActiveStyle).toHaveLength(1);

            const activeTabElement = screen.getByRole('tab', {
              name: new RegExp(state.activeTab.replace('-', ' '), 'i')
            });
            expect(tabsWithActiveStyle[0]).toBe(activeTabElement);

            const inactiveTabs = allTabs.filter(tab => tab !== activeTabElement);
            for (const inactiveTab of inactiveTabs) {
              expect(inactiveTab).toHaveClass('bg-surface');
              expect(inactiveTab).toHaveClass('text-secondary');
              expect(inactiveTab).not.toHaveClass('bg-primary');
              expect(inactiveTab).not.toHaveClass('text-white');
            }

            container.remove();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply visual styling consistently across ownership changes', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom('overview' as TabId, 'matches' as TabId),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }),
        (activeTab, ownershipStates) => {
          for (const isOwner of ownershipStates) {
            const { container } = renderTabNavigation(activeTab, isOwner);

            const activeTabElement = screen.getByRole('tab', {
              name: new RegExp(activeTab.replace('-', ' '), 'i')
            });

            expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
            expect(activeTabElement).toHaveClass('bg-primary');
            expect(activeTabElement).toHaveClass('text-white');

            const allTabs = screen.getAllByRole('tab');
            const inactiveTabs = allTabs.filter(tab =>
              tab.getAttribute('aria-selected') === 'false'
            );
            for (const inactiveTab of inactiveTabs) {
              expect(inactiveTab).toHaveClass('bg-surface');
              expect(inactiveTab).toHaveClass('text-secondary');
            }

            container.remove();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ensure visual styling matches aria-selected attribute', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.constantFrom(...ALL_TABS),
        (isOwner, activeTab) => {
          if (!isOwner && isOwnerOnlyTab(activeTab)) return true;

          const { container } = renderTabNavigation(activeTab, isOwner);
          const allTabs = screen.getAllByRole('tab');

          for (const tab of allTabs) {
            const ariaSelected = tab.getAttribute('aria-selected') === 'true';
            const hasActiveStyle = tab.classList.contains('bg-primary') &&
                                   tab.classList.contains('text-white');
            const hasInactiveStyle = tab.classList.contains('bg-surface') &&
                                     tab.classList.contains('text-secondary');

            if (ariaSelected) {
              expect(hasActiveStyle).toBe(true);
              expect(hasInactiveStyle).toBe(false);
            } else {
              expect(hasActiveStyle).toBe(false);
              expect(hasInactiveStyle).toBe(true);
            }
          }

          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain visual distinction when switching between tabs', { timeout: 15000 }, () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.array(
          fc.constantFrom('overview' as TabId, 'matches' as TabId),
          { minLength: 2, maxLength: 5 }
        ),
        (isOwner, tabSequence) => {
          // Use separate renders per tab switch to verify styling transitions
          for (let i = 0; i < tabSequence.length; i++) {
            const { container } = renderTabNavigation(tabSequence[i], isOwner);

            const activeTabElement = screen.getByRole('tab', {
              name: new RegExp(tabSequence[i].replace('-', ' '), 'i')
            });
            expect(activeTabElement).toHaveClass('bg-primary');
            expect(activeTabElement).toHaveClass('text-white');

            // Verify all other tabs have inactive styling
            const allTabs = screen.getAllByRole('tab');
            for (const tab of allTabs) {
              if (tab !== activeTabElement) {
                expect(tab).toHaveClass('bg-surface');
                expect(tab).toHaveClass('text-secondary');
                expect(tab).not.toHaveClass('bg-primary');
              }
            }

            container.remove();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
