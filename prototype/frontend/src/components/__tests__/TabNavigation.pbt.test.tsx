import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as fc from 'fast-check';
import TabNavigation from '../TabNavigation';

/**
 * Property-Based Tests for Robot Detail Page Visual Enhancement
 * Feature: robot-detail-page-visual-enhancement
 * Testing Framework: fast-check with minimum 100 iterations
 */

/**
 * Property 1: Default Tab Selection
 * **Validates: Requirements 1.2**
 * 
 * For any page load of the Robot Detail Page, the Overview tab should be the active tab by default.
 * 
 * This property test verifies that regardless of the isOwner state or any other random conditions,
 * when the activeTab prop is set to 'overview', the Overview tab is always rendered as active.
 */
describe('Property 1: Default Tab Selection (Property-Based Test)', () => {
  it('should always have Overview tab as active when activeTab is "overview"', () => {
    fc.assert(
      fc.property(
        // Generate random boolean for isOwner to test across different ownership states
        fc.boolean(),
        (isOwner) => {
          const mockOnTabChange = vi.fn();
          
          // Render with overview as active tab
          const { container } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab="overview" 
                onTabChange={mockOnTabChange} 
                isOwner={isOwner} 
              />
            </BrowserRouter>
          );

          // Property: Overview tab must always be active
          const overviewTab = screen.getByRole('tab', { name: /overview/i });
          
          // Verify the tab is marked as selected
          expect(overviewTab).toHaveAttribute('aria-selected', 'true');
          
          // Verify the tab has active styling (primary color background)
          expect(overviewTab).toHaveClass('bg-blue-600');
          expect(overviewTab).toHaveClass('text-white');
          
          // Verify only one tab is active
          const allTabs = screen.getAllByRole('tab');
          const activeTabs = allTabs.filter(tab => 
            tab.getAttribute('aria-selected') === 'true'
          );
          expect(activeTabs).toHaveLength(1);
          expect(activeTabs[0]).toBe(overviewTab);
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 } // Minimum 100 iterations as specified in design
    );
  });

  it('should always render Overview tab regardless of ownership state', () => {
    fc.assert(
      fc.property(
        // Generate random boolean for isOwner
        fc.boolean(),
        // Generate random tab selection
        fc.constantFrom('overview', 'battle-config', 'upgrades', 'stats'),
        (isOwner, activeTab) => {
          const mockOnTabChange = vi.fn();
          
          // Skip invalid combinations (owner-only tabs when not owner)
          if (!isOwner && (activeTab === 'battle-config' || activeTab === 'upgrades')) {
            return true; // Skip this test case
          }
          
          const { container } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={activeTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={isOwner} 
              />
            </BrowserRouter>
          );

          // Property: Overview tab must always be present in the DOM
          const overviewTab = screen.getByRole('tab', { name: /overview/i });
          expect(overviewTab).toBeInTheDocument();
          
          // Property: Overview tab should be active only when activeTab is 'overview'
          if (activeTab === 'overview') {
            expect(overviewTab).toHaveAttribute('aria-selected', 'true');
            expect(overviewTab).toHaveClass('bg-blue-600');
          } else {
            expect(overviewTab).toHaveAttribute('aria-selected', 'false');
            expect(overviewTab).not.toHaveClass('bg-blue-600');
          }
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain Overview as default across multiple render cycles', () => {
    fc.assert(
      fc.property(
        // Generate array of random boolean values for multiple renders
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        (isOwnerStates) => {
          const mockOnTabChange = vi.fn();
          
          // Test that Overview remains default across multiple renders
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

            // Property: Overview must be active in every render
            const overviewTab = screen.getByRole('tab', { name: /overview/i });
            expect(overviewTab).toHaveAttribute('aria-selected', 'true');
            expect(overviewTab).toHaveClass('bg-blue-600');
            
            // Cleanup after each render
            container.remove();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 3: Tab State Persistence
 * **Validates: Requirements 1.7**
 * 
 * For any tab selection and any subsequent page interaction, 
 * the selected tab should remain active until explicitly changed by the user.
 * 
 * This property test verifies that once a tab is selected, it remains active
 * across multiple re-renders and interactions, and only changes when explicitly
 * changed through the onTabChange callback.
 */
describe('Property 3: Tab State Persistence (Property-Based Test)', () => {
  it('should maintain active tab across multiple re-renders without explicit change', () => {
    fc.assert(
      fc.property(
        // Generate random ownership state
        fc.boolean(),
        // Generate random initial tab selection
        fc.constantFrom('overview', 'battle-config', 'upgrades', 'stats'),
        // Generate number of re-renders to test persistence
        fc.integer({ min: 1, max: 10 }),
        (isOwner, initialTab, numRerenders) => {
          // Skip invalid combinations (owner-only tabs when not owner)
          if (!isOwner && (initialTab === 'battle-config' || initialTab === 'upgrades')) {
            return true; // Skip this test case
          }
          
          const mockOnTabChange = vi.fn();
          
          // Initial render with selected tab
          const { container, rerender } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={initialTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={isOwner} 
              />
            </BrowserRouter>
          );

          // Property: Initial tab should be active
          const initialTabElement = screen.getByRole('tab', { name: new RegExp(initialTab.replace('-', ' '), 'i') });
          expect(initialTabElement).toHaveAttribute('aria-selected', 'true');
          expect(initialTabElement).toHaveClass('bg-blue-600');
          
          // Re-render multiple times with the same activeTab prop
          for (let i = 0; i < numRerenders; i++) {
            rerender(
              <BrowserRouter>
                <TabNavigation 
                  activeTab={initialTab as any} 
                  onTabChange={mockOnTabChange} 
                  isOwner={isOwner} 
                />
              </BrowserRouter>
            );
            
            // Property: Tab should remain active after each re-render
            const tabElement = screen.getByRole('tab', { name: new RegExp(initialTab.replace('-', ' '), 'i') });
            expect(tabElement).toHaveAttribute('aria-selected', 'true');
            expect(tabElement).toHaveClass('bg-blue-600');
            
            // Property: onTabChange should not have been called (no explicit change)
            expect(mockOnTabChange).not.toHaveBeenCalled();
          }
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only change active tab when explicitly changed through onTabChange', () => {
    fc.assert(
      fc.property(
        // Generate random ownership state
        fc.boolean(),
        // Generate sequence of tab changes
        fc.array(
          fc.constantFrom('overview', 'stats'), // Use only public tabs for broader testing
          { minLength: 2, maxLength: 5 }
        ),
        (isOwner, tabSequence) => {
          const mockOnTabChange = vi.fn();
          let currentTab = tabSequence[0];
          
          // Initial render
          const { container, rerender } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={currentTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={isOwner} 
              />
            </BrowserRouter>
          );

          // Property: Initial tab should be active
          let activeTabElement = screen.getByRole('tab', { name: new RegExp(currentTab.replace('-', ' '), 'i') });
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          
          // Simulate explicit tab changes
          for (let i = 1; i < tabSequence.length; i++) {
            const nextTab = tabSequence[i];
            
            // Re-render with new active tab (simulating explicit change)
            currentTab = nextTab;
            rerender(
              <BrowserRouter>
                <TabNavigation 
                  activeTab={currentTab as any} 
                  onTabChange={mockOnTabChange} 
                  isOwner={isOwner} 
                />
              </BrowserRouter>
            );
            
            // Property: New tab should now be active
            activeTabElement = screen.getByRole('tab', { name: new RegExp(currentTab.replace('-', ' '), 'i') });
            expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
            expect(activeTabElement).toHaveClass('bg-blue-600');
            
            // Property: Only one tab should be active at a time
            const allTabs = screen.getAllByRole('tab');
            const activeTabs = allTabs.filter(tab => 
              tab.getAttribute('aria-selected') === 'true'
            );
            expect(activeTabs).toHaveLength(1);
          }
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should persist tab state across ownership changes without explicit tab change', () => {
    fc.assert(
      fc.property(
        // Generate random initial ownership state
        fc.boolean(),
        // Generate random public tab (accessible regardless of ownership)
        fc.constantFrom('overview', 'stats'),
        // Generate sequence of ownership state changes
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }),
        (initialIsOwner, selectedTab, ownershipChanges) => {
          const mockOnTabChange = vi.fn();
          
          // Initial render
          const { container, rerender } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={selectedTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={initialIsOwner} 
              />
            </BrowserRouter>
          );

          // Property: Initial tab should be active
          let activeTabElement = screen.getByRole('tab', { name: new RegExp(selectedTab.replace('-', ' '), 'i') });
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          
          // Change ownership state multiple times
          for (const newIsOwner of ownershipChanges) {
            rerender(
              <BrowserRouter>
                <TabNavigation 
                  activeTab={selectedTab as any} 
                  onTabChange={mockOnTabChange} 
                  isOwner={newIsOwner} 
                />
              </BrowserRouter>
            );
            
            // Property: Selected tab should remain active despite ownership changes
            activeTabElement = screen.getByRole('tab', { name: new RegExp(selectedTab.replace('-', ' '), 'i') });
            expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
            expect(activeTabElement).toHaveClass('bg-blue-600');
            
            // Property: onTabChange should not have been called
            expect(mockOnTabChange).not.toHaveBeenCalled();
          }
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain tab state when interacting with other elements', () => {
    fc.assert(
      fc.property(
        // Generate random ownership state
        fc.boolean(),
        // Generate random tab selection
        fc.constantFrom('overview', 'battle-config', 'upgrades', 'stats'),
        (isOwner, selectedTab) => {
          // Skip invalid combinations
          if (!isOwner && (selectedTab === 'battle-config' || selectedTab === 'upgrades')) {
            return true;
          }
          
          const mockOnTabChange = vi.fn();
          
          const { container } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={selectedTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={isOwner} 
              />
            </BrowserRouter>
          );

          // Property: Selected tab should be active
          const activeTabElement = screen.getByRole('tab', { name: new RegExp(selectedTab.replace('-', ' '), 'i') });
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          
          // Simulate various interactions that should NOT change tab state
          // 1. Focus on the active tab
          activeTabElement.focus();
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(mockOnTabChange).not.toHaveBeenCalled();
          
          // 2. Blur from the active tab
          activeTabElement.blur();
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(mockOnTabChange).not.toHaveBeenCalled();
          
          // 3. Mouse over the active tab
          activeTabElement.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(mockOnTabChange).not.toHaveBeenCalled();
          
          // 4. Mouse out from the active tab
          activeTabElement.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(mockOnTabChange).not.toHaveBeenCalled();
          
          // Property: Tab state persists through all interactions
          expect(activeTabElement).toHaveClass('bg-blue-600');
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain exactly one active tab across all state changes', () => {
    fc.assert(
      fc.property(
        // Generate random sequence of states
        fc.array(
          fc.record({
            isOwner: fc.boolean(),
            activeTab: fc.constantFrom('overview', 'stats') // Public tabs only
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (stateSequence) => {
          const mockOnTabChange = vi.fn();
          
          for (const state of stateSequence) {
            const { container } = render(
              <BrowserRouter>
                <TabNavigation 
                  activeTab={state.activeTab as any} 
                  onTabChange={mockOnTabChange} 
                  isOwner={state.isOwner} 
                />
              </BrowserRouter>
            );

            // Property: Exactly one tab should be active
            const allTabs = screen.getAllByRole('tab');
            const activeTabs = allTabs.filter(tab => 
              tab.getAttribute('aria-selected') === 'true'
            );
            expect(activeTabs).toHaveLength(1);
            
            // Property: The active tab should match the activeTab prop
            const expectedActiveTab = screen.getByRole('tab', { 
              name: new RegExp(state.activeTab.replace('-', ' '), 'i') 
            });
            expect(expectedActiveTab).toHaveAttribute('aria-selected', 'true');
            expect(expectedActiveTab).toHaveClass('bg-blue-600');
            
            // Cleanup
            container.remove();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 4: Active Tab Visual Indication
 * **Validates: Requirements 1.8**
 * 
 * For any active tab, the tab element should have distinct visual styling 
 * (primary color background, white text) that differs from inactive tabs.
 * 
 * This property test verifies that across all possible tab selections and ownership states,
 * the active tab always has the correct visual styling (bg-blue-600, text-white) and
 * inactive tabs have different styling (bg-gray-800, text-gray-400).
 */
describe('Property 4: Active Tab Visual Indication (Property-Based Test)', () => {
  it('should always apply primary color background and white text to active tab', () => {
    fc.assert(
      fc.property(
        // Generate random ownership state
        fc.boolean(),
        // Generate random active tab selection
        fc.constantFrom('overview', 'battle-config', 'upgrades', 'stats'),
        (isOwner, activeTab) => {
          // Skip invalid combinations (owner-only tabs when not owner)
          if (!isOwner && (activeTab === 'battle-config' || activeTab === 'upgrades')) {
            return true; // Skip this test case
          }
          
          const mockOnTabChange = vi.fn();
          
          const { container } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={activeTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={isOwner} 
              />
            </BrowserRouter>
          );

          // Property: Active tab must have primary color background (bg-blue-600)
          const activeTabElement = screen.getByRole('tab', { 
            name: new RegExp(activeTab.replace('-', ' '), 'i') 
          });
          
          expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
          expect(activeTabElement).toHaveClass('bg-blue-600');
          expect(activeTabElement).toHaveClass('text-white');
          
          // Property: Active tab must NOT have inactive styling
          expect(activeTabElement).not.toHaveClass('bg-gray-800');
          expect(activeTabElement).not.toHaveClass('text-gray-400');
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always apply distinct styling to inactive tabs', () => {
    fc.assert(
      fc.property(
        // Generate random ownership state
        fc.boolean(),
        // Generate random active tab selection
        fc.constantFrom('overview', 'battle-config', 'upgrades', 'stats'),
        (isOwner, activeTab) => {
          // Skip invalid combinations
          if (!isOwner && (activeTab === 'battle-config' || activeTab === 'upgrades')) {
            return true;
          }
          
          const mockOnTabChange = vi.fn();
          
          const { container } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={activeTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={isOwner} 
              />
            </BrowserRouter>
          );

          // Property: All inactive tabs must have different styling from active tab
          const allTabs = screen.getAllByRole('tab');
          
          for (const tab of allTabs) {
            const isActive = tab.getAttribute('aria-selected') === 'true';
            
            if (isActive) {
              // Active tab: primary color background, white text
              expect(tab).toHaveClass('bg-blue-600');
              expect(tab).toHaveClass('text-white');
              expect(tab).not.toHaveClass('bg-gray-800');
              expect(tab).not.toHaveClass('text-gray-400');
            } else {
              // Inactive tab: surface-elevated background, secondary text
              expect(tab).toHaveClass('bg-gray-800');
              expect(tab).toHaveClass('text-gray-400');
              expect(tab).not.toHaveClass('bg-blue-600');
              expect(tab).not.toHaveClass('text-white');
            }
          }
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain visual distinction between active and inactive tabs across all states', () => {
    fc.assert(
      fc.property(
        // Generate array of random states
        fc.array(
          fc.record({
            isOwner: fc.boolean(),
            activeTab: fc.constantFrom('overview', 'stats') // Public tabs only
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (stateSequence) => {
          for (const state of stateSequence) {
            const mockOnTabChange = vi.fn();
            
            const { container } = render(
              <BrowserRouter>
                <TabNavigation 
                  activeTab={state.activeTab as any} 
                  onTabChange={mockOnTabChange} 
                  isOwner={state.isOwner} 
                />
              </BrowserRouter>
            );

            // Property: Exactly one tab should have active styling
            const allTabs = screen.getAllByRole('tab');
            const tabsWithActiveStyle = allTabs.filter(tab => 
              tab.classList.contains('bg-blue-600') && tab.classList.contains('text-white')
            );
            expect(tabsWithActiveStyle).toHaveLength(1);
            
            // Property: The tab with active styling should be the active tab
            const activeTabElement = screen.getByRole('tab', { 
              name: new RegExp(state.activeTab.replace('-', ' '), 'i') 
            });
            expect(tabsWithActiveStyle[0]).toBe(activeTabElement);
            
            // Property: All other tabs should have inactive styling
            const inactiveTabs = allTabs.filter(tab => tab !== activeTabElement);
            for (const inactiveTab of inactiveTabs) {
              expect(inactiveTab).toHaveClass('bg-gray-800');
              expect(inactiveTab).toHaveClass('text-gray-400');
              expect(inactiveTab).not.toHaveClass('bg-blue-600');
              expect(inactiveTab).not.toHaveClass('text-white');
            }
            
            // Cleanup
            container.remove();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply visual styling consistently across ownership changes', () => {
    fc.assert(
      fc.property(
        // Generate random active tab (public only)
        fc.constantFrom('overview', 'stats'),
        // Generate sequence of ownership states
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }),
        (activeTab, ownershipStates) => {
          for (const isOwner of ownershipStates) {
            const mockOnTabChange = vi.fn();
            
            const { container } = render(
              <BrowserRouter>
                <TabNavigation 
                  activeTab={activeTab as any} 
                  onTabChange={mockOnTabChange} 
                  isOwner={isOwner} 
                />
              </BrowserRouter>
            );

            // Property: Active tab styling should be consistent regardless of ownership
            const activeTabElement = screen.getByRole('tab', { 
              name: new RegExp(activeTab.replace('-', ' '), 'i') 
            });
            
            expect(activeTabElement).toHaveAttribute('aria-selected', 'true');
            expect(activeTabElement).toHaveClass('bg-blue-600');
            expect(activeTabElement).toHaveClass('text-white');
            
            // Property: Inactive tabs should have consistent styling
            const allTabs = screen.getAllByRole('tab');
            const inactiveTabs = allTabs.filter(tab => 
              tab.getAttribute('aria-selected') === 'false'
            );
            
            for (const inactiveTab of inactiveTabs) {
              expect(inactiveTab).toHaveClass('bg-gray-800');
              expect(inactiveTab).toHaveClass('text-gray-400');
            }
            
            // Cleanup
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
        // Generate random ownership state
        fc.boolean(),
        // Generate random active tab
        fc.constantFrom('overview', 'battle-config', 'upgrades', 'stats'),
        (isOwner, activeTab) => {
          // Skip invalid combinations
          if (!isOwner && (activeTab === 'battle-config' || activeTab === 'upgrades')) {
            return true;
          }
          
          const mockOnTabChange = vi.fn();
          
          const { container } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={activeTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={isOwner} 
              />
            </BrowserRouter>
          );

          // Property: Visual styling must match aria-selected state
          const allTabs = screen.getAllByRole('tab');
          
          for (const tab of allTabs) {
            const ariaSelected = tab.getAttribute('aria-selected') === 'true';
            const hasActiveStyle = tab.classList.contains('bg-blue-600') && 
                                   tab.classList.contains('text-white');
            const hasInactiveStyle = tab.classList.contains('bg-gray-800') && 
                                     tab.classList.contains('text-gray-400');
            
            // Property: aria-selected="true" must correspond to active styling
            if (ariaSelected) {
              expect(hasActiveStyle).toBe(true);
              expect(hasInactiveStyle).toBe(false);
            } else {
              // Property: aria-selected="false" must correspond to inactive styling
              expect(hasActiveStyle).toBe(false);
              expect(hasInactiveStyle).toBe(true);
            }
          }
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain visual distinction when switching between tabs', () => {
    fc.assert(
      fc.property(
        // Generate random ownership state
        fc.boolean(),
        // Generate sequence of tab changes (public tabs only)
        fc.array(
          fc.constantFrom('overview', 'stats'),
          { minLength: 2, maxLength: 5 }
        ),
        (isOwner, tabSequence) => {
          const mockOnTabChange = vi.fn();
          let currentTab = tabSequence[0];
          
          // Initial render
          const { container, rerender } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={currentTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={isOwner} 
              />
            </BrowserRouter>
          );

          // Check initial state
          let activeTabElement = screen.getByRole('tab', { 
            name: new RegExp(currentTab.replace('-', ' '), 'i') 
          });
          expect(activeTabElement).toHaveClass('bg-blue-600');
          expect(activeTabElement).toHaveClass('text-white');
          
          // Switch through tabs
          for (let i = 1; i < tabSequence.length; i++) {
            const previousTab = currentTab;
            currentTab = tabSequence[i];
            
            rerender(
              <BrowserRouter>
                <TabNavigation 
                  activeTab={currentTab as any} 
                  onTabChange={mockOnTabChange} 
                  isOwner={isOwner} 
                />
              </BrowserRouter>
            );
            
            // Property: New active tab should have active styling
            activeTabElement = screen.getByRole('tab', { 
              name: new RegExp(currentTab.replace('-', ' '), 'i') 
            });
            expect(activeTabElement).toHaveClass('bg-blue-600');
            expect(activeTabElement).toHaveClass('text-white');
            
            // Property: Previous active tab should now have inactive styling (if different)
            if (previousTab !== currentTab) {
              const previousTabElement = screen.getByRole('tab', { 
                name: new RegExp(previousTab.replace('-', ' '), 'i') 
              });
              expect(previousTabElement).toHaveClass('bg-gray-800');
              expect(previousTabElement).toHaveClass('text-gray-400');
              expect(previousTabElement).not.toHaveClass('bg-blue-600');
            }
          }
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: Owner-Only Tab Access Control
 * **Validates: Requirements 1.6, 6.1**
 * 
 * For any robot and any user, when the user is not the robot owner, 
 * the Battle Config and Upgrades tabs should not be visible or accessible.
 * 
 * This property test verifies that across all possible combinations of activeTab and isOwner states,
 * the owner-only tabs (Battle Config and Upgrades) are never rendered when isOwner is false.
 */
describe('Property 2: Owner-Only Tab Access Control (Property-Based Test)', () => {
  it('should never render owner-only tabs when isOwner is false', () => {
    fc.assert(
      fc.property(
        // Generate random active tab selection
        fc.constantFrom('overview', 'battle-config', 'upgrades', 'stats'),
        (activeTab) => {
          const mockOnTabChange = vi.fn();
          
          // Render with isOwner = false
          const { container } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={activeTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={false} 
              />
            </BrowserRouter>
          );

          // Property: Battle Config and Upgrades tabs must NEVER be in the DOM when not owner
          const battleConfigTab = screen.queryByRole('tab', { name: /battle config/i });
          const upgradesTab = screen.queryByRole('tab', { name: /upgrades/i });
          
          expect(battleConfigTab).not.toBeInTheDocument();
          expect(upgradesTab).not.toBeInTheDocument();
          
          // Property: Overview and Stats tabs must ALWAYS be visible
          const overviewTab = screen.getByRole('tab', { name: /overview/i });
          const statsTab = screen.getByRole('tab', { name: /stats/i });
          
          expect(overviewTab).toBeInTheDocument();
          expect(statsTab).toBeInTheDocument();
          
          // Property: Only 2 tabs should be rendered for non-owners
          const allTabs = screen.getAllByRole('tab');
          expect(allTabs).toHaveLength(2);
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always render all tabs when isOwner is true', () => {
    fc.assert(
      fc.property(
        // Generate random active tab selection
        fc.constantFrom('overview', 'battle-config', 'upgrades', 'stats'),
        (activeTab) => {
          const mockOnTabChange = vi.fn();
          
          // Render with isOwner = true
          const { container } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={activeTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={true} 
              />
            </BrowserRouter>
          );

          // Property: All 4 tabs must be present when user is owner
          const overviewTab = screen.getByRole('tab', { name: /overview/i });
          const battleConfigTab = screen.getByRole('tab', { name: /battle config/i });
          const upgradesTab = screen.getByRole('tab', { name: /upgrades/i });
          const statsTab = screen.getByRole('tab', { name: /stats/i });
          
          expect(overviewTab).toBeInTheDocument();
          expect(battleConfigTab).toBeInTheDocument();
          expect(upgradesTab).toBeInTheDocument();
          expect(statsTab).toBeInTheDocument();
          
          // Property: Exactly 4 tabs should be rendered for owners
          const allTabs = screen.getAllByRole('tab');
          expect(allTabs).toHaveLength(4);
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain owner-only access control across multiple ownership states', () => {
    fc.assert(
      fc.property(
        // Generate array of random ownership states and tab selections
        fc.array(
          fc.record({
            isOwner: fc.boolean(),
            activeTab: fc.constantFrom('overview', 'stats') // Only use public tabs for this test
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (testCases) => {
          for (const testCase of testCases) {
            const mockOnTabChange = vi.fn();
            
            const { container } = render(
              <BrowserRouter>
                <TabNavigation 
                  activeTab={testCase.activeTab as any} 
                  onTabChange={mockOnTabChange} 
                  isOwner={testCase.isOwner} 
                />
              </BrowserRouter>
            );

            // Property: Owner-only tabs visibility must match isOwner state
            const battleConfigTab = screen.queryByRole('tab', { name: /battle config/i });
            const upgradesTab = screen.queryByRole('tab', { name: /upgrades/i });
            
            if (testCase.isOwner) {
              // When owner, all tabs should be present
              expect(battleConfigTab).toBeInTheDocument();
              expect(upgradesTab).toBeInTheDocument();
              expect(screen.getAllByRole('tab')).toHaveLength(4);
            } else {
              // When not owner, owner-only tabs should not be present
              expect(battleConfigTab).not.toBeInTheDocument();
              expect(upgradesTab).not.toBeInTheDocument();
              expect(screen.getAllByRole('tab')).toHaveLength(2);
            }
            
            // Property: Public tabs must always be present
            expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: /stats/i })).toBeInTheDocument();
            
            // Cleanup after each render
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
        // Generate random combinations of ownership and tab attempts
        fc.record({
          isOwner: fc.boolean(),
          attemptedTab: fc.constantFrom('battle-config', 'upgrades')
        }),
        (testCase) => {
          const mockOnTabChange = vi.fn();
          
          // Try to render with an owner-only tab as active
          const { container } = render(
            <BrowserRouter>
              <TabNavigation 
                activeTab={testCase.attemptedTab as any} 
                onTabChange={mockOnTabChange} 
                isOwner={testCase.isOwner} 
              />
            </BrowserRouter>
          );

          // Property: Owner-only tabs should only be accessible when isOwner is true
          const battleConfigTab = screen.queryByRole('tab', { name: /battle config/i });
          const upgradesTab = screen.queryByRole('tab', { name: /upgrades/i });
          
          if (testCase.isOwner) {
            // When owner, the attempted tab should be present and potentially active
            if (testCase.attemptedTab === 'battle-config') {
              expect(battleConfigTab).toBeInTheDocument();
            } else {
              expect(upgradesTab).toBeInTheDocument();
            }
          } else {
            // When not owner, neither owner-only tab should be present
            expect(battleConfigTab).not.toBeInTheDocument();
            expect(upgradesTab).not.toBeInTheDocument();
          }
          
          // Cleanup
          container.remove();
        }
      ),
      { numRuns: 100 }
    );
  });
});
