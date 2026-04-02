import { beforeEach, describe, expect, it, vi } from "vitest";

const { persistRemote, persistEnabled } = vi.hoisted(() => ({
  persistRemote: vi.fn().mockResolvedValue(undefined),
  persistEnabled: vi.fn(() => true),
}));

vi.mock("./persistAuthEvent", () => ({
  persistEnabled: () => persistEnabled(),
  persistAuthEventRemote: persistRemote,
}));

import { emitAuthEvent } from "./emitAuthEvent";

describe("emitAuthEvent", () => {
  beforeEach(() => {
    persistRemote.mockClear();
    persistRemote.mockResolvedValue(undefined);
    persistEnabled.mockReturnValue(true);
  });

  it("chama persist com nome e metadata sanitizada", () => {
    emitAuthEvent("login_failed", { code: "invalid_credentials" });
    expect(persistRemote).toHaveBeenCalledTimes(1);
    expect(persistRemote).toHaveBeenCalledWith({
      name: "login_failed",
      metadata: { code: "invalid_credentials" },
    });
  });

  it("não inclui chaves sensíveis na metadata persistida", () => {
    emitAuthEvent("login_failed", {
      code: "x",
      password: "secret",
      access_token: "t",
    });
    expect(persistRemote).toHaveBeenCalledWith({
      name: "login_failed",
      metadata: { code: "x" },
    });
  });

  it("não chama persist quando persistEnabled é false", () => {
    persistEnabled.mockReturnValue(false);
    emitAuthEvent("logout");
    expect(persistRemote).not.toHaveBeenCalled();
  });

  it("não propaga quando persist rejeita", async () => {
    persistRemote.mockRejectedValueOnce(new Error("network"));
    expect(() => emitAuthEvent("logout")).not.toThrow();
    await vi.waitFor(() => expect(persistRemote).toHaveBeenCalled());
  });
});
