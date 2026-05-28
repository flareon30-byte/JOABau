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

import BillingPage from './pages/BillingManager';
import PayrollPage from './pages/PayrollPage';
import ActivationPageV2 from './pages/ActivationPageV2';
import ProtocolDepartment from './pages/ProtocolDepartment';
import IssuesPage from './pages/IssuesPage';
import MyEarningsPage from './pages/MyEarningsPage';
import BillingDebug from './pages/BillingDebug';
import RepairCompletionPage from './pages/RepairCompletionPage';
import VacationPage from './pages/VacationPage';
import AdminVacationPage from './pages/AdminVacationPage';
import MaterialOrdersPage from './pages/MaterialOrdersPage';
import GnkInstallationForm from './pages/GnkInstallationForm';
import VehicleManagement from './pages/VehicleManagement';
import VehicleLogForm from './pages/VehicleLogForm';
import InvoicingPage from './pages/InvoicingPage';
import CompanySettingsPage from './pages/CompanySettingsPage';
import ProjectMapPage from './pages/ProjectMapPage';
import AccommodationsPage from './pages/AccommodationsPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activation/:id/complete" element={<ActivationPageV2 />} />
        <Route path="/repair/:id/complete" element={<RepairCompletionPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="teams" element={<TeamManagement />} />
          <Route path="projects" element={<ProjectManagement />} />
          <Route path="blowing" element={<BlowingDepartment />} />
          <Route path="fusion" element={<FusionDepartment />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="activations" element={<ActivationPage />} />
          <Route path="protocols" element={<ProtocolDepartment />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="my-earnings" element={<MyEarningsPage />} />
          <Route path="material-orders" element={<MaterialOrdersPage />} />
          <Route path="vacations" element={<VacationPage />} />
          <Route path="vacations-admin" element={<AdminVacationPage />} />
          <Route path="accommodations" element={<AccommodationsPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="debug" element={<BillingDebug />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="gnk-installation" element={<GnkInstallationForm />} />
          <Route path="vehicles" element={<VehicleManagement />} />
          <Route path="my-vehicle" element={<VehicleLogForm />} />
          <Route path="invoicing" element={<InvoicingPage />} />
          <Route path="company-settings" element={<CompanySettingsPage />} />
          <Route path="project-map" element={<ProjectMapPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
