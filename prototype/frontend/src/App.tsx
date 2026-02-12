import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FacilitiesPage from './pages/FacilitiesPage';
import RobotsPage from './pages/RobotsPage';
import CreateRobotPage from './pages/CreateRobotPage';
import RobotDetailPage from './pages/RobotDetailPage';
import WeaponShopPage from './pages/WeaponShopPage';
import BattleHistoryPage from './pages/BattleHistoryPage';
import BattleDetailPage from './pages/BattleDetailPage';
import LeagueStandingsPage from './pages/LeagueStandingsPage';
import AdminPage from './pages/AdminPage';
import LeaderboardsFamePage from './pages/LeaderboardsFamePage';
import LeaderboardsPrestigePage from './pages/LeaderboardsPrestigePage';
import LeaderboardsLossesPage from './pages/LeaderboardsLossesPage';
import FinancialReportPage from './pages/FinancialReportPage';
import HallOfRecordsPage from './pages/HallOfRecordsPage';
import TournamentsPage from './pages/TournamentsPage';
import TagTeamManagementPage from './pages/TagTeamManagementPage';
import TagTeamStandingsPage from './pages/TagTeamStandingsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/facilities"
            element={
              <ProtectedRoute>
                <FacilitiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/robots"
            element={
              <ProtectedRoute>
                <RobotsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/robots/create"
            element={
              <ProtectedRoute>
                <CreateRobotPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/robots/:id"
            element={
              <ProtectedRoute>
                <RobotDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/weapon-shop"
            element={
              <ProtectedRoute>
                <WeaponShopPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/battle-history"
            element={
              <ProtectedRoute>
                <BattleHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/battle/:id"
            element={
              <ProtectedRoute>
                <BattleDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/league-standings"
            element={
              <ProtectedRoute>
                <LeagueStandingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboards/fame"
            element={
              <ProtectedRoute>
                <LeaderboardsFamePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboards/prestige"
            element={
              <ProtectedRoute>
                <LeaderboardsPrestigePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboards/losses"
            element={
              <ProtectedRoute>
                <LeaderboardsLossesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/income"
            element={
              <ProtectedRoute>
                <FinancialReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finances"
            element={<Navigate to="/income" replace />}
          />
          <Route
            path="/hall-of-records"
            element={
              <ProtectedRoute>
                <HallOfRecordsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tournaments"
            element={
              <ProtectedRoute>
                <TournamentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tag-teams"
            element={
              <ProtectedRoute>
                <TagTeamManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tag-teams/standings"
            element={
              <ProtectedRoute>
                <TagTeamStandingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
