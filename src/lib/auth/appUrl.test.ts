import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRODUCTION_APP_ORIGIN,
  getAppOrigin,
  getConfiguredAppOrigin,
  joinAppPath,
  normalizeAppOrigin,
} from "./appUrl";

describe("appUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizeAppOrigin aceita URL com ou sem scheme", () => {
    expect(normalizeAppOrigin("https://www.escalax.app.br/")).toBe(
      "https://www.escalax.app.br",
    );
    expect(normalizeAppOrigin("www.escalax.app.br")).toBe("https://www.escalax.app.br");
  });

  it("getConfiguredAppOrigin lê VITE_APP_URL", () => {
    vi.stubEnv("VITE_APP_URL", "https://www.escalax.app.br");
    expect(getConfiguredAppOrigin()).toBe("https://www.escalax.app.br");
  });

  it("getAppOrigin prioriza VITE_APP_URL sobre window", () => {
    vi.stubEnv("VITE_APP_URL", "https://www.escalax.app.br");
    expect(getAppOrigin()).toBe("https://www.escalax.app.br");
  });

  it("joinAppPath monta callback de produção", () => {
    vi.stubEnv("VITE_APP_URL", "https://www.escalax.app.br");
    expect(joinAppPath("/auth/callback")).toBe("https://www.escalax.app.br/auth/callback");
  });

  it("em DEV sem VITE_APP_URL usa window.location.origin", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_APP_URL", "");
    const origin = window.location.origin;
    expect(getAppOrigin()).toBe(origin);
  });

  it("fallback de produção sem window nem env", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_APP_URL", "");
    const originGetter = Object.getOwnPropertyDescriptor(window, "location");
    try {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: undefined,
      });
      expect(getAppOrigin()).toBe(DEFAULT_PRODUCTION_APP_ORIGIN);
    } finally {
      if (originGetter) {
        Object.defineProperty(window, "location", originGetter);
      }
    }
  });
});
