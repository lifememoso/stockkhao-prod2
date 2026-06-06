import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import StaffLayout from './components/layouts/StaffLayout.jsx';
import AdminLayout from './components/layouts/AdminLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

import Step1 from './pages/staff/Step1';
import Step2 from './pages/staff/Step2';
import Step3 from './pages/staff/Step3';
import Step4 from './pages/staff/Step4';
import Inventory from './pages/staff/Inventory';
import Profile from './pages/profile/Profile';

import Dashboard from './pages/admin/Dashboard';
import Approvals from './pages/admin/Approvals';
import Users from './pages/admin/Users';
import ActivityLog from './pages/admin/ActivityLog';
import Export from './pages/admin/Export';
import Settings from './pages/admin/Settings';
import Traceability from './pages/admin/Traceability';

export default function App() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-green-50">
        <div className="text-center">
          <div className="text-5xl mb-4">🌾</div>
          <p className="text-gray-600 font-semibold">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={user.role === 'staff' ? '/staff/step1' : '/admin'} replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to={user.role === 'staff' ? '/staff/step1' : '/admin'} replace /> : <Register />} />

        {/* Staff */}
        <Route path="/staff/*" element={
          <ProtectedRoute allowedRoles={['staff', 'admin', 'superadmin']}>
            <StaffLayout />
          </ProtectedRoute>
        }>
          <Route path="step1" element={<Step1 />} />
          <Route path="step2" element={<Step2 />} />
          <Route path="step3" element={<Step3 />} />
          <Route path="step4" element={<Step4 />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Admin */}
        <Route path="/admin/*" element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route path="" element={<Dashboard />} />
          <Route path="step1" element={<Step1 />} />
          <Route path="step2" element={<Step2 />} />
          <Route path="step3" element={<Step3 />} />
          <Route path="step4" element={<Step4 />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="users" element={<Users />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="export" element={<Export />} />
          <Route path="settings" element={<Settings />} />
          <Route path="traceability" element={<Traceability />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/" element={user ? <Navigate to={user.role === 'staff' ? '/staff/step1' : '/admin'} replace /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}