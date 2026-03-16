import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, registerQueryClient } from "@/lib/auth-context";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import DownloadRosterPage from "./pages/DownloadRosterPage";
import SchedulePage from "./pages/SchedulePage";
import SearchPage from "./pages/SearchPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import RegulationPage from "./pages/RegulationPage";
import DocumentsPage from "./pages/DocumentsPage";
import SalaryPage from "./pages/SalaryPage";
import PerDiemPage from "./pages/PerDiemPage";
import FlightSwapPage from "./pages/FlightSwapPage";
import RestCalcPage from "./pages/RestCalcPage";
import DutyCalcPage from "./pages/DutyCalcPage";
import WeatherPage from "./pages/WeatherPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
registerQueryClient(queryClient);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<LoginPage />} />
    <Route path="/signup" element={<SignupPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="/download-roster" element={<ProtectedRoute><DownloadRosterPage /></ProtectedRoute>} />
    <Route path="/schedule" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
    <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
    <Route path="/regulation" element={<ProtectedRoute><RegulationPage /></ProtectedRoute>} />
    <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
    <Route path="/salary" element={<ProtectedRoute><SalaryPage /></ProtectedRoute>} />
    <Route path="/perdiem" element={<ProtectedRoute><PerDiemPage /></ProtectedRoute>} />
    <Route path="/flight-swap" element={<ProtectedRoute><FlightSwapPage /></ProtectedRoute>} />
    <Route path="/rest-calc" element={<ProtectedRoute><RestCalcPage /></ProtectedRoute>} />
    <Route path="/duty-calc" element={<ProtectedRoute><DutyCalcPage /></ProtectedRoute>} />
    <Route path="/weather" element={<ProtectedRoute><WeatherPage /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
