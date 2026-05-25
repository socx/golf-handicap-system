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
const SectionPlaceholderPage = lazy(async () => import('./pages/SectionPlaceholderPage'));
const ComponentPreviewPage = lazy(async () =>
  import('./pages/ComponentPreviewPage').then((m) => ({ default: m.ComponentPreviewPage }))
);

const CoursesPage = lazy(async () => import('./pages/CoursesPage'));
const CourseDetailPage = lazy(async () => import('./pages/CourseDetailPage'));

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
        <Route
          path="/players"
          element={<SectionPlaceholderPage title="Players" description="Player roster and account management is queued for the next implementation story." />}
        />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailPage />} />
        <Route
          path="/rounds"
          element={<SectionPlaceholderPage title="Rounds" description="Round entry, validation, and processing workflows will be delivered incrementally." />}
        />
        <Route
          path="/handicap"
          element={<SectionPlaceholderPage title="Handicap" description="Handicap calculations, history, and trend breakdowns are planned in upcoming stories." />}
        />
        <Route
          path="/admin"
          element={<SectionPlaceholderPage title="Admin" description="Administrative controls will expand here as multirole workflows are implemented." />}
        />
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
