import React from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { clearTokens, getAccessToken, getStoredUser, setStoredUser } from './lib/api';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleLogout = () => {
    clearTokens();
    setStoredUser(null);
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Welcome</h1>
        <p className="mt-2 text-sm text-gray-600">
          Signed in as <span className="font-medium">{user?.email || 'unknown user'}</span>
        </p>
        <p className="mt-1 text-sm text-gray-600">
          Role: <span className="font-medium">{user?.role || 'unknown'}</span>
        </p>

        <div className="mt-5 flex gap-3">
          <Link className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-medium text-teal-700" to="/auth/register">
            Admin registration page
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white"
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

const ProtectedHomeRoute: React.FC = () => {
  if (!getAccessToken()) {
    return <Navigate to="/auth/login" replace />;
  }
  return <HomePage />;
};

export const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/" element={<ProtectedHomeRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
