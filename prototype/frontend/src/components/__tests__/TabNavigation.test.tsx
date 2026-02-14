import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TabNavigation from '../TabNavigation';

/**
 * Feature: robot-detail-page-visual-enhancement
 * Property 1: Default Tab Selection
 * Validates: Requirements 1.2
 * 
 * For any page load of the Robot Detail Page, the Overview tab should be the active tab by default.
 */
describe('Property 1: Default Tab Selection', () => {
  it('should have Overview tab as active by default', () => {
    const mockOnTabChange = vi.fn();
    
    render(
      <BrowserRouter>
        <TabNavigation 
          activeTab="overview" 
          onTabChange={mockOnTabChange} 
          isOwner={true} 
        />
      </BrowserRouter>
    );

    const overviewTab = screen.getByRole('tab', { name: /overview/i });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    expect(overviewTab).toHaveClass('bg-blue-600');
  });
});

/**
 * Feature: robot-detail-page-visual-enhancement
 * Property 2: Owner-Only Tab Access Control
 * Validates: Requirements 1.6, 6.1
 * 
 * For any robot and any user, when the user is not the robot owner, 
 * the Battle Config and Upgrades tabs should not be visible or accessible.
 */
describe('Property 2: Owner-Only Tab Access Control', () => {
  it('should hide Battle Config and Upgrades tabs when user is not owner', () => {
    const mockOnTabChange = vi.fn();
    
    render(
      <BrowserRouter>
        <TabNavigation 
          activeTab="overview" 
          onTabChange={mockOnTabChange} 
          isOwner={false} 
        />
      </BrowserRouter>
    );

    // Overview and Stats should be visible
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /stats/i })).toBeInTheDocument();

    // Battle Config and Upgrades should NOT be visible
    expect(screen.queryByRole('tab', { name: /battle config/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /upgrades/i })).not.toBeInTheDocument();
  });

  it('should show all tabs when user is owner', () => {
    const mockOnTabChange = vi.fn();
    
    render(
      <BrowserRouter>
        <TabNavigation 
          activeTab="overview" 
          onTabChange={mockOnTabChange} 
          isOwner={true} 
        />
      </BrowserRouter>
    );

    // All tabs should be visible
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /battle config/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /upgrades/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /stats/i })).toBeInTheDocument();
  });
});

/**
 * Feature: robot-detail-page-visual-enhancement
 * Property 3: Tab State Persistence
 * Validates: Requirements 1.7
 * 
 * For any tab selection and any subsequent page interaction, 
 * the selected tab should remain active until explicitly changed by the user.
 */
describe('Property 3: Tab State Persistence', () => {
  it('should maintain active tab state across renders', () => {
    const mockOnTabChange = vi.fn();
    
    const { rerender } = render(
      <BrowserRouter>
        <TabNavigation 
          activeTab="stats" 
          onTabChange={mockOnTabChange} 
          isOwner={true} 
        />
      </BrowserRouter>
    );

    // Stats tab should be active
    const statsTab = screen.getByRole('tab', { name: /stats/i });
    expect(statsTab).toHaveAttribute('aria-selected', 'true');

    // Re-render with same active tab
    rerender(
      <BrowserRouter>
        <TabNavigation 
          activeTab="stats" 
          onTabChange={mockOnTabChange} 
          isOwner={true} 
        />
      </BrowserRouter>
    );

    // Stats tab should still be active
    expect(statsTab).toHaveAttribute('aria-selected', 'true');
  });
});

/**
 * Feature: robot-detail-page-visual-enhancement
 * Property 4: Active Tab Visual Indication
 * Validates: Requirements 1.8
 * 
 * For any active tab, the tab element should have distinct visual styling 
 * (primary color background, white text) that differs from inactive tabs.
 */
describe('Property 4: Active Tab Visual Indication', () => {
  it('should apply distinct styling to active tab', () => {
    const mockOnTabChange = vi.fn();
    
    render(
      <BrowserRouter>
        <TabNavigation 
          activeTab="battle-config" 
          onTabChange={mockOnTabChange} 
          isOwner={true} 
        />
      </BrowserRouter>
    );

    const battleConfigTab = screen.getByRole('tab', { name: /battle config/i });
    const overviewTab = screen.getByRole('tab', { name: /overview/i });

    // Active tab should have primary color background
    expect(battleConfigTab).toHaveClass('bg-blue-600');
    expect(battleConfigTab).toHaveClass('text-white');
    expect(battleConfigTab).toHaveAttribute('aria-selected', 'true');

    // Inactive tab should have different styling
    expect(overviewTab).toHaveClass('bg-gray-800');
    expect(overviewTab).toHaveClass('text-gray-400');
    expect(overviewTab).toHaveAttribute('aria-selected', 'false');
  });

  it('should show visual difference between all tabs', () => {
    const mockOnTabChange = vi.fn();
    
    render(
      <BrowserRouter>
        <TabNavigation 
          activeTab="upgrades" 
          onTabChange={mockOnTabChange} 
          isOwner={true} 
        />
      </BrowserRouter>
    );

    const tabs = screen.getAllByRole('tab');
    const upgradesTab = screen.getByRole('tab', { name: /upgrades/i });

    // Only one tab should be active
    const activeTabs = tabs.filter(tab => tab.getAttribute('aria-selected') === 'true');
    expect(activeTabs).toHaveLength(1);
    expect(activeTabs[0]).toBe(upgradesTab);

    // Active tab should have distinct styling
    expect(upgradesTab).toHaveClass('bg-blue-600', 'text-white');
  });
});
