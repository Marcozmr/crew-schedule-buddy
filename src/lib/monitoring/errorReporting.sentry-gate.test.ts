import { describe, it, expect, vi, beforeEach } from "vitest";

const captureException = vi.fn();

vi.mock("@sentry/react", () => ({
  init: vi.fn(),
  captureException,
  captureMessage: vi.fn(),
  withScope: (fn: (s: { setTag: () => void; setContext: () => void; setLevel: () => void }) => void) =>
    fn({ setTag: vi.fn(), setContext: vi.fn(), setLevel: vi.fn() }),
  setTag: vi.fn(),
  setUser: vi.fn(),
  setContext: vi.fn(),
}));

describe("errorReporting sem DSN (gate)", () => {
  beforeEach(() => {
    captureException.mockClear();
    vi.stubEnv("VITE_SENTRY_DSN", "");
    vi.resetModules();
  });

  it("reportUnexpectedError não chama captureException", async () => {
    const { reportUnexpectedError } = await import("./errorReporting");
    reportUnexpectedError(new Error("test"), { flow: "test_flow" });
    expect(captureException).not.toHaveBeenCalled();
  });
});
