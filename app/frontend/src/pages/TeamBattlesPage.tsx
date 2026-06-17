import { useSearchParams } from 'react-router-dom';
import Navigation from '../components/Navigation';
import TeamBattleManagementContent from '../components/team-battles/TeamBattleManagementContent';

type TeamBattlesTab = '2v2' | '3v3';

const TABS: { id: TeamBattlesTab; label: string; icon: string }[] = [
  { id: '2v2', label: '2v2 Teams', icon: '⚔️' },
  { id: '3v3', label: '3v3 Teams', icon: '⚔️' },
];

function isValidTab(value: string | null): value is TeamBattlesTab {
  return value === '2v2' || value === '3v3';
}

function TeamBattlesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: TeamBattlesTab = isValidTab(rawTab) ? rawTab : '2v2';

  const switchTab = (tab: TeamBattlesTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === '2v2') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />

      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        {/* Page Header */}
        <div className="mb-6 pb-4 border-b border-white/10">
          <h1 className="text-3xl font-bold text-white">My Teams</h1>
          <p className="text-secondary mt-1">Register and manage your teams for multi-robot battle modes</p>
        </div>

        {/* Tab Bar */}
        <div
          className="flex flex-col lg:flex-row gap-2 border-b border-secondary/30 mb-6"
          role="tablist"
          aria-label="Team battle mode tabs"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`team-battles-${tab.id}-tab`}
                aria-selected={isActive}
                aria-controls={`team-battles-${tab.id}-panel`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => switchTab(tab.id)}
                className={`
                  min-h-[44px] px-4 py-3 lg:py-2 lg:-mb-px border-b-2 transition-colors
                  font-medium text-sm lg:text-base
                  ${isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-secondary hover:text-white'
                  }
                `}
              >
                <span className="mr-2" aria-hidden="true">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <div
          role="tabpanel"
          id={`team-battles-${activeTab}-panel`}
          aria-labelledby={`team-battles-${activeTab}-tab`}
        >
          {activeTab === '2v2' && (
            <TeamBattleManagementContent teamSize={2} />
          )}
          {activeTab === '3v3' && (
            <TeamBattleManagementContent teamSize={3} />
          )}
        </div>
      </div>
    </div>
  );
}

export default TeamBattlesPage;
