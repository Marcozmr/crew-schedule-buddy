import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { Session } from "@supabase/supabase-js";
import { AppAuthShell } from "./App";
import { registerQueryClient } from "@/lib/auth-context";
import * as establishMod from "@/lib/auth/establishSession";
import { parseAuthUrlParts } from "@/lib/auth/callbackParams";
import { AUTH_FLASH_STORAGE_KEY } from "@/lib/auth/authFlash";
import { toast } from "sonner";

/** PWA usa `virtual:pwa-register/react`, indisponível no Vitest sem o plugin completo. */
vi.mock("@/components/PWAUpdatePrompt", () => ({
  PWAUpdatePrompt: () => null,
}));

vi.mock("@/lib/auth/establishSession", () => ({
  establishSessionFromCurrentUrl: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  refreshSession: vi.fn(),
  onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
    queueMicrotask(() => cb("INITIAL_SESSION", null));
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => supabaseMocks.getSession(...args),
      getUser: (...args: unknown[]) => supabaseMocks.getUser(...args),
      refreshSession: (...args: unknown[]) => supabaseMocks.refreshSession(...args),
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resend: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      updateUser: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      setSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      upsert: vi.fn(),
    })),
  },
}));

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return {
    ...actual,
    toast: {
      ...actual.toast,
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

const establish = vi.mocked(establishMod.establishSessionFromCurrentUrl);

function renderTestApp(initialEntries: string[]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  registerQueryClient(qc);

  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="escalax-theme-auth-integration-test"
        disableTransitionOnChange
      >
        <MemoryRouter initialEntries={initialEntries}>
          <AppAuthShell />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("App + MemoryRouter — fluxo de auth e guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    establish.mockReset();
    sessionStorage.removeItem(AUTH_FLASH_STORAGE_KEY);
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    supabaseMocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
    supabaseMocks.onAuthStateChange.mockImplementation((cb) => {
      queueMicrotask(() => cb("INITIAL_SESSION", null));
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    window.history.replaceState({}, "", `${window.location.origin}/`);
  });

  afterEach(() => {
    window.history.replaceState({}, "", `${window.location.origin}/`);
  });

  it("/auth/callback renderiza a página de callback (não cai no login)", async () => {
    window.history.replaceState({}, "", `${window.location.origin}/auth/callback`);
    establish.mockImplementation(() => new Promise(() => {}));

    renderTestApp(["/auth/callback"]);

    await waitFor(() => {
      expect(screen.getByText(/A concluir autenticação/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /^Entrar$/i })).not.toBeInTheDocument();
  });

  it("ProtectedRoute não intercepta /auth/callback — permanece em callback durante processamento", async () => {
    window.history.replaceState(
      {},
      "",
      `${window.location.origin}/auth/callback#access_token=a&refresh_token=b&type=recovery`,
    );
    establish.mockImplementation(() => new Promise(() => {}));

    renderTestApp(["/auth/callback#access_token=a&refresh_token=b&type=recovery"]);

    await waitFor(() => {
      expect(screen.getByText(/A concluir autenticação/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /^Entrar$/i })).not.toBeInTheDocument();
  });

  it("/auth/update-password renderiza sem exigir sessão via ProtectedRoute (sessão ausente → UI dedicada)", async () => {
    window.history.replaceState({}, "", `${window.location.origin}/auth/update-password`);

    renderTestApp(["/auth/update-password"]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Sessão inválida/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /^Entrar$/i })).not.toBeInTheDocument();
  });

  it("/auth/update-password com sessão mostra o formulário (rota não passa por ProtectedRoute)", async () => {
    window.history.replaceState({}, "", `${window.location.origin}/auth/update-password`);
    supabaseMocks.getSession.mockResolvedValue({
      data: {
        session: { access_token: "t", user: { id: "u1" } } as Session,
      },
    });

    renderTestApp(["/auth/update-password"]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Definir nova senha/i })).toBeInTheDocument();
    });
  });

  it("rota protegida /home sem sessão redireciona para login", async () => {
    window.history.replaceState({}, "", `${window.location.origin}/home`);

    renderTestApp(["/home"]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /^Entrar$/i })).toBeInTheDocument();
    });
  });

  it("após erro no hash do Supabase, a URL é limpa (sem reprocessar hash no refresh)", async () => {
    window.history.replaceState(
      {},
      "",
      `${window.location.origin}/auth/callback#error=access_denied&error_code=otp_expired`,
    );

    renderTestApp(["/auth/callback#error=access_denied&error_code=otp_expired"]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Link expirado/i })).toBeInTheDocument();
    });

    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/auth/callback");
  });

  it("recovery bem-sucedido: callback → update-password (listener não força login)", async () => {
    const session = { access_token: "tok", user: { id: "u1" } } as Session;
    window.history.replaceState(
      {},
      "",
      `${window.location.origin}/auth/callback#access_token=a&refresh_token=b&type=recovery`,
    );
    supabaseMocks.getSession.mockResolvedValue({ data: { session } });
    establish.mockResolvedValue({
      ok: true,
      session,
      parts: parseAuthUrlParts("#access_token=a&refresh_token=b&type=recovery", ""),
    });

    renderTestApp(["/auth/callback#access_token=a&refresh_token=b&type=recovery"]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Definir nova senha/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /^Entrar$/i })).not.toBeInTheDocument();
  });

  it("AuthFlashToast: email confirmado após flash sessionStorage", async () => {
    sessionStorage.setItem(AUTH_FLASH_STORAGE_KEY, "email_confirmed");
    window.history.replaceState({}, "", `${window.location.origin}/login`);

    renderTestApp(["/login"]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Email confirmado com sucesso.");
    });
  });

  it("AuthFlashToast: redefinição de senha (flash password_updated)", async () => {
    sessionStorage.setItem(AUTH_FLASH_STORAGE_KEY, "password_updated");
    window.history.replaceState({}, "", `${window.location.origin}/login`);

    renderTestApp(["/login"]);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Senha atualizada com sucesso.");
    });
  });
});
