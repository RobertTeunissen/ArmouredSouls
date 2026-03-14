import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import TabNavigation from '../../TabNavigation';

export type TabId = 'overview' | 'matches' | 'analytics' | 'battle-config' | 'upgrades' | 'stats';

export const ALL_TABS: TabId[] = ['overview', 'matches', 'analytics', 'battle-config', 'upgrades', 'stats'];
export const PUBLIC_TABS: TabId[] = ['overview', 'matches', 'analytics'];
export const OWNER_ONLY_TABS: TabId[] = ['battle-config', 'upgrades', 'stats'];

export function isOwnerOnlyTab(tab: TabId): boolean {
  return OWNER_ONLY_TABS.includes(tab);
}

export function createMockOnTabChange() {
  return vi.fn();
}

export function renderTabNavigation(activeTab: TabId, isOwner: boolean, onTabChange = createMockOnTabChange()) {
  return render(
    <BrowserRouter>
      <TabNavigation
        activeTab={activeTab}
        onTabChange={onTabChange}
        isOwner={isOwner}
      />
    </BrowserRouter>
  );
}
