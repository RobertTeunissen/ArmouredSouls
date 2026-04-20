import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabLayout } from '../TabLayout';
import type { TabId } from '../types';

function renderTabLayout(overrides: {
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  hasPlayback?: boolean;
  children?: {
    overview: React.ReactNode;
    playback?: React.ReactNode;
  };
} = {}) {
  const defaultProps = {
    activeTab: 'overview' as TabId,
    onTabChange: vi.fn(),
    hasPlayback: true,
    children: {
      overview: <div data-testid="overview-content">Overview Content</div>,
      playback: <div data-testid="playback-content">Playback Content</div>,
    },
    ...overrides,
  };

  return {
    ...render(<TabLayout {...defaultProps} />),
    onTabChange: defaultProps.onTabChange,
  };
}

describe('TabLayout', () => {
  describe('renders tab bar', () => {
    it('should render Overview and Playback tabs when hasPlayback is true', () => {
      renderTabLayout({ hasPlayback: true });

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toHaveTextContent('Overview');
      expect(tabs[1]).toHaveTextContent('Playback');
    });

    it('should have correct aria-label on the tablist', () => {
      renderTabLayout();
      expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Battle report sections');
    });
  });

  describe('hides Playback tab when hasPlayback is false', () => {
    it('should render only Overview tab', () => {
      renderTabLayout({ hasPlayback: false });

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(1);
      expect(tabs[0]).toHaveTextContent('Overview');
    });
  });

  describe('active tab shows correct content', () => {
    it('should show overview content when activeTab is overview', () => {
      renderTabLayout({ activeTab: 'overview' });
      expect(screen.getByTestId('overview-content')).toBeInTheDocument();
      expect(screen.queryByTestId('playback-content')).not.toBeInTheDocument();
    });

    it('should show playback content when activeTab is playback', () => {
      renderTabLayout({ activeTab: 'playback', hasPlayback: true });
      expect(screen.getByTestId('playback-content')).toBeInTheDocument();
      expect(screen.queryByTestId('overview-content')).not.toBeInTheDocument();
    });

    it('should mark the active tab with aria-selected true', () => {
      renderTabLayout({ activeTab: 'overview' });
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('should set tabIndex 0 on active tab and -1 on inactive tabs', () => {
      renderTabLayout({ activeTab: 'playback' });
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
    });

    it('should render the correct tabpanel with aria-labelledby', () => {
      renderTabLayout({ activeTab: 'overview' });
      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveAttribute('id', 'battle-panel-overview');
      expect(panel).toHaveAttribute('aria-labelledby', 'battle-tab-overview');
    });
  });

  describe('clicking a tab calls onTabChange with correct TabId', () => {
    it('should call onTabChange with "playback" when Playback tab is clicked', async () => {
      const user = userEvent.setup();
      const { onTabChange } = renderTabLayout({ activeTab: 'overview' });
      await user.click(screen.getByRole('tab', { name: 'Playback' }));
      expect(onTabChange).toHaveBeenCalledTimes(1);
      expect(onTabChange).toHaveBeenCalledWith('playback');
    });

    it('should call onTabChange with "overview" when Overview tab is clicked', async () => {
      const user = userEvent.setup();
      const { onTabChange } = renderTabLayout({ activeTab: 'playback' });
      await user.click(screen.getByRole('tab', { name: 'Overview' }));
      expect(onTabChange).toHaveBeenCalledTimes(1);
      expect(onTabChange).toHaveBeenCalledWith('overview');
    });
  });
});
