import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, roleHome } from './app/auth-context';
import { Spinner } from './components/ui';
import type { Role } from './types';
import ProtectedLayout from './layouts/protected-layout';

const LoginPage = lazy(() => import('./pages/login-page'));
const DashboardPage = lazy(() => import('./pages/dashboard-page'));
const PatientsPage = lazy(() => import('./modules/reception/patients-page'));
const TokensPage = lazy(() => import('./modules/reception/tokens-page'));
const PatientDetailPage = lazy(() => import('./modules/reception/patient-detail-page'));
const DoctorQueuePage = lazy(() => import('./modules/doctor/queue-page'));
const ConsultationPage = lazy(() => import('./modules/doctor/consultation-page'));
const PrescriptionsPage = lazy(() => import('./modules/doctor/prescriptions-page'));
const MedicinesPage = lazy(() => import('./modules/pharmacy/medicines-page'));
const SuppliersPage = lazy(() => import('./modules/pharmacy/suppliers-page'));
const PurchasesPage = lazy(() => import('./modules/pharmacy/purchases-page'));
const StockPage = lazy(() => import('./modules/pharmacy/stock-page'));
const PharmacyBillsPage = lazy(() => import('./modules/pharmacy/bills-page'));
const CatalogPage = lazy(() => import('./modules/procedures/catalog-page'));
const PlansPage = lazy(() => import('./modules/procedures/plans-page'));
const SessionsPage = lazy(() => import('./modules/procedures/sessions-page'));
const DaybookPage = lazy(() => import('./modules/accounts/daybook-page'));
const ExpensesPage = lazy(() => import('./modules/accounts/expenses-page'));
const ReportsPage = lazy(() => import('./modules/accounts/reports-page'));
const UsersPage = lazy(() => import('./modules/administration/users-page'));
const SettingsPage = lazy(() => import('./modules/administration/settings-page'));
const AuditPage = lazy(() => import('./modules/administration/audit-page'));
const ProfilePage = lazy(() => import('./pages/profile-page'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role && user.role !== 'admin') {
    return <Navigate to={roleHome(user.role)} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner label="Loading page…" />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout />}>
        {/* Role dashboards */}
        <Route path="/admin/dashboard" element={<RequireRole role="admin"><DashboardPage /></RequireRole>} />
        <Route path="/reception/dashboard" element={<RequireRole role="receptionist"><DashboardPage /></RequireRole>} />
        <Route path="/doctor/dashboard" element={<RequireRole role="doctor"><DashboardPage /></RequireRole>} />
        <Route path="/pharmacy/dashboard" element={<RequireRole role="pharmacist"><DashboardPage /></RequireRole>} />
        <Route path="/therapist/dashboard" element={<RequireRole role="therapist"><DashboardPage /></RequireRole>} />
        <Route path="/accounts/dashboard" element={<RequireRole role="accountant"><DashboardPage /></RequireRole>} />

        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />

        {/* Reception */}
        <Route path="/reception/patients" element={<RequireRole role="receptionist"><PatientsPage /></RequireRole>} />
        <Route path="/reception/patients/:id" element={<RequireRole role="receptionist"><PatientDetailPage /></RequireRole>} />
        <Route path="/reception/tokens" element={<RequireRole role="receptionist"><TokensPage /></RequireRole>} />
        <Route path="/admin/patients" element={<RequireRole role="admin"><PatientsPage /></RequireRole>} />
        <Route path="/admin/patients/:id" element={<RequireRole role="admin"><PatientDetailPage /></RequireRole>} />
        <Route path="/admin/tokens" element={<RequireRole role="admin"><TokensPage /></RequireRole>} />

        {/* Doctor */}
        <Route path="/doctor/queue" element={<RequireRole role="doctor"><DoctorQueuePage /></RequireRole>} />
        <Route path="/doctor/visits" element={<RequireRole role="doctor"><PrescriptionsPage /></RequireRole>} />
        <Route path="/doctor/visits/:visitId/consultation" element={<RequireRole role="doctor"><ConsultationPage /></RequireRole>} />
        <Route path="/admin/doctor/queue" element={<RequireRole role="admin"><DoctorQueuePage /></RequireRole>} />
        <Route path="/admin/doctor/visits/:visitId/consultation" element={<RequireRole role="admin"><ConsultationPage /></RequireRole>} />

        {/* Pharmacy */}
        <Route path="/pharmacy/medicines" element={<RequireRole role="pharmacist"><MedicinesPage /></RequireRole>} />
        <Route path="/pharmacy/suppliers" element={<RequireRole role="pharmacist"><SuppliersPage /></RequireRole>} />
        <Route path="/pharmacy/purchases" element={<RequireRole role="pharmacist"><PurchasesPage /></RequireRole>} />
        <Route path="/pharmacy/stock" element={<RequireRole role="pharmacist"><StockPage /></RequireRole>} />
        <Route path="/pharmacy/bills" element={<RequireRole role="pharmacist"><PharmacyBillsPage /></RequireRole>} />
        <Route path="/admin/pharmacy/medicines" element={<RequireRole role="admin"><MedicinesPage /></RequireRole>} />
        <Route path="/admin/pharmacy/suppliers" element={<RequireRole role="admin"><SuppliersPage /></RequireRole>} />
        <Route path="/admin/pharmacy/purchases" element={<RequireRole role="admin"><PurchasesPage /></RequireRole>} />
        <Route path="/admin/pharmacy/stock" element={<RequireRole role="admin"><StockPage /></RequireRole>} />
        <Route path="/admin/pharmacy/bills" element={<RequireRole role="admin"><PharmacyBillsPage /></RequireRole>} />

        {/* Procedures */}
        <Route path="/admin/procedures/catalog" element={<RequireRole role="admin"><CatalogPage /></RequireRole>} />
        <Route path="/admin/procedures/plans" element={<RequireRole role="admin"><PlansPage /></RequireRole>} />
        <Route path="/admin/procedures/sessions" element={<RequireRole role="admin"><SessionsPage /></RequireRole>} />
        <Route path="/doctor/procedures/catalog" element={<RequireRole role="doctor"><CatalogPage readOnly /></RequireRole>} />
        <Route path="/therapist/plans" element={<RequireRole role="therapist"><PlansPage /></RequireRole>} />
        <Route path="/doctor/plans" element={<RequireRole role="doctor"><PlansPage /></RequireRole>} />
        <Route path="/therapist/sessions" element={<RequireRole role="therapist"><SessionsPage /></RequireRole>} />
        <Route path="/doctor/sessions" element={<RequireRole role="doctor"><SessionsPage /></RequireRole>} />

        {/* Accounts */}
        <Route path="/accounts/daybook" element={<RequireRole role="accountant"><DaybookPage /></RequireRole>} />
        <Route path="/accounts/expenses" element={<RequireRole role="accountant"><ExpensesPage /></RequireRole>} />
        <Route path="/accounts/reports" element={<RequireRole role="accountant"><ReportsPage /></RequireRole>} />
        <Route path="/admin/accounts/reports" element={<RequireRole role="admin"><ReportsPage /></RequireRole>} />
        <Route path="/admin/accounts/daybook" element={<RequireRole role="admin"><DaybookPage /></RequireRole>} />
        <Route path="/admin/accounts/expenses" element={<RequireRole role="admin"><ExpensesPage /></RequireRole>} />

        {/* Administration */}
        <Route path="/admin/users" element={<RequireRole role="admin"><UsersPage /></RequireRole>} />
        <Route path="/admin/settings" element={<RequireRole role="admin"><SettingsPage /></RequireRole>} />
        <Route path="/admin/audit" element={<RequireRole role="admin"><AuditPage /></RequireRole>} />
      </Route>

      {/* Fallbacks */}
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Starting…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}
