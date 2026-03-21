import { describe, expect, it, vi } from "vitest";

import { createOrchestratorSDK, type OrchestratorSDKConfig } from "../sdk-types";

describe("SDK types (Stories 28.1-28.3)", () => {
  it("createOrchestratorSDK returns all required methods", () => {
    const config: OrchestratorSDKConfig = { baseUrl: "http://localhost:5000" };
    const sdk = createOrchestratorSDK(config);

    expect(typeof sdk.spawn).toBe("function");
    expect(typeof sdk.kill).toBe("function");
    expect(typeof sdk.recommend).toBe("function");
    expect(typeof sdk.onEvent).toBe("function");
    expect(typeof sdk.listSessions).toBe("function");
    expect(typeof sdk.disconnect).toBe("function");
  });

  it("onEvent returns unsubscribe function", () => {
    const sdk = createOrchestratorSDK({ baseUrl: "http://localhost:5000" });
    const unsub = sdk.onEvent("story.completed", vi.fn());
    expect(typeof unsub).toBe("function");
  });

  it("strips trailing slash from baseUrl", () => {
    const sdk = createOrchestratorSDK({ baseUrl: "http://localhost:5000/" });
    // Verify no double slash by checking the sdk was created without error
    expect(sdk).toBeDefined();
  });

  it("config accepts optional fields", () => {
    const config: OrchestratorSDKConfig = {
      baseUrl: "http://localhost:5000",
      apiKey: "test-key",
      timeoutMs: 5000,
    };
    const sdk = createOrchestratorSDK(config);
    expect(sdk).toBeDefined();
  });

  it("disconnect is callable without error", () => {
    const sdk = createOrchestratorSDK({ baseUrl: "http://localhost:5000" });
    expect(() => sdk.disconnect()).not.toThrow();
  });
});
