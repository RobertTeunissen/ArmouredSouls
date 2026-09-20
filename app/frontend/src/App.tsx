import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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
import TournamentsPage from './pages/TournamentsPage';
import OnboardingPage from './pages/OnboardingPage';
import PlayerShell, { PlayerNotFound } from './components/layout/PlayerShell';
import { useAchievementToasts } from './hooks/useAchievementToasts';
import AchievementToast from './components/AchievementToast';
import AppErrorBoundary from './components/AppErrorBoundary';
import { LegacyCycleSummaryRedirect, LegacyFinancesRedirect } from './components/finance/LegacyFinanceRedirects';

// Lazy-loaded player pages (infrequently visited)
const HallOfRecordsPage = React.lazy(() => import('./pages/HallOfRecordsPage'));
const SeasonArchivePage = React.lazy(() => import('./pages/SeasonArchivePage'));
const TournamentDetailPage = React.lazy(() => import('./pages/TournamentDetailPage'));
const BattleDetailPage = React.lazy(() => import('./pages/BattleDetailPage'));
const BattleHistoryPage = React.lazy(() => import('./pages/BattleHistoryPage'));
const AchievementsPage = React.lazy(() => import('./pages/AchievementsPage'));
const PracticeArenaPage = React.lazy(() => import('./pages/PracticeArenaPage'));
const FinanceCenterPage = React.lazy(() => import('./pages/FinanceCenterPage'));
const StableViewPage = React.lazy(() => import('./pages/StableViewPage'));
const TeamBattlesPage = React.lazy(() => import('./pages/TeamBattlesPage'));
const LeaderboardsFamePage = React.lazy(() => import('./pages/LeaderboardsFamePage'));
const LeaderboardsLossesPage = React.lazy(() => import('./pages/LeaderboardsLossesPage'));
const LeaderboardsPrestigePage = React.lazy(() => import('./pages/LeaderboardsPrestigePage'));
const ChangelogPage = React.lazy(() => import('./pages/ChangelogPage'));
const GuidePage = React.lazy(() => import('./pages/GuidePage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const BookingOfficePage = React.lazy(() => import('./pages/BookingOfficePage'));
const RobotSetupWizardPage = React.lazy(() => import('./pages/RobotSetupWizardPage'));

// Lazy-loaded admin pages
const AdminDashboardPage = React.lazy(() => import('./pages/admin/DashboardPage'));
const AdminSearchAnalyticsPage = React.lazy(() => import('./pages/admin/SearchAnalyticsPage'));
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
const AdminSubscriptionAnalyticsPage = React.lazy(() => import('./pages/admin/SubscriptionAnalyticsPage'));
const AdminTournamentsPage = React.lazy(() => import('./pages/admin/TournamentsPage'));
const AdminSeasonControlPage = React.lazy(() => import('./pages/admin/SeasonControlPage'));

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
  return (
    <Routes>
      {/* Public and onboarding routes intentionally remain outside PlayerShell. */}
      <Route path="/login" element={<FrontPage />} />
      <Route path="/register" element={<FrontPage />} />
      <Route path="/onboarding/*" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

      {/* The admin portal has its own authorization and layout boundary. */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="search-analytics" element={<AdminSearchAnalyticsPage />} />
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
        <Route path="subscriptions" element={<AdminSubscriptionAnalyticsPage />} />
        <Route path="tournaments" element={<AdminTournamentsPage />} />
        <Route path="seasons" element={<AdminSeasonControlPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* All post-onboarding player content shares one protected shell. */}
      <Route element={<ProtectedRoute><PlayerShell /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/facilities" element={<FacilitiesPage />} />
        <Route path="/booking-office" element={<BookingOfficePage />} />
        <Route path="/robots" element={<RobotsPage />} />
        <Route path="/robots/create" element={<CreateRobotPage />} />
        <Route path="/robots/:id/setup" element={<RobotSetupWizardPage />} />
        <Route path="/robots/:id" element={<RobotDetailPage />} />
        <Route path="/weapon-shop" element={<WeaponShopPage />} />
        <Route path="/battle-history" element={<BattleHistoryPage />} />
        <Route path="/battle/:id" element={<BattleDetailPage />} />
        <Route path="/practice-arena" element={<PracticeArenaPage />} />
        <Route path="/league-standings" element={<LeagueStandingsPage />} />
        <Route path="/leaderboards/fame" element={<LeaderboardsFamePage />} />
        <Route path="/leaderboards/prestige" element={<LeaderboardsPrestigePage />} />
        <Route path="/leaderboards/losses" element={<LeaderboardsLossesPage />} />
        <Route path="/income" element={<FinanceCenterPage />} />
        <Route path="/finances" element={<LegacyFinancesRedirect />} />
        <Route path="/hall-of-records" element={<HallOfRecordsPage />} />
        <Route path="/seasons" element={<SeasonArchivePage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
        <Route path="/team-battles" element={<TeamBattlesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/cycle-summary" element={<LegacyCycleSummaryRedirect />} />
        <Route path="/achievements" element={<AchievementsPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/guide/:sectionSlug" element={<GuidePage />} />
        <Route path="/guide/:sectionSlug/:articleSlug" element={<GuidePage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/stables/:userId" element={<StableViewPage />} />
        <Route path="*" element={<PlayerNotFound />} />
      </Route>

      {/* Legacy team aliases redirect before the player layout is entered. */}
      <Route path="/tag-teams" element={<Navigate to="/team-battles" replace />} />
      <Route path="/tag-teams/standings" element={<Navigate to="/team-battles" replace />} />
      <Route path="/" element={<FrontPage />} />
    </Routes>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AchievementToastLayer />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
