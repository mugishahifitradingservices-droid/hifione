/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import Contacts from './pages/Contacts';
import UserManagement from './pages/settings/Users';
import MyDay from './pages/field/MyDay';
import TeamPlanning from './pages/field/TeamPlanning';
import FieldMode from './pages/field/FieldMode';
import { AppLayoutSkeleton } from './components/ui/Skeleton';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <AppLayoutSkeleton />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <AppLayoutSkeleton />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="organizations" element={<Organizations />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="field">
          <Route path="mode" element={<FieldMode />} />
          <Route path="my-day" element={<MyDay />} />
          <Route path="team-planning" element={<TeamPlanning />} />
        </Route>
        <Route path="settings/users" element={<UserManagement />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
