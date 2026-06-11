import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppErrorBoundary from './components/feedback/AppErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import RouteFallback from './components/RouteFallback';
import AppLayout from './components/layout/AppLayout';
import { AuthProvider } from './context/AuthContext';
import ThemeProvider from './context/ThemeContext';
import ToastProvider from './components/feedback/ToastProvider';

const LoginPage = lazy(async () => {
  const module = await import('./pages/LoginPage');
  return { default: module.LoginPage };
});

const RegisterPage = lazy(async () => {
  const module = await import('./pages/RegisterPage');
  return { default: module.RegisterPage };
});

const ActivateAccountPage = lazy(async () => {
  const module = await import('./pages/ActivateAccountPage');
  return { default: module.ActivateAccountPage };
});

const DashboardPage = lazy(async () => import('./pages/DashboardPage'));
const RoundsPage = lazy(async () => import('./pages/RoundsPage'));
const ComponentPreviewPage = lazy(async () =>
  import('./pages/ComponentPreviewPage').then((m) => ({ default: m.ComponentPreviewPage }))
);

const CoursesPage = lazy(async () => import('./pages/CoursesPage'));
const CourseFormPage = lazy(async () => import('./pages/CourseFormPage'));
const CourseDetailPage = lazy(async () => import('./pages/CourseDetailPage'));
const CourseTeeConfigEditorPage = lazy(async () => import('./pages/CourseTeeConfigEditorPage'));
const PlayersPage = lazy(async () => import('./pages/PlayersPage'));
const PlayerProfilePage = lazy(async () => import('./pages/PlayerProfilePage'));
const PlayerEditPage = lazy(async () => import('./pages/PlayerEditPage'));
const AdminPlayersPage = lazy(async () => import('./pages/AdminPlayersPage'));
const AdminRoundsPage = lazy(async () => import('./pages/AdminRoundsPage'));
const AdminHandicapOverridePage = lazy(async () => import('./pages/AdminHandicapOverridePage'));
const AdminSettingsPage = lazy(async () => import('./pages/AdminSettingsPage'));
const AdminHomePage = lazy(async () => import('./pages/AdminHomePage'));
const HandicapPage = lazy(async () => import('./pages/HandicapPage'));
const HandicapHistoryPage = lazy(async () => import('./pages/HandicapHistoryPage'));
const RoundEntryPage = lazy(async () => import('./pages/RoundEntryPage'));
const RoundScorecardPage = lazy(async () => import('./pages/RoundScorecardPage'));
const SettingsPage = lazy(async () => import('./pages/SettingsPage'));

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/auth/activate" element={<ActivateAccountPage />} />
      <Route path="/components" element={<ComponentPreviewPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/players/:playerId" element={<PlayerProfilePage />} />
        <Route path="/players/:playerId/edit" element={<PlayerEditPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/new" element={<CourseFormPage />} />
        <Route path="/courses/:courseId/edit" element={<CourseFormPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route path="/courses/:courseId/configurations/new" element={<CourseTeeConfigEditorPage />} />
        <Route path="/courses/:courseId/configurations/:configId/edit" element={<CourseTeeConfigEditorPage />} />
        <Route path="/rounds" element={<RoundsPage />} />
        <Route path="/rounds/new" element={<RoundEntryPage />} />
        <Route path="/rounds/:roundId" element={<RoundScorecardPage />} />
        <Route
          path="/handicap"
          element={<HandicapPage />}
        />
        <Route path="/handicap/history/:playerId" element={<HandicapHistoryPage />} />
        <Route path="/admin" element={<AdminHomePage />} />
        <Route path="/admin/players" element={<AdminPlayersPage />} />
        <Route path="/admin/rounds" element={<AdminRoundsPage />} />
        <Route path="/admin/handicap-override/:playerId" element={<AdminHandicapOverridePage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export const App: React.FC = () => (
  <BrowserRouter>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <AppRoutes />
            </Suspense>
          </AppErrorBoundary>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;
