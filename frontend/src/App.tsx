import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useAppConfigStore } from './stores/appConfigStore';
import LoginPage from './pages/LoginPage';
import IntakePage from './pages/IntakePage';
import ScannerPage from './pages/ScannerPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import PublicTrackPage from './pages/PublicTrackPage';
import OrdersPage from './pages/OrdersPage';
import MusyrifPage from './pages/MusyrifPage';

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    // Redirect to appropriate page based on role
    if (user.role === 'KASIR') return <Navigate to="/intake" replace />;
    if (user.role === 'OPERATOR') return <Navigate to="/scanner" replace />;
    if (user.role === 'MANAGER') return <Navigate to="/dashboard" replace />;
    if (user.role === 'MUSYRIF') return <Navigate to="/musyrif" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (user?.role === 'KASIR') return <Navigate to="/intake" replace />;
  if (user?.role === 'OPERATOR') return <Navigate to="/scanner" replace />;
  if (user?.role === 'MANAGER') return <Navigate to="/dashboard" replace />;
  if (user?.role === 'MUSYRIF') return <Navigate to="/musyrif" replace />;
  return <Navigate to="/login" replace />;
}

function App() {
  const { loadConfig, title, slogan } = useAppConfigStore();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    document.title = `${title} - ${slogan}`;
  }, [title, slogan]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/track" element={<PublicTrackPage />} />
        <Route
          path="/intake"
          element={
            <ProtectedRoute roles={['KASIR', 'MANAGER']}>
              <IntakePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scanner"
          element={
            <ProtectedRoute roles={['OPERATOR', 'KASIR', 'MANAGER']}>
              <ScannerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={['MANAGER']}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute roles={['KASIR', 'MANAGER', 'OPERATOR']}>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={['MANAGER']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={['MANAGER']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/musyrif"
          element={
            <ProtectedRoute roles={['MUSYRIF']}>
              <MusyrifPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
