import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import FrontPage from './pages/FrontPage';
import DashboardPage from './pages/DashboardPage';
import FacilitiesPage from './pages/FacilitiesPage';
import RobotsPage from './pages/RobotsPage';
import CreateRobotPage from './pages/CreateRobotPage';
import RobotDetailPage from './pages/RobotDetailPage';
import WeaponShopPage from './pages/WeaponShopPage';
import LeagueStandingsPage from './pages/LeagueStandingsPage';
import TagTeamManagementPage from './pages/TagTeamManagementPage';
import TournamentsPage from './pages/TournamentsPage';
import OnboardingPage from './pages/OnboardingPage';
import { useAchievementToasts } from './hooks/useAchievementToasts';
import AchievementToast from './components/AchievementToast';
import AppErrorBoundary from './components/AppErrorBoundary';

// Lazy-loaded player pages (infrequently visited)
const HallOfRecordsPage = React.lazy(() => import('./pages/HallOfRecordsPage'));
const TournamentDetailPage = React.lazy(() => import('./pages/TournamentDetailPage'));
const BattleDetailPage = React.lazy(() => import('./pages/BattleDetailPage'));
const BattleHistoryPage = React.lazy(() => import('./pages/BattleHistoryPage'));
const AchievementsPage = React.lazy(() => import('./pages/AchievementsPage'));
const PracticeArenaPage = React.lazy(() => import('./pages/PracticeArenaPage'));
const CycleSummaryPage = React.lazy(() => import('./pages/CycleSummaryPage'));
const FinancialReportPage = React.lazy(() => import('./pages/FinancialReportPage'));
const StableViewPage = React.lazy(() => import('./pages/StableViewPage'));
const KothStandingsPage = React.lazy(() => import('./pages/KothStandingsPage'));
const TagTeamStandingsPage = React.lazy(() => import('./pages/TagTeamStandingsPage'));
const LeaderboardsFamePage = React.lazy(() => import('./pages/LeaderboardsFamePage'));
const LeaderboardsLossesPage = React.lazy(() => import('./pages/LeaderboardsLossesPage'));
const LeaderboardsPrestigePage = React.lazy(() => import('./pages/LeaderboardsPrestigePage'));
const ChangelogPage = React.lazy(() => import('./pages/ChangelogPage'));
const GuidePage = React.lazy(() => import('./pages/GuidePage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));

// Lazy-loaded admin pages
const AdminDashboardPage = React.lazy(() => import('./pages/admin/DashboardPage'));
const AdminCycleControlsPage = React.lazy(() => import('./pages/admin/CycleControlsPage'));
const AdminPracticeArenaPage = React.lazy(() => import('./pages/admin/PracticeArenaPage'));
const AdminBattleLogsPage = React.lazy(() => import('./pages/admin/BattleLogsPage'));
const AdminRobotStatsPage = React.lazy(() => import('./pages/admin/RobotStatsPage'));
const AdminLeagueHealthPage = React.lazy(() => import('./pages/admin/LeagueHealthPage'));
const AdminWeaponAnalyticsPage = React.lazy(() => import('./pages/admin/WeaponAnalyticsPage'));
const AdminPlayersPage = React.lazy(() => import('./pages/admin/PlayersPage'));
const AdminEconomyOverviewPage = React.lazy(() => import('./pages/admin/EconomyOverviewPage'));
const AdminSecurityPage = React.lazy(() => import('./pages/admin/SecurityPage'));
const AdminImageUploadsPage = React.lazy(() => import('./pages/admin/ImageUploadsPage'));
const AdminChangelogPage = React.lazy(() => import('./pages/admin/AdminChangelogPage'));
const AdminAchievementAnalyticsPage = React.lazy(() => import('./pages/admin/AchievementAnalyticsPage'));
const AdminTuningAdoptionPage = React.lazy(() => import('./pages/admin/TuningAdoptionPage'));
const AdminRefinementAdoptionPage = React.lazy(() => import('./pages/admin/RefinementAdoptionPage'));
const AdminRepairLogPage = React.lazy(() => import('./pages/admin/RepairLogPage'));
const AdminAuditLogPage = React.lazy(() => import('./pages/admin/AuditLogPage'));
const AdminLeagueHistoryPage = React.lazy(() => import('./pages/admin/LeagueHistoryPage'));

// Loading fallback for lazy-loaded player pages
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-secondary">Loading...</div>
    </div>
  );
}

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

function AppRoutes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <Suspense fallback={<PageLoader />}>
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
      <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
      <Route path="/guide" element={<ProtectedRoute><GuidePage /></ProtectedRoute>} />
      <Route path="/guide/:sectionSlug" element={<ProtectedRoute><GuidePage /></ProtectedRoute>} />
      <Route path="/guide/:sectionSlug/:articleSlug" element={<ProtectedRoute><GuidePage /></ProtectedRoute>} />
      <Route path="/changelog" element={<ProtectedRoute><ChangelogPage /></ProtectedRoute>} />
      <Route path="/stables/:userId" element={<ProtectedRoute><StableViewPage /></ProtectedRoute>} />
      {isAdmin && (
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="cycles" element={<AdminCycleControlsPage />} />
          <Route path="practice-arena" element={<AdminPracticeArenaPage />} />
          <Route path="battles" element={<AdminBattleLogsPage />} />
          <Route path="robot-stats" element={<AdminRobotStatsPage />} />
          <Route path="league-health" element={<AdminLeagueHealthPage />} />
          <Route path="weapons" element={<AdminWeaponAnalyticsPage />} />
          <Route path="players" element={<AdminPlayersPage />} />
          <Route path="economy" element={<AdminEconomyOverviewPage />} />
          <Route path="security" element={<AdminSecurityPage />} />
          <Route path="image-uploads" element={<AdminImageUploadsPage />} />
          <Route path="changelog" element={<AdminChangelogPage />} />
          <Route path="achievements" element={<AdminAchievementAnalyticsPage />} />
          <Route path="tuning" element={<AdminTuningAdoptionPage />} />
          <Route path="refinement" element={<AdminRefinementAdoptionPage />} />
          <Route path="repair-log" element={<AdminRepairLogPage />} />
          <Route path="audit-log" element={<AdminAuditLogPage />} />
          <Route path="league-history" element={<AdminLeagueHistoryPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      )}
      <Route path="/" element={<FrontPage />} />
    </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AchievementToastLayer />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
