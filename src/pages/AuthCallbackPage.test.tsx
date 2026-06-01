import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuthCallbackPage from "./AuthCallbackPage";
import * as establishMod from "@/lib/auth/establishSession";
import type { Session } from "@supabase/supabase-js";
import { parseAuthUrlParts } from "@/lib/auth/callbackParams";

const navigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => navigate };
});

vi.mock("@/lib/auth/establishSession", () => ({
  establishSessionFromCurrentUrl: vi.fn(),
}));

describe("AuthCallbackPage", () => {
  const establish = vi.mocked(establishMod.establishSessionFromCurrentUrl);

  beforeEach(() => {
    navigate.mockClear();
    establish.mockReset();
    window.history.replaceState({}, "", "/auth/callback");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("mostra loading inicialmente", () => {
    establish.mockImplementation(() => new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/A concluir autenticação/i)).toBeInTheDocument();
  });

  it("processa erro no hash e mostra mensagem em português", async () => {
    window.history.replaceState({}, "", "/auth/callback#error=access_denied&error_code=otp_expired");
    establish.mockResolvedValue({
      ok: true,
      session: null,
      parts: parseAuthUrlParts("#error=access_denied&error_code=otp_expired", ""),
    });

    render(
      <MemoryRouter initialEntries={["/auth/callback#error=access_denied&error_code=otp_expired"]}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    expect(screen.getByText(/Ir para o login/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalledWith("/home", expect.anything());
  });

  it("recovery válido redireciona para update-password", async () => {
    const session = { access_token: "t" } as Session;
    establish.mockResolvedValue({
      ok: true,
      session,
      parts: parseAuthUrlParts("#access_token=a&refresh_token=b&type=recovery", ""),
    });

    render(
      <MemoryRouter initialEntries={["/auth/callback#..."]}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/auth/update-password", { replace: true });
    });
  });

  it("signup com sessão → home com flash", async () => {
    const session = { access_token: "t" } as Session;
    establish.mockResolvedValue({
      ok: true,
      session,
      parts: parseAuthUrlParts("#access_token=a&refresh_token=b&type=signup", ""),
    });

    render(
      <MemoryRouter>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/home", { replace: true });
    });
  });

  it("otp_expired no hash mostra título «Link expirado» em português", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/callback#error=access_denied&error_code=otp_expired&error_description=expired",
    );

    render(
      <MemoryRouter
        initialEntries={["/auth/callback#error=access_denied&error_code=otp_expired"]}
      >
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Link expirado/i })).toBeInTheDocument();
    });
    expect(
      screen.getByText(/validade limitada|não é mais válido/i),
    ).toBeInTheDocument();
    expect(establish).not.toHaveBeenCalled();
  });

  it("falha ao estabelecer sessão mostra mensagem formatada, não cru do Supabase", async () => {
    establish.mockResolvedValue({
      ok: false,
      parts: parseAuthUrlParts("", "?code=abc"),
      error: new Error("invalid request: code verifier"),
    });

    render(
      <MemoryRouter initialEntries={["/auth/callback?code=abc"]}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Não foi possível concluir/i })).toBeInTheDocument();
    });
    const body = screen.getByText(/Não foi possível concluir a operação|Tente novamente/i);
    expect(body).toBeInTheDocument();
    expect(screen.queryByText(/code verifier/i)).not.toBeInTheDocument();
  });

  it("recovery sem sessão mostra erro dedicado em português", async () => {
    window.history.replaceState({}, "", "/auth/callback#type=recovery");
    establish.mockResolvedValue({
      ok: true,
      session: null,
      parts: parseAuthUrlParts("#type=recovery", ""),
    });

    render(
      <MemoryRouter initialEntries={["/auth/callback#type=recovery"]}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Não foi possível redefinir a senha/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /Esqueci minha senha/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("URL vazia sem sessão redireciona para login com flash", async () => {
    establish.mockResolvedValue({
      ok: true,
      session: null,
      parts: parseAuthUrlParts("", ""),
    });

    render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });
});
