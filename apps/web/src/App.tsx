import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { SkeletonCard } from './components/Skeleton';

// Eager: hot paths loaded immediately
import Landing from './pages/Landing';
import Login from './pages/Login';
import Home from './pages/Home';
import Chat from './pages/Chat';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Pricing from './pages/Pricing';

// Lazy: loaded on demand
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const CutThis = lazy(() => import('./pages/CutThis'));
const DebtPayoff = lazy(() => import('./pages/DebtPayoff'));
const CsvUpload = lazy(() => import('./pages/CsvUpload'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Advisor = lazy(() => import('./pages/Advisor'));
const Goals = lazy(() => import('./pages/Goals'));
const Trends = lazy(() => import('./pages/Trends'));
const Negotiate = lazy(() => import('./pages/Negotiate'));
const Predictions = lazy(() => import('./pages/Predictions'));
const Simulator = lazy(() => import('./pages/Simulator'));
const Family = lazy(() => import('./pages/Family'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Budgets = lazy(() => import('./pages/Budgets'));
const BudgetWizard = lazy(() => import('./pages/BudgetWizard'));
const NotFound = lazy(() => import('./pages/NotFound'));

function LazyFallback() {
  return <div className="p-4"><SkeletonCard lines={8} /></div>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  if (!token) return <Navigate to="/" />;
  return <>{children}</>;
}

function LandingOrApp() {
  const { token, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  if (!token) return <Landing />;
  return <ProtectedRoute><Layout /></ProtectedRoute>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route
          path="/"
          element={<LandingOrApp />}
        >
          <Route index element={<Home />} />
          <Route path="advisor" element={<Advisor />} />
          <Route path="onboarding" element={<Onboarding />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="events" element={<Navigate to="/calendar" replace />} />
          <Route path="chat" element={<Chat />} />
          <Route path="cut-this" element={<CutThis />} />
          <Route path="debt" element={<DebtPayoff />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="csv-upload" element={<CsvUpload />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="goals" element={<Goals />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="budget-wizard" element={<BudgetWizard />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="trends" element={<Trends />} />
          <Route path="negotiate" element={<Negotiate />} />
          <Route path="predictions" element={<Predictions />} />
          <Route path="simulator" element={<Simulator />} />
          <Route path="family" element={<Family />} />
          <Route path="settings" element={<Settings />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
