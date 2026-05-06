import type { HealthCheckResult } from "@templatical/types";
import type { AuthManager } from "./auth";
import { API_ROUTES } from "./url-builder";

interface HealthCheckOptions {
  authManager?: AuthManager;
  baseUrl?: string;
}

const WS_HANDSHAKE_TIMEOUT = 5000;

function resolveHealthUrl(options: HealthCheckOptions): string {
  if (options.authManager) {
    return options.authManager.resolveUrl(API_ROUTES.health);
  }

  const base = (options.baseUrl ?? "https://templatical.com").replace(
    /\/$/,
    "",
  );
  return `${base}${API_ROUTES.health}`;
}

async function checkApiAndAuth(
  url: string,
  authManager?: AuthManager,
): Promise<{
  api: { ok: boolean; latency: number };
  auth: { ok: boolean; error?: string };
  wsConfig?: { host: string; port: number; app_key: string };
}> {
  const start = performance.now();

  try {
    const response = authManager
      ? await authManager.authenticatedFetch(API_ROUTES.health, {
          method: "GET",
          headers: { Accept: "application/json" },
        })
      : await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

    const latency = Math.round(performance.now() - start);

    if (response.status === 401) {
      return {
        api: { ok: true, latency },
        auth: { ok: false, error: "HTTP 401" },
      };
    }

    if (!response.ok) {
      return {
        api: { ok: false, latency },
        auth: {
          ok: !authManager,
          error: authManager ? `HTTP ${response.status}` : undefined,
        },
      };
    }

    const data = await response.json();

    return {
      api: { ok: data.status === "ok", latency },
      auth: { ok: true },
      wsConfig: data.websocket,
    };
  } catch (error) {
    const latency = Math.round(performance.now() - start);

    return {
      api: { ok: false, latency },
      auth: {
        ok: !authManager,
        error: authManager
          ? error instanceof Error
            ? error.message
            : "Authentication check failed"
          : undefined,
      },
    };
  }
}

async function checkWebSocket(wsConfig?: {
  host: string;
  port: number;
  app_key: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!wsConfig?.host || !wsConfig?.app_key) {
    return { ok: false, error: "WebSocket configuration not available" };
  }

  if (typeof WebSocket === "undefined") {
    return {
      ok: false,
      error: "WebSocket not supported in this environment",
    };
  }

  const protocol = wsConfig.port === 443 ? "wss" : "ws";
  const url = `${protocol}://${wsConfig.host}:${wsConfig.port}/app/${wsConfig.app_key}?protocol=7&client=js&version=8.4.0-rc2&flash=false`;

  return new Promise((resolve) => {
    let ws: WebSocket | null = null;

    const timeout = setTimeout(() => {
      ws?.close();
      resolve({ ok: false, error: "WebSocket connection timed out" });
    }, WS_HANDSHAKE_TIMEOUT);

    try {
      ws = new WebSocket(url);
    } catch (error) {
      // Some browsers throw synchronously from `new WebSocket(...)`
      // (e.g. SecurityError on mixed content, InvalidAccessError on
      // malformed URL). Without this catch the queued timeout would
      // later access `ws` in TDZ and the outer promise would hang.
      clearTimeout(timeout);
      resolve({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "WebSocket connection failed",
      });
      return;
    }

    ws.onopen = () => {
      clearTimeout(timeout);
      ws?.close();
      resolve({ ok: true });
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve({ ok: false, error: "WebSocket connection failed" });
    };
  });
}

export async function performHealthCheck(
  options: HealthCheckOptions = {},
): Promise<HealthCheckResult> {
  const healthUrl = resolveHealthUrl(options);

  const result = await checkApiAndAuth(healthUrl, options.authManager);
  const wsResult = await checkWebSocket(result.wsConfig);

  return {
    api: result.api,
    websocket: wsResult,
    auth: result.auth,
    overall: result.api.ok && result.auth.ok,
  };
}
