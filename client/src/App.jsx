import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import UserManagement from './pages/UserManagement';
import TeamManagement from './pages/TeamManagement';
import ProjectManagement from './pages/ProjectManagement';
import BlowingDepartment from './pages/BlowingDepartment';
import FusionDepartment from './pages/FusionDepartment';
import AppointmentsPage from './pages/AppointmentsPage';
import ActivationPage from './pages/ActivationPage';
import SettingsPage from './pages/SettingsPage';

import ActivationsHistoryPage from './pages/ActivationsHistoryPage';
import CompleteActivationPage from './pages/CompleteActivationPage';
import ProtocolsPage from './pages/ProtocolsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activation/:id/complete" element={<CompleteActivationPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="teams" element={<TeamManagement />} />
          <Route path="projects" element={<ProjectManagement />} />
          <Route path="blowing" element={<BlowingDepartment />} />
          <Route path="fusion" element={<FusionDepartment />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="activations" element={<ActivationPage />} />
          <Route path="protocols" element={<ProtocolsPage />} />
          <Route path="activations-history" element={<ActivationsHistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
