import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FacilitiesPage from './pages/FacilitiesPage';
import RobotsPage from './pages/RobotsPage';
import CreateRobotPage from './pages/CreateRobotPage';
import RobotDetailPage from './pages/RobotDetailPage';
import AllRobotsPage from './pages/AllRobotsPage';
import WeaponShopPage from './pages/WeaponShopPage';

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
            path="/all-robots"
            element={
              <ProtectedRoute>
                <AllRobotsPage />
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
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
