import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UpdatePasswordPage from "./UpdatePasswordPage";

const navigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const mod = await importOriginal<typeof import("react-router-dom")>();
  return { ...mod, useNavigate: () => navigate };
});

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      getUser: authMocks.getUser,
      updateUser: authMocks.updateUser,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastMocks.success,
    error: toastMocks.error,
  },
}));

describe("UpdatePasswordPage", () => {
  beforeEach(() => {
    navigate.mockClear();
    authMocks.getSession.mockReset();
    authMocks.getUser.mockReset();
    authMocks.updateUser.mockReset();
    authMocks.getUser.mockResolvedValue({
      data: { user: { email: "user@example.com" } },
    });
    toastMocks.success.mockClear();
    toastMocks.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra loading e depois o formulário quando há sessão", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "t", user: { id: "u" } } },
    });

    render(
      <MemoryRouter>
        <UpdatePasswordPage />
      </MemoryRouter>,
    );

    expect(document.querySelector(".animate-spin")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Definir nova senha/i })).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Nova senha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirmar senha/i)).toBeInTheDocument();
  });

  it("sem sessão mostra mensagem amigável e links", async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <MemoryRouter>
        <UpdatePasswordPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Sessão inválida/i })).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Não foi possível confirmar a recuperação de senha/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Solicitar novo link/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("link", { name: /Ir para o login/i })).toHaveAttribute("href", "/login");
  });

  it("valida campos obrigatórios", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "t", user: { id: "u" } } },
    });

    render(
      <MemoryRouter>
        <UpdatePasswordPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Definir nova senha/i });

    fireEvent.click(screen.getByRole("button", { name: /Guardar nova senha/i }));

    await waitFor(() => {
      expect(screen.getByText(/Informe a nova senha/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Confirme a nova senha/i)).toBeInTheDocument();
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it("bloqueia senha curta", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "t", user: { id: "u" } } },
    });

    render(
      <MemoryRouter>
        <UpdatePasswordPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Definir nova senha/i });

    fireEvent.change(screen.getByLabelText(/Nova senha/i), { target: { value: "12345" } });
    fireEvent.change(screen.getByLabelText(/Confirmar senha/i), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar nova senha/i }));

    await waitFor(() => {
      expect(screen.getByText(/^A senha deve ter pelo menos/i)).toBeInTheDocument();
    });
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it("bloqueia confirmação diferente", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "t", user: { id: "u" } } },
    });

    render(
      <MemoryRouter>
        <UpdatePasswordPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Definir nova senha/i });

    fireEvent.change(screen.getByLabelText(/Nova senha/i), { target: { value: "senha123" } });
    fireEvent.change(screen.getByLabelText(/Confirmar senha/i), { target: { value: "outra456" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar nova senha/i }));

    await waitFor(() => {
      expect(screen.getByText(/As senhas não coincidem/i)).toBeInTheDocument();
    });
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it(
    "chama updateUser com senha válida e redireciona após sucesso",
    async () => {
      authMocks.getSession.mockResolvedValue({
        data: { session: { access_token: "t", user: { id: "u" } } },
      });
      authMocks.updateUser.mockResolvedValue({ data: { user: null }, error: null });

      render(
        <MemoryRouter>
          <UpdatePasswordPage />
        </MemoryRouter>,
      );

      await screen.findByRole("heading", { name: /Definir nova senha/i });

      fireEvent.change(screen.getByLabelText(/Nova senha/i), { target: { value: "NovaSenha1!" } });
      fireEvent.change(screen.getByLabelText(/Confirmar senha/i), { target: { value: "NovaSenha1!" } });
      fireEvent.click(screen.getByRole("button", { name: /Guardar nova senha/i }));

      await waitFor(() => {
        expect(authMocks.updateUser).toHaveBeenCalledWith({ password: "NovaSenha1!" });
      });
      expect(toastMocks.success).toHaveBeenCalledWith("Senha atualizada com sucesso.");

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Senha atualizada/i })).toBeInTheDocument();
      });

      await waitFor(
        () => {
          expect(navigate).toHaveBeenCalledWith("/home", { replace: true });
        },
        { timeout: 3000 },
      );
    },
    3000,
  );

  it("toast de erro em português quando updateUser falha (sessão inválida)", async () => {
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "t", user: { id: "u" } } },
    });
    authMocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth session missing", code: "session_not_found" },
    });

    render(
      <MemoryRouter>
        <UpdatePasswordPage />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Definir nova senha/i });

    fireEvent.change(screen.getByLabelText(/Nova senha/i), { target: { value: "NovaSenha1!" } });
    fireEvent.change(screen.getByLabelText(/Confirmar senha/i), { target: { value: "NovaSenha1!" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar nova senha/i }));

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalled();
    });
    const msg = toastMocks.error.mock.calls[0][0] as string;
    expect(msg).toMatch(/Sessão inválida|expirada/i);
    expect(msg).not.toMatch(/session_not_found/i);
  });
});
