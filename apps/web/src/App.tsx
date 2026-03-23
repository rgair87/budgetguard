import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Chat from './pages/Chat';
import CutThis from './pages/CutThis';
import DebtPayoff from './pages/DebtPayoff';
import CsvUpload from './pages/CsvUpload';
import Calendar from './pages/Calendar';
import Subscriptions from './pages/Subscriptions';
import Settings from './pages/Settings';
import Advisor from './pages/Advisor';
import Transactions from './pages/Transactions';
import Goals from './pages/Goals';
import Trends from './pages/Trends';
import Negotiate from './pages/Negotiate';
import Predictions from './pages/Predictions';
import Simulator from './pages/Simulator';
import Family from './pages/Family';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;
  if (!token) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
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
        <Route path="trends" element={<Trends />} />
        <Route path="negotiate" element={<Negotiate />} />
        <Route path="predictions" element={<Predictions />} />
        <Route path="simulator" element={<Simulator />} />
        <Route path="family" element={<Family />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
