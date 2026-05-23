import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import RouteFallback from './components/RouteFallback';

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

const HomePage = lazy(async () => import('./pages/HomePage'));

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/auth/activate" element={<ActivateAccountPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export const App: React.FC = () => (
  <BrowserRouter>
    <Suspense fallback={<RouteFallback />}>
      <AppRoutes />
    </Suspense>
  </BrowserRouter>
);

export default App;
