import { describe, it, expect } from "vitest";
import {
  AUTH_CALLBACK_PATH,
  AUTH_UPDATE_PASSWORD_PATH,
  getAuthCallbackUrl,
  getAuthUpdatePasswordUrl,
} from "./authRedirect";

describe("authRedirect", () => {
  it("expõe paths estáveis", () => {
    expect(AUTH_CALLBACK_PATH).toBe("/auth/callback");
    expect(AUTH_UPDATE_PASSWORD_PATH).toBe("/auth/update-password");
  });

  it("getAuthCallbackUrl concatena origin + path de callback", () => {
    const origin = window.location.origin;
    expect(getAuthCallbackUrl()).toBe(`${origin}${AUTH_CALLBACK_PATH}`);
  });

  it("getAuthUpdatePasswordUrl concatena origin + path de nova senha", () => {
    const origin = window.location.origin;
    expect(getAuthUpdatePasswordUrl()).toBe(`${origin}${AUTH_UPDATE_PASSWORD_PATH}`);
  });
});
