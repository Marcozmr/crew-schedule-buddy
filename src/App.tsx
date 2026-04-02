import React, { lazy, Suspense, useEffect } from "react";
import { clearRecoverySessionFlag } from "@/lib/app-recovery/appRecoveryManager";
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
import { SentryRuntimeContext } from "@/lib/monitoring/SentryRuntimeContext";

// Eager-load auth pages (first paint)
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import UpdatePasswordPage from "./pages/UpdatePasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import { AuthFlashToast } from "./components/AuthFlashToast";

// Lazy-load everything else
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ProBoardPage = lazy(() => import("./pages/ProBoardPage"));
const MyRosterPage = lazy(() => import("./pages/MyRosterPage"));
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

/** Log de router após BrowserRouter montar (evita referência órfã — BootTrace tem de existir). */
function BootTrace() {
  useEffect(() => {
    console.log("[EscalaX boot] router init ok");
  }, []);
  return null;
}

/** Guard usado nas rotas autenticadas — exportado para testes de integração. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, user, loading, emailConfirmed } = useAuth();

  if (loading) return <Loading />;
  if (!session || !user) return <Navigate to="/login" replace />;
  if (!emailConfirmed) {
    return <Navigate to="/verify-email" replace state={{ email: user.email ?? undefined }} />;
  }

  return <>{children}</>;
}

/** Árvore de rotas (Suspense + Routes) — exportada para testes com MemoryRouter. */
export function AppRoutes() {
  return (
  <Suspense fallback={<Loading />}>
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
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
        path="/pro-board"
        element={
          <ProtectedRoute>
            <RouteErrorBoundary scope="Pro Board">
              <ProBoardPage />
            </RouteErrorBoundary>
          </ProtectedRoute>
        }
      />
      <Route
        path="/minha-escala"
        element={
          <ProtectedRoute>
            <RouteErrorBoundary scope="Minha escala">
              <MyRosterPage />
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
}

/**
 * Conteúdo dentro do Router (Browser ou Memory): auth + UI principal.
 * Permite testes de integração com `MemoryRouter` sem duplicar rotas.
 */
export function AppAuthShell() {
  return (
    <>
      <BootTrace />
      <AuthProvider>
        <SentryRuntimeContext />
        <UserThemeSync />
        <LaunchQueueHandler />
        <TooltipProvider>
          <Sonner />
          <PWAUpdatePrompt />
          <div className="min-h-dvh w-full min-w-0 bg-background">
            <AuthFlashToast />
            <AppRoutes />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </>
  );
}

const App = () => {
  useEffect(() => {
    clearRecoverySessionFlag();
    console.log("[EscalaX boot] app mount ok");
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="escalax-theme" disableTransitionOnChange>
        <BrowserRouter>
          <AppAuthShell />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;