import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ForgotPasswordPage, { FORGOT_PASSWORD_SUCCESS_COPY } from "./ForgotPasswordPage";

const resetPasswordForEmail = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args),
    },
  },
}));

vi.mock("@/lib/auth/authRateLimitClient", () => ({
  assertAuthRateLimitAllowed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/monitoring/errorReporting", () => ({
  reportAuthFlowFailure: vi.fn(),
  reportOperationalEvent: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
  getRateLimitMessage: () => "Aguarde antes de tentar novamente.",
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: toastMocks.success,
    error: toastMocks.error,
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) => (
      <div {...rest}>{children}</div>
    ),
  },
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    resetPasswordForEmail.mockReset();
    toastMocks.success.mockClear();
    toastMocks.error.mockClear();
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("chama resetPasswordForEmail com redirect para /auth/callback", async () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    });

    const [email, opts] = resetPasswordForEmail.mock.calls[0] as [
      string,
      { redirectTo: string },
    ];
    expect(email).toBe("user@example.com");
    expect(opts.redirectTo).toMatch(/\/auth\/callback$/);
  });

  it("mostra mensagem neutra após sucesso (sem prometer email enviado)", async () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "any@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: FORGOT_PASSWORD_SUCCESS_COPY.title })).toBeInTheDocument();
    });
    expect(screen.getByText(/Se existir uma conta com este endereço/i)).toBeInTheDocument();
    expect(toastMocks.success).toHaveBeenCalledWith(FORGOT_PASSWORD_SUCCESS_COPY.body);
  });

  it("link Voltar ao login aponta para /login e tem classes de contraste (glass)", async () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "u@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /voltar ao login/i })).toBeInTheDocument();
    });

    const back = screen.getByRole("link", { name: /voltar ao login/i });
    expect(back).toHaveAttribute("href", "/login");
    expect(back.className).toMatch(/border-white/);
  });

  it("em erro da API mostra toast de erro e não estado de sucesso", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { message: "fail", code: "unexpected_failure", name: "AuthApiError" },
    });

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "u@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar link de recuperação/i }));

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalled();
    });
    expect(screen.queryByRole("heading", { name: FORGOT_PASSWORD_SUCCESS_COPY.title })).not.toBeInTheDocument();
  });
});
