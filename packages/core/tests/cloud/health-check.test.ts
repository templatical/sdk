import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { performHealthCheck } from "../../src/cloud/health-check";
import type { AuthManager } from "../../src/cloud/auth";

function mockJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

function createMockAuthManager(overrides: Partial<AuthManager> = {}): AuthManager {
  return {
    projectId: "proj-1",
    tenantSlug: "acme",
    authenticatedFetch: vi.fn(),
    resolveUrl: vi.fn((path: string) => `https://api.test.com${path}`),
    ...overrides,
  } as unknown as AuthManager;
}

describe("performHealthCheck", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal(
      "WebSocket",
      class MockWebSocket {
        onopen: (() => void) | null = null;
        onerror: (() => void) | null = null;
        close = vi.fn();
        constructor() {
          // Auto-connect on next tick
          queueMicrotask(() => this.onopen?.());
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("API check", () => {
    it("reports api.ok when status is ok", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({ status: "ok", websocket: null }),
      );
      const result = await performHealthCheck();
      expect(result.api.ok).toBe(true);
      expect(result.auth.ok).toBe(true);
      expect(result.overall).toBe(true);
    });

    it("reports auth.ok false on 401", async () => {
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse({}, 401));
      const result = await performHealthCheck();
      expect(result.api.ok).toBe(true);
      expect(result.auth.ok).toBe(false);
      expect(result.auth.error).toBe("HTTP 401");
    });

    it("reports api.ok false on 500", async () => {
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse({}, 500));
      const result = await performHealthCheck();
      expect(result.api.ok).toBe(false);
    });

    it("reports api.ok false on network error", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network fail"));
      const result = await performHealthCheck();
      expect(result.api.ok).toBe(false);
    });

    it("measures latency", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({ status: "ok", websocket: null }),
      );
      const result = await performHealthCheck();
      expect(result.api.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe("with authManager", () => {
    it("uses authenticatedFetch instead of global fetch", async () => {
      const authManager = createMockAuthManager();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockJsonResponse({ status: "ok", websocket: null }),
      );
      await performHealthCheck({ authManager });
      expect(authManager.authenticatedFetch).toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("uses authManager.resolveUrl for URL", async () => {
      const authManager = createMockAuthManager();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockJsonResponse({ status: "ok", websocket: null }),
      );
      await performHealthCheck({ authManager });
      expect(authManager.resolveUrl).toHaveBeenCalled();
    });
  });

  describe("without authManager", () => {
    it("uses global fetch with default baseUrl", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({ status: "ok", websocket: null }),
      );
      await performHealthCheck();
      expect(fetch).toHaveBeenCalled();
      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain("templatical.com");
    });

    it("uses custom baseUrl and strips trailing slash", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({ status: "ok", websocket: null }),
      );
      await performHealthCheck({ baseUrl: "https://custom.io/" });
      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toMatch(/^https:\/\/custom\.io\/[^/]/);
    });
  });

  describe("WebSocket check", () => {
    it("reports ok when WebSocket connects", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({
          status: "ok",
          websocket: { host: "ws.test.com", port: 443, app_key: "key123" },
        }),
      );
      const result = await performHealthCheck();
      expect(result.websocket.ok).toBe(true);
    });

    it("reports error when WebSocket fails", async () => {
      vi.stubGlobal(
        "WebSocket",
        class {
          onopen: (() => void) | null = null;
          onerror: (() => void) | null = null;
          close = vi.fn();
          constructor() {
            queueMicrotask(() => this.onerror?.());
          }
        },
      );
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({
          status: "ok",
          websocket: { host: "ws.test.com", port: 443, app_key: "key123" },
        }),
      );
      const result = await performHealthCheck();
      expect(result.websocket.ok).toBe(false);
      expect(result.websocket.error).toBe("WebSocket connection failed");
    });

    it("reports timeout after 5 seconds", async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "WebSocket",
        class {
          onopen: (() => void) | null = null;
          onerror: (() => void) | null = null;
          close = vi.fn();
          // Never fires onopen or onerror
        },
      );
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({
          status: "ok",
          websocket: { host: "ws.test.com", port: 443, app_key: "key123" },
        }),
      );

      const promise = performHealthCheck();
      await vi.advanceTimersByTimeAsync(5000);
      const result = await promise;
      expect(result.websocket.ok).toBe(false);
      expect(result.websocket.error).toBe("WebSocket connection timed out");
      vi.useRealTimers();
    });

    it("reports error when wsConfig is missing", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({ status: "ok", websocket: null }),
      );
      const result = await performHealthCheck();
      expect(result.websocket.ok).toBe(false);
      expect(result.websocket.error).toBe(
        "WebSocket configuration not available",
      );
    });

    it("resolves when the WebSocket constructor throws synchronously", async () => {
      // Some browsers throw SecurityError or InvalidAccessError synchronously
      // from `new WebSocket(...)` (e.g. mixed-content or malformed URL). The
      // promise must still settle — currently the queued setTimeout fires 5s
      // later and accesses `ws` in TDZ → unhandled ReferenceError, leaving
      // the outer promise pending forever.
      vi.useFakeTimers();
      vi.stubGlobal(
        "WebSocket",
        class {
          constructor() {
            throw new Error("Insecure WebSocket connection blocked");
          }
        },
      );
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({
          status: "ok",
          websocket: { host: "ws.test.com", port: 443, app_key: "key123" },
        }),
      );

      const promise = performHealthCheck();
      // Advance past the 5s handshake timeout.
      await vi.advanceTimersByTimeAsync(6000);
      const result = await promise;

      expect(result.websocket.ok).toBe(false);
      vi.useRealTimers();
    });

    it("uses wss protocol for port 443", async () => {
      let capturedUrl = "";
      vi.stubGlobal(
        "WebSocket",
        class {
          onopen: (() => void) | null = null;
          onerror: (() => void) | null = null;
          close = vi.fn();
          constructor(url: string) {
            capturedUrl = url;
            queueMicrotask(() => this.onopen?.());
          }
        },
      );
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({
          status: "ok",
          websocket: { host: "ws.test.com", port: 443, app_key: "key123" },
        }),
      );
      await performHealthCheck();
      expect(capturedUrl).toMatch(/^wss:\/\//);
    });
  });
});
