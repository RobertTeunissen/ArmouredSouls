/**
 * AdminPage — thin shell component for the Admin Portal.
 *
 * Handles tab navigation, URL hash / localStorage persistence,
 * session log state, and stats fetching. All tab-specific rendering
 * is delegated to dedicated components under ../components/admin/.
 *
 * Requirements: 2.1, 3.5
 */
import { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import TournamentManagement from '../components/TournamentManagement';
import {
  DashboardTab,
  CycleControlsTab,
  BattleLogsTab,
  RobotStatsTab,
  BankruptcyMonitorTab,
  RecentUsersTab,
  RepairLogTab,
} from '../components/admin';
import type { SessionLogEntry, SystemStats } from '../components/admin/types';
import apiClient from '../utils/apiClient';

type TabType = 'dashboard' | 'cycles' | 'tournaments' | 'battles' | 'stats' | 'bankruptcy-monitor' | 'recent-users' | 'repair-log';

const VALID_TABS: TabType[] = ['dashboard', 'cycles', 'tournaments', 'battles', 'stats', 'bankruptcy-monitor', 'recent-users', 'repair-log'];

const TAB_LABELS: Record<TabType, string> = {
  dashboard: '📊 Dashboard',
  cycles: '⚙️ Cycle Controls',
  tournaments: '🏆 Tournaments',
  battles: '⚔️ Battle Logs',
  stats: '🤖 Robot Stats',
  'bankruptcy-monitor': '💰 Bankruptcy Monitor',
  'recent-users': '👥 Recent Users',
  'repair-log': '🔧 Repair Log',
};

function isValidTab(value: string): value is TabType {
  return VALID_TABS.includes(value as TabType);
}

function AdminPage(): JSX.Element {
  /* ---------- Tab state with URL hash + localStorage persistence ---------- */
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const hash = window.location.hash.replace('#', '');
    if (isValidTab(hash)) return hash;
    const stored = localStorage.getItem('adminActiveTab');
    if (stored && isValidTab(stored)) return stored;
    return 'dashboard';
  });

  /* ---------- Session log state ---------- */
  const [sessionLog, setSessionLog] = useState<SessionLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('adminSessionLog');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (entry: unknown) =>
          entry &&
          typeof (entry as SessionLogEntry).timestamp === 'string' &&
          typeof (entry as SessionLogEntry).type === 'string' &&
          typeof (entry as SessionLogEntry).message === 'string',
      );
    } catch {
      return [];
    }
  });

  /* ---------- Stats state (passed to DashboardTab) ---------- */
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);

  /* ---------- Session log helpers ---------- */
  const addSessionLog = (type: SessionLogEntry['type'], message: string, details?: unknown): void => {
    const entry: SessionLogEntry = { timestamp: new Date().toISOString(), type, message, details };
    setSessionLog((prev) => {
      const newLog = [entry, ...prev].slice(0, 100);
      localStorage.setItem('adminSessionLog', JSON.stringify(newLog));
      return newLog;
    });
  };

  const clearSessionLog = (): void => {
    setSessionLog([]);
    localStorage.removeItem('adminSessionLog');
  };

  const exportSessionLog = (): void => {
    const dataStr = JSON.stringify(sessionLog, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-session-log-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- Tab switching ---------- */
  const switchTab = (tab: TabType): void => {
    setActiveTab(tab);
    localStorage.setItem('adminActiveTab', tab);
    window.location.hash = tab;
  };

  /* ---------- Stats fetching ---------- */
  const fetchStats = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await apiClient.get<SystemStats>('/api/admin/stats');
      setStats(response.data);
    } catch {
      // DashboardTab handles empty stats gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-background text-white">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Admin Portal</h1>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-white/10">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Admin sections">
            {VALID_TABS.map((tab) => (
              <button
                key={tab}
                id={`${tab}-tab`}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`${tab}-panel`}
                onClick={() => switchTab(tab)}
                className={`px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-surface text-white border-b-2 border-primary'
                    : 'text-secondary hover:text-white hover:bg-surface'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Panels */}
        {activeTab === 'dashboard' && (
          <div role="tabpanel" id="dashboard-panel" aria-labelledby="dashboard-tab">
            <DashboardTab stats={stats} loading={loading} />
          </div>
        )}
        {activeTab === 'cycles' && (
          <div role="tabpanel" id="cycles-panel" aria-labelledby="cycles-tab">
            <CycleControlsTab
              addSessionLog={addSessionLog}
              sessionLog={sessionLog}
              clearSessionLog={clearSessionLog}
              exportSessionLog={exportSessionLog}
            />
          </div>
        )}
        {activeTab === 'tournaments' && (
          <div role="tabpanel" id="tournaments-panel" aria-labelledby="tournaments-tab">
            <TournamentManagement />
          </div>
        )}
        {activeTab === 'battles' && (
          <div role="tabpanel" id="battles-panel" aria-labelledby="battles-tab">
            <BattleLogsTab />
          </div>
        )}
        {activeTab === 'stats' && (
          <div role="tabpanel" id="stats-panel" aria-labelledby="stats-tab">
            <RobotStatsTab />
          </div>
        )}
        {activeTab === 'bankruptcy-monitor' && (
          <div role="tabpanel" id="bankruptcy-monitor-panel" aria-labelledby="bankruptcy-monitor-tab">
            <BankruptcyMonitorTab />
          </div>
        )}
        {activeTab === 'recent-users' && (
          <div role="tabpanel" id="recent-users-panel" aria-labelledby="recent-users-tab">
            <RecentUsersTab />
          </div>
        )}
        {activeTab === 'repair-log' && (
          <div role="tabpanel" id="repair-log-panel" aria-labelledby="repair-log-tab">
            <RepairLogTab />
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPage;
