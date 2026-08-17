import type {
  ApiError,
  ApiResponse,
  CommentResponse,
  CustomFont,
  PlanConfig,
  SavedBlock,
  Template,
  TemplateContent,
  TemplatePatch,
  TemplateVersionResponse,
} from "@templatical/types";
import { SdkError } from "@templatical/types";
import type { Block } from "@templatical/types";
import type { AuthManager } from "./auth";
import { API_ROUTES, buildUrl } from "./url-builder";

export class ApiClient {
  constructor(private readonly authManager: AuthManager) {}

  private get projectId(): string {
    return this.authManager.projectId;
  }

  private get tenantSlug(): string {
    return this.authManager.tenantSlug;
  }

  private get baseParams(): Record<string, string> {
    return { project: this.projectId, tenant: this.tenantSlug };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await this.authManager.authenticatedFetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error ${response.status}`,
      }));

      const errorMessage = this.extractFirstValidationError(error);
      throw new SdkError(errorMessage, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const json: ApiResponse<T> = await response.json();
    return json.data;
  }

  private extractFirstValidationError(error: ApiError): string {
    if (error.errors) {
      const firstField = Object.keys(error.errors)[0];
      if (firstField && error.errors[firstField]?.length > 0) {
        return error.errors[firstField][0];
      }
    }
    return error.message;
  }

  async createTemplate(
    content: TemplateContent,
    name?: string,
  ): Promise<Template> {
    return this.request<Template>(
      buildUrl(API_ROUTES["templates.store"], this.baseParams),
      {
        method: "POST",
        // `name` is forwarded only when set. Cloud's backend does not store it
        // yet; until it does the key is simply ignored, and an absent name reads
        // as "unnamed" rather than as an explicit null — the same
        // forward-compatible treatment `category` gets on saved blocks.
        body: JSON.stringify(
          name !== undefined ? { content, name } : { content },
        ),
      },
    );
  }

  async getTemplate(id: string): Promise<Template> {
    return this.request<Template>(
      buildUrl(API_ROUTES["templates.show"], {
        ...this.baseParams,
        template: id,
      }),
    );
  }

  /**
   * Apply a partial update. Takes a patch rather than bare content so a rename
   * can travel without content and vice versa — the shape `TemplatePatch`
   * defines, which is what `createCloudTemplatesProvider` forwards verbatim. Only
   * the keys present are sent.
   */
  async updateTemplate(id: string, patch: TemplatePatch): Promise<Template> {
    return this.request<Template>(
      buildUrl(API_ROUTES["templates.update"], {
        ...this.baseParams,
        template: id,
      }),
      {
        method: "PUT",
        body: JSON.stringify(patch),
      },
    );
  }

  async createVersion(
    templateId: string,
    content: TemplateContent,
    label?: string,
  ): Promise<TemplateVersionResponse> {
    return this.request<TemplateVersionResponse>(
      buildUrl(API_ROUTES["versions.store"], {
        ...this.baseParams,
        template: templateId,
      }),
      {
        method: "POST",
        body: JSON.stringify(
          label !== undefined ? { content, label } : { content },
        ),
      },
    );
  }

  async deleteTemplate(id: string): Promise<void> {
    return this.request<void>(
      buildUrl(API_ROUTES["templates.destroy"], {
        ...this.baseParams,
        template: id,
      }),
      {
        method: "DELETE",
      },
    );
  }

  async getVersions(templateId: string): Promise<TemplateVersionResponse[]> {
    return this.request<TemplateVersionResponse[]>(
      buildUrl(API_ROUTES["versions.index"], {
        ...this.baseParams,
        template: templateId,
      }),
    );
  }

  async getVersion(
    templateId: string,
    versionId: string,
  ): Promise<TemplateVersionResponse> {
    return this.request<TemplateVersionResponse>(
      buildUrl(API_ROUTES["versions.show"], {
        ...this.baseParams,
        template: templateId,
        version: versionId,
      }),
    );
  }

  async restoreVersion(
    templateId: string,
    versionId: string,
  ): Promise<Template> {
    return this.request<Template>(
      buildUrl(API_ROUTES["versions.restore"], {
        ...this.baseParams,
        template: templateId,
        version: versionId,
      }),
      {
        method: "POST",
      },
    );
  }

  async exportTemplate(
    templateId: string,
    fontsPayload?: {
      customFonts: CustomFont[];
      defaultFallback: string;
    },
  ): Promise<{ html: string; mjml: string }> {
    const body = fontsPayload
      ? JSON.stringify({
          custom_fonts: fontsPayload.customFonts,
          default_fallback: fontsPayload.defaultFallback,
        })
      : undefined;

    return this.request<{ html: string; mjml: string }>(
      buildUrl(API_ROUTES["templates.export"], {
        ...this.baseParams,
        template: templateId,
      }),
      {
        method: "POST",
        body,
      },
    );
  }

  async sendTestEmail(
    templateId: string,
    payload: {
      recipient: string;
      html: string;
      allowed_emails: string[];
      signature: string;
    },
  ): Promise<void> {
    await this.request<void>(
      buildUrl(API_ROUTES["templates.sendTestEmail"], {
        ...this.baseParams,
        template: templateId,
      }),
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  private commentsUrl(templateId: string, commentId?: string): string {
    if (commentId) {
      return buildUrl(API_ROUTES["comments.update"], {
        ...this.baseParams,
        template: templateId,
        comment: commentId,
      });
    }
    return buildUrl(API_ROUTES["comments.index"], {
      ...this.baseParams,
      template: templateId,
    });
  }

  async getComments(templateId: string): Promise<CommentResponse[]> {
    return this.request<CommentResponse[]>(this.commentsUrl(templateId));
  }

  async createComment(
    templateId: string,
    data: {
      body: string;
      block_id?: string;
      parent_id?: string;
      user_id: string;
      user_name: string;
      user_signature: string;
    },
    headers?: Record<string, string>,
  ): Promise<CommentResponse> {
    return this.request<CommentResponse>(this.commentsUrl(templateId), {
      method: "POST",
      body: JSON.stringify(data),
      headers,
    });
  }

  async updateComment(
    templateId: string,
    commentId: string,
    data: {
      body: string;
      user_id: string;
      user_name: string;
      user_signature: string;
    },
    headers?: Record<string, string>,
  ): Promise<CommentResponse> {
    return this.request<CommentResponse>(
      this.commentsUrl(templateId, commentId),
      {
        method: "PUT",
        body: JSON.stringify(data),
        headers,
      },
    );
  }

  async deleteComment(
    templateId: string,
    commentId: string,
    data: {
      user_id: string;
      user_name: string;
      user_signature: string;
    },
    headers?: Record<string, string>,
  ): Promise<void> {
    return this.request<void>(this.commentsUrl(templateId, commentId), {
      method: "DELETE",
      body: JSON.stringify(data),
      headers,
    });
  }

  async resolveComment(
    templateId: string,
    commentId: string,
    data: {
      user_id: string;
      user_name: string;
      user_signature: string;
    },
    headers?: Record<string, string>,
  ): Promise<CommentResponse> {
    return this.request<CommentResponse>(
      buildUrl(API_ROUTES["comments.resolve"], {
        ...this.baseParams,
        template: templateId,
        comment: commentId,
      }),
      {
        method: "POST",
        body: JSON.stringify(data),
        headers,
      },
    );
  }

  async fetchConfig(): Promise<PlanConfig> {
    return this.request<PlanConfig>(
      buildUrl(API_ROUTES["projects.config"], this.baseParams),
    );
  }

  async listModules(search?: string, category?: string): Promise<SavedBlock[]> {
    const url = buildUrl(API_ROUTES["savedModules.index"], this.baseParams);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    const query = params.size > 0 ? `?${params}` : "";
    return this.request<SavedBlock[]>(`${url}${query}`);
  }

  async createModule(data: {
    name: string;
    content: Block[];
    category?: string;
  }): Promise<SavedBlock> {
    return this.request<SavedBlock>(
      buildUrl(API_ROUTES["savedModules.store"], this.baseParams),
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async updateModule(
    id: string,
    data: Partial<{ name: string; content: Block[]; category: string }>,
  ): Promise<SavedBlock> {
    return this.request<SavedBlock>(
      buildUrl(API_ROUTES["savedModules.update"], {
        ...this.baseParams,
        savedModule: id,
      }),
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  }

  async deleteModule(id: string): Promise<void> {
    return this.request<void>(
      buildUrl(API_ROUTES["savedModules.destroy"], {
        ...this.baseParams,
        savedModule: id,
      }),
      {
        method: "DELETE",
      },
    );
  }
}
