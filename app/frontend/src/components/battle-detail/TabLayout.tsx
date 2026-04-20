import type { ReactNode } from 'react';
import type { TabId, TabLayoutProps } from './types';

const TAB_DEFINITIONS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'playback', label: 'Playback' },
];

/**
 * Desktop tabbed layout for the Battle Report page.
 *
 * Renders a horizontal tab bar (Overview / Playback) with the
 * active tab's content below. The Playback tab is hidden when `hasPlayback`
 * is false. Follows design system styling and respects `prefers-reduced-motion`.
 */
export function TabLayout({
  activeTab,
  onTabChange,
  hasPlayback,
  children,
}: TabLayoutProps): ReactNode {
  const visibleTabs = hasPlayback
    ? TAB_DEFINITIONS
    : TAB_DEFINITIONS.filter((t) => t.id !== 'playback');

  const contentMap: Record<TabId, ReactNode> = {
    overview: children.overview,
    playback: children.playback ?? null,
  };

  return (
    <div>
      {/* Tab bar */}
      <div
        className="bg-surface-elevated border-b border-white/10 mb-3"
        role="tablist"
        aria-label="Battle report sections"
      >
        <div className="flex">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                role="tab"
                id={`battle-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`battle-panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                className={`
                  px-4 py-3 min-h-[44px] text-sm font-medium
                  transition-colors duration-150 ease-out
                  motion-reduce:transition-none
                  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background
                  ${
                    isActive
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-secondary hover:text-primary/80'
                  }
                `}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tab content */}
      <div
        role="tabpanel"
        id={`battle-panel-${activeTab}`}
        aria-labelledby={`battle-tab-${activeTab}`}
      >
        {contentMap[activeTab]}
      </div>
    </div>
  );
}
