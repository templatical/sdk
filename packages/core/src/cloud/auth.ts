import type {
  AuthConfig,
  AuthRequestOptions,
  SdkAuthConfig,
  TestEmailConfig,
  TokenData,
  UserConfig,
} from "@templatical/types";
import { SdkError } from "@templatical/types";

export type {
  AuthConfig,
  AuthRequestOptions,
  SdkAuthConfig,
  TestEmailConfig,
  UserConfig,
};

export class AuthManager {
  private static readonly DEFAULT_BASE_URL = "https://templatical.com";

  private accessToken: string | null = null;
  private expiresAt: Date | null = null;
  private _projectId: string | null = null;
  private _tenantId: string | null = null;
  private _tenantSlug: string | null = null;
  private _testEmailConfig: TestEmailConfig | null = null;
  private _userConfig: UserConfig | null = null;
  private readonly url: string;
  private readonly baseUrl: string;
  private readonly requestOptions: AuthRequestOptions;
  private readonly onError?: (error: Error) => void;
  private refreshPromise: Promise<string> | null = null;

  private static readonly REFRESH_THRESHOLD_MS = 60 * 1000;

  constructor(config: AuthConfig) {
    this.url = config.url;
    this.baseUrl = (config.baseUrl ?? AuthManager.DEFAULT_BASE_URL).replace(
      /\/$/,
      "",
    );
    this.requestOptions = config.requestOptions ?? {};
    this.onError = config.onError;
  }

  resolveUrl(path: string): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  get projectId(): string {
    if (!this._projectId) {
      throw new Error("Project ID not available. Call initialize() first.");
    }
    return this._projectId;
  }

  get tenantId(): string {
    if (!this._tenantId) {
      throw new Error("Tenant ID not available. Call initialize() first.");
    }
    return this._tenantId;
  }

  get tenantSlug(): string {
    if (!this._tenantSlug) {
      throw new Error("Tenant slug not available. Call initialize() first.");
    }
    return this._tenantSlug;
  }

  get testEmailConfig(): TestEmailConfig | null {
    return this._testEmailConfig;
  }

  get userConfig(): UserConfig | null {
    return this._userConfig;
  }

  get accessTokenValue(): string | null {
    return this.accessToken;
  }

  async initialize(): Promise<void> {
    await this.ensureToken();
  }

  private async ensureToken(): Promise<string> {
    if (this.accessToken && !this.isTokenExpiringSoon()) {
      return this.accessToken;
    }
    return this.refreshToken();
  }

  private isTokenExpiringSoon(): boolean {
    if (!this.expiresAt) {
      return true;
    }
    const timeUntilExpiry = this.expiresAt.getTime() - Date.now();
    return timeUntilExpiry < AuthManager.REFRESH_THRESHOLD_MS;
  }

  async refreshToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(): Promise<string> {
    try {
      const method = this.requestOptions.method ?? "POST";
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...this.requestOptions.headers,
      };

      const fetchOptions: RequestInit = {
        method,
        headers,
        credentials: this.requestOptions.credentials ?? "include",
      };

      if (method === "POST" && this.requestOptions.body) {
        headers["Content-Type"] = "application/json";
        fetchOptions.body = JSON.stringify(this.requestOptions.body);
      }

      const response = await fetch(this.url, fetchOptions);

      if (!response.ok) {
        throw new SdkError(
          `Token refresh failed: ${response.status}`,
          response.status,
        );
      }

      const data: TokenData = await response.json();

      if (!data.token || !data.expires_at || !data.project_id || !data.tenant) {
        throw new Error(
          "Invalid token response: missing token, expires_at, project_id, or tenant",
        );
      }

      this.accessToken = data.token;
      this.expiresAt = new Date(data.expires_at * 1000);
      this._projectId = data.project_id;
      this._tenantSlug = data.tenant;

      if (data.test_email?.allowed_emails && data.test_email?.signature) {
        this._testEmailConfig = {
          allowedEmails: data.test_email.allowed_emails,
          signature: data.test_email.signature,
        };
      } else {
        this._testEmailConfig = null;
      }

      if (data.user?.id && data.user?.name && data.user?.signature) {
        this._userConfig = {
          id: data.user.id,
          name: data.user.name,
          signature: data.user.signature,
        };
      } else {
        this._userConfig = null;
      }

      return this.accessToken;
    } catch (error) {
      const wrappedError =
        error instanceof Error
          ? error
          : new Error("Token refresh failed", { cause: error });
      this.onError?.(wrappedError);
      throw wrappedError;
    }
  }

  async authenticatedFetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const token = await this.ensureToken();
    const resolvedUrl = this.resolveUrl(url);

    const makeRequest = async (authToken: string): Promise<Response> => {
      return fetch(resolvedUrl, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${authToken}`,
        },
      });
    };

    let response = await makeRequest(token);

    if (response.status === 401) {
      const newToken = await this.refreshToken();
      response = await makeRequest(newToken);
    }

    return response;
  }
}

export function createSdkAuthManager(
  config: SdkAuthConfig,
  onError?: (error: Error) => void,
): AuthManager {
  if (config.mode === "direct") {
    const baseUrl = (config.baseUrl ?? "https://templatical.com").replace(
      /\/$/,
      "",
    );

    return new AuthManager({
      url: `${baseUrl}/api/v1/auth/token`,
      baseUrl: config.baseUrl,
      requestOptions: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          tenant: config.tenant,
          client_type: "sdk",
        },
      },
      onError,
    });
  }

  return new AuthManager({
    url: config.url,
    baseUrl: config.baseUrl,
    requestOptions: config.requestOptions,
    onError,
  });
}
