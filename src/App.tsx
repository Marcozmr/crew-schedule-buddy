// @ts-nocheck
import React, { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, registerQueryClient } from "@/lib/auth-context";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { LaunchQueueHandler } from "@/components/roster/LaunchQueueHandler";
import { ThemeProvider } from "next-themes";
import { UserThemeSync } from "@/components/UserThemeSync";

// Eager-load auth pages (first paint)
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

// Lazy-load everything else
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DownloadRosterPage = lazy(() => import("./pages/DownloadRosterPage"));
const ConnectRosterPage = lazy(() => import("./pages/ConnectRosterPage"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const RegulationPage = lazy(() => import("./pages/RegulationPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const SalaryPage = lazy(() => import("./pages/SalaryPage"));
const PerDiemPage = lazy(() => import("./pages/PerDiemPage"));
const RestCalcPage = lazy(() => import("./pages/RestCalcPage"));
const DutyCalcPage = lazy(() => import("./pages/DutyCalcPage"));
const WeatherPage = lazy(() => import("./pages/WeatherPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const UploadPage = lazy(() => import("./pages/UploadPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const CorporateAuthCallbackPage = lazy(() => import("./pages/CorporateAuthCallbackPage"));
const ShareImportPlaceholderPage = lazy(() => import("./pages/ShareImportPlaceholderPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

registerQueryClient(queryClient);

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <Loading />;
  if (!session) return <Navigate to="/" replace />;

  return <>{children}</>;
}

const AppRoutes = () => (
  <Suspense fallback={<Loading />}>
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RouteErrorBoundary scope="Dashboard">
              <DashboardPage />
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/download-roster"
        element={
          <ProtectedRoute>
            <DownloadRosterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/conectar-escala"
        element={
          <ProtectedRoute>
            <ConnectRosterPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedule"
        element={
          <ProtectedRoute>
            <SchedulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SearchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/regulation"
        element={
          <ProtectedRoute>
            <RegulationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <DocumentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/salary"
        element={
          <ProtectedRoute>
            <SalaryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/perdiem"
        element={
          <ProtectedRoute>
            <PerDiemPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rest-calc"
        element={
          <ProtectedRoute>
            <RestCalcPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/duty-calc"
        element={
          <ProtectedRoute>
            <DutyCalcPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/weather"
        element={
          <ProtectedRoute>
            <WeatherPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/import-manual"
        element={
          <ProtectedRoute>
            <UploadPage />
          </ProtectedRoute>
        }
      />
      <Route path="/auth/corporate-callback" element={<CorporateAuthCallbackPage />} />
      <Route
        path="/share-import"
        element={
          <ProtectedRoute>
            <ShareImportPlaceholderPage />
          </ProtectedRoute>
        }
      />
      <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
      <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
      <Route path="/legal" element={<Navigate to="/legal/lgpd" replace />} />
      <Route path="/legal/:document" element={<LegalPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="escalax-theme" disableTransitionOnChange>
        <BrowserRouter>
          <AuthProvider>
            <UserThemeSync />
            <LaunchQueueHandler />
            <TooltipProvider>
              <Sonner />
              <PWAUpdatePrompt />
              <AppRoutes />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;