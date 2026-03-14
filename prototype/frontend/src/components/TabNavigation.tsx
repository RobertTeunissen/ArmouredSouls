import { useEffect, useRef } from 'react';

interface TabNavigationProps {
  activeTab: 'overview' | 'matches' | 'battle-config' | 'upgrades' | 'stats' | 'analytics';
  onTabChange: (tab: 'overview' | 'matches' | 'battle-config' | 'upgrades' | 'stats' | 'analytics') => void;
  isOwner: boolean;
}

const tabs = [
  { id: 'overview' as const, label: 'Overview', icon: '📊', ownerOnly: false },
  { id: 'matches' as const, label: 'Matches', icon: '⚔️', ownerOnly: false },
  { id: 'analytics' as const, label: 'Analytics', icon: '📈', ownerOnly: false },
  { id: 'battle-config' as const, label: 'Battle Config', icon: '⚙️', ownerOnly: true },
  { id: 'upgrades' as const, label: 'Upgrades', icon: '⬆️', ownerOnly: true },
  { id: 'stats' as const, label: 'Stats', icon: '🔧', ownerOnly: true },
];

function TabNavigation({ activeTab, onTabChange, isOwner }: TabNavigationProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const visibleTabs = tabs.filter(tab => !tab.ownerOnly || isOwner);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = visibleTabs.findIndex(tab => tab.id === activeTab);
      
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        const prevTab = visibleTabs[currentIndex - 1];
        onTabChange(prevTab.id);
        tabRefs.current[currentIndex - 1]?.focus();
      } else if (e.key === 'ArrowRight' && currentIndex < visibleTabs.length - 1) {
        e.preventDefault();
        const nextTab = visibleTabs[currentIndex + 1];
        onTabChange(nextTab.id);
        tabRefs.current[currentIndex + 1]?.focus();
      }
    };

    // Only add listener if a tab button is focused
    const activeElement = document.activeElement;
    const isTabFocused = tabRefs.current.some(ref => ref === activeElement);
    
    if (isTabFocused) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [activeTab, onTabChange, visibleTabs]);

  return (
    <div className="border-b border-white/10 mb-6">
      <nav className="flex overflow-x-auto scrollbar-hide space-x-1 flex-nowrap" role="tablist" aria-label="Robot detail tabs">
        {visibleTabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              ref={el => tabRefs.current[index] = el}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.id}-panel`}
              id={`${tab.id}-tab`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-4 lg:px-6 py-3 min-h-[44px] font-medium text-sm rounded-t-lg whitespace-nowrap flex-shrink-0
                transition-all duration-150 ease-out
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background
                ${isActive 
                  ? 'bg-primary text-white border-b-2 border-blue-600' 
                  : 'bg-surface text-secondary hover:bg-surface-elevated hover:text-secondary'
                }
              `}
            >
              <span className="mr-2" aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default TabNavigation;
