import { afterEach, describe, it, expect, vi } from "vitest";
import {
  AUTH_CALLBACK_PATH,
  AUTH_UPDATE_PASSWORD_PATH,
  getAuthCallbackUrl,
  getAuthUpdatePasswordUrl,
} from "./authRedirect";

describe("authRedirect", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("expõe paths estáveis", () => {
    expect(AUTH_CALLBACK_PATH).toBe("/auth/callback");
    expect(AUTH_UPDATE_PASSWORD_PATH).toBe("/auth/update-password");
  });

  it("com VITE_APP_URL usa domínio oficial (não localhost)", () => {
    vi.stubEnv("VITE_APP_URL", "https://www.escalax.app.br");
    expect(getAuthCallbackUrl()).toBe("https://www.escalax.app.br/auth/callback");
    expect(getAuthUpdatePasswordUrl()).toBe(
      "https://www.escalax.app.br/auth/update-password",
    );
  });

  it("sem VITE_APP_URL concatena origin do browser + path", () => {
    vi.stubEnv("VITE_APP_URL", "");
    const origin = window.location.origin;
    expect(getAuthCallbackUrl()).toBe(`${origin}${AUTH_CALLBACK_PATH}`);
    expect(getAuthUpdatePasswordUrl()).toBe(`${origin}${AUTH_UPDATE_PASSWORD_PATH}`);
  });
});
