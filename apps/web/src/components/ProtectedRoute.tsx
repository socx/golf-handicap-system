import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAccessToken } from '../lib/authStorage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  if (!getAccessToken()) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}