import { describe, expect, it } from "vitest";
import {
  decidePostSessionNavigation,
  detectFlowKind,
  getParam,
  mapAuthCallbackErrorToUserMessage,
  parseAuthUrlParts,
} from "./callbackParams";

describe("parseAuthUrlParts / getParam", () => {
  it("lê type=signup do hash", () => {
    const p = parseAuthUrlParts("#access_token=a&refresh_token=b&type=signup", "");
    expect(getParam(p, "type")).toBe("signup");
    expect(detectFlowKind(p)).toBe("signup");
  });

  it("lê type=recovery do hash", () => {
    const p = parseAuthUrlParts("#access_token=a&refresh_token=b&type=recovery", "");
    expect(detectFlowKind(p)).toBe("recovery");
  });

  it("detecta PKCE code na query", () => {
    const p = parseAuthUrlParts("", "?code=abc&state=x");
    expect(detectFlowKind(p)).toBe("pkce_code");
  });

  it("detecta erro no hash", () => {
    const p = parseAuthUrlParts("#error=access_denied&error_code=otp_expired", "");
    expect(detectFlowKind(p)).toBe("error");
  });

  it("query sobrepõe quando hash não tem chave (getParam: hash primeiro)", () => {
    const p = parseAuthUrlParts("", "?type=recovery");
    expect(getParam(p, "type")).toBe("recovery");
  });
});

describe("mapAuthCallbackErrorToUserMessage", () => {
  it("otp_expired", () => {
    const p = parseAuthUrlParts(
      "#error=access_denied&error_code=otp_expired&error_description=expired",
      "",
    );
    const m = mapAuthCallbackErrorToUserMessage(p);
    expect(m.title).toMatch(/expirado|Link/i);
  });

  it("access_denied", () => {
    const p = parseAuthUrlParts("#error=access_denied", "");
    const m = mapAuthCallbackErrorToUserMessage(p);
    expect(m.title).toBeTruthy();
  });
});

describe("decidePostSessionNavigation", () => {
  const parts = (hash: string, search = "") => parseAuthUrlParts(hash, search);

  it("erro no hash → action error", () => {
    const p = parts("#error=access_denied&error_code=otp_expired");
    const d = decidePostSessionNavigation({ parts: p, hasSession: false, typeFromParams: null });
    expect(d.action).toBe("error");
    if (d.action === "error") expect(d.error.title).toBeTruthy();
  });

  it("recovery sem sessão → erro amigável", () => {
    const p = parts("#type=recovery");
    const d = decidePostSessionNavigation({ parts: p, hasSession: false, typeFromParams: "recovery" });
    expect(d.action).toBe("error");
  });

  it("recovery com sessão → update password", () => {
    const p = parts("#type=recovery");
    const d = decidePostSessionNavigation({ parts: p, hasSession: true, typeFromParams: "recovery" });
    expect(d.action).toBe("goto_update_password");
  });

  it("signup com sessão → home flash", () => {
    const p = parts("#type=signup");
    const d = decidePostSessionNavigation({ parts: p, hasSession: true, typeFromParams: "signup" });
    expect(d.action).toBe("goto_home_flash");
    if (d.action === "goto_home_flash") expect(d.flash).toBe("email_confirmed");
  });

  it("magiclink com sessão → home", () => {
    const p = parts("#type=magiclink");
    const d = decidePostSessionNavigation({ parts: p, hasSession: true, typeFromParams: "magiclink" });
    expect(d.action).toBe("goto_home");
  });

  it("sem sessão e sem tipo especial → login needs signin", () => {
    const p = parts("");
    const d = decidePostSessionNavigation({ parts: p, hasSession: false, typeFromParams: null });
    expect(d.action).toBe("goto_login_needs_signin");
  });

  it("sessão sem type → home", () => {
    const p = parts("");
    const d = decidePostSessionNavigation({ parts: p, hasSession: true, typeFromParams: null });
    expect(d.action).toBe("goto_home");
  });
});
