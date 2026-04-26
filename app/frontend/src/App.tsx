import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import FrontPage from './pages/FrontPage';
import DashboardPage from './pages/DashboardPage';
import FacilitiesPage from './pages/FacilitiesPage';
import RobotsPage from './pages/RobotsPage';
import CreateRobotPage from './pages/CreateRobotPage';
import RobotDetailPage from './pages/RobotDetailPage';
import WeaponShopPage from './pages/WeaponShopPage';
import BattleHistoryPage from './pages/BattleHistoryPage';
import BattleDetailPage from './pages/BattleDetailPage';
import LeagueStandingsPage from './pages/LeagueStandingsPage';
import KothStandingsPage from './pages/KothStandingsPage';
import AdminPage from './pages/AdminPage';
import LeaderboardsFamePage from './pages/LeaderboardsFamePage';
import LeaderboardsPrestigePage from './pages/LeaderboardsPrestigePage';
import LeaderboardsLossesPage from './pages/LeaderboardsLossesPage';
import FinancialReportPage from './pages/FinancialReportPage';
import HallOfRecordsPage from './pages/HallOfRecordsPage';
import TournamentsPage from './pages/TournamentsPage';
import TournamentDetailPage from './pages/TournamentDetailPage';
import TagTeamManagementPage from './pages/TagTeamManagementPage';
import TagTeamStandingsPage from './pages/TagTeamStandingsPage';
import ProfilePage from './pages/ProfilePage';
import CycleSummaryPage from './pages/CycleSummaryPage';
import OnboardingPage from './pages/OnboardingPage';
import OnboardingAnalyticsPage from './pages/OnboardingAnalyticsPage';
import GuidePage from './pages/GuidePage';
import PracticeArenaPage from './pages/PracticeArenaPage';
import StableViewPage from './pages/StableViewPage';
import ChangelogPage from './pages/ChangelogPage';
import AchievementsPage from './pages/AchievementsPage';
import { useAchievementToasts } from './hooks/useAchievementToasts';
import AchievementToast from './components/AchievementToast';

function AchievementToastLayer() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const { toasts, dismissToast } = useAchievementToasts(!isAdminPage);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-4 z-[999] flex flex-col gap-2">
      {toasts.map((toast, i) => (
        <AchievementToast
          key={`${toast.id}-${i}`}
          achievement={toast}
          onDismiss={() => dismissToast(i)}
        />
      ))}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AchievementToastLayer />
        <Routes>
          <Route path="/login" element={<FrontPage />} />
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/facilities" element={<ProtectedRoute><FacilitiesPage /></ProtectedRoute>} />
          <Route path="/robots" element={<ProtectedRoute><RobotsPage /></ProtectedRoute>} />
          <Route path="/robots/create" element={<ProtectedRoute><CreateRobotPage /></ProtectedRoute>} />
          <Route path="/robots/:id" element={<ProtectedRoute><RobotDetailPage /></ProtectedRoute>} />
          <Route path="/weapon-shop" element={<ProtectedRoute><WeaponShopPage /></ProtectedRoute>} />
          <Route path="/battle-history" element={<ProtectedRoute><BattleHistoryPage /></ProtectedRoute>} />
          <Route path="/battle/:id" element={<ProtectedRoute><BattleDetailPage /></ProtectedRoute>} />
          <Route path="/practice-arena" element={<ProtectedRoute><PracticeArenaPage /></ProtectedRoute>} />
          <Route path="/league-standings" element={<ProtectedRoute><LeagueStandingsPage /></ProtectedRoute>} />
          <Route path="/koth-standings" element={<ProtectedRoute><KothStandingsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/leaderboards/fame" element={<ProtectedRoute><LeaderboardsFamePage /></ProtectedRoute>} />
          <Route path="/leaderboards/prestige" element={<ProtectedRoute><LeaderboardsPrestigePage /></ProtectedRoute>} />
          <Route path="/leaderboards/losses" element={<ProtectedRoute><LeaderboardsLossesPage /></ProtectedRoute>} />
          <Route path="/income" element={<ProtectedRoute><FinancialReportPage /></ProtectedRoute>} />
          <Route path="/finances" element={<Navigate to="/income" replace />} />
          <Route path="/hall-of-records" element={<ProtectedRoute><HallOfRecordsPage /></ProtectedRoute>} />
          <Route path="/tournaments" element={<ProtectedRoute><TournamentsPage /></ProtectedRoute>} />
          <Route path="/tournaments/:id" element={<ProtectedRoute><TournamentDetailPage /></ProtectedRoute>} />
          <Route path="/tag-teams" element={<ProtectedRoute><TagTeamManagementPage /></ProtectedRoute>} />
          <Route path="/tag-teams/standings" element={<ProtectedRoute><TagTeamStandingsPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/cycle-summary" element={<ProtectedRoute><CycleSummaryPage /></ProtectedRoute>} />
          <Route path="/admin/onboarding-analytics" element={<ProtectedRoute><OnboardingAnalyticsPage /></ProtectedRoute>} />
          <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
          <Route path="/guide" element={<ProtectedRoute><GuidePage /></ProtectedRoute>} />
          <Route path="/guide/:sectionSlug" element={<ProtectedRoute><GuidePage /></ProtectedRoute>} />
          <Route path="/guide/:sectionSlug/:articleSlug" element={<ProtectedRoute><GuidePage /></ProtectedRoute>} />
          <Route path="/changelog" element={<ProtectedRoute><ChangelogPage /></ProtectedRoute>} />
          <Route path="/stables/:userId" element={<ProtectedRoute><StableViewPage /></ProtectedRoute>} />
          <Route path="/" element={<FrontPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
