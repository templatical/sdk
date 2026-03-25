import type { AuthManager } from "./auth";
import { API_ROUTES, buildUrl } from "./url-builder";
import type { TemplateContent } from "@templatical/types";
import { ref } from "vue";

export interface UseDesignReferenceOptions {
  authManager: AuthManager;
  getTemplateId: () => string | null;
  onApply?: (content: TemplateContent) => void;
  onError?: (error: Error) => void;
}

export interface UseDesignReferenceReturn {
  isGenerating: ReturnType<typeof ref<boolean>>;
  error: ReturnType<typeof ref<string | null>>;
  generate: (input: DesignReferenceInput) => Promise<TemplateContent | null>;
  reset: () => void;
}

export interface DesignReferenceInput {
  prompt?: string;
  imageUpload?: File;
  pdfUpload?: File;
}

export function useDesignReference(
  options: UseDesignReferenceOptions,
): UseDesignReferenceReturn {
  const { authManager, getTemplateId, onApply, onError } = options;

  const isGenerating = ref(false);
  const error = ref<string | null>(null);

  async function generate(
    input: DesignReferenceInput,
  ): Promise<TemplateContent | null> {
    const templateId = getTemplateId();
    if (!templateId) {
      throw new Error("Template must be saved before using design reference");
    }

    isGenerating.value = true;
    error.value = null;

    try {
      const formData = new FormData();

      if (input.prompt) {
        formData.append("prompt", input.prompt);
      }

      if (input.imageUpload) {
        formData.append("image_upload", input.imageUpload);
      }

      if (input.pdfUpload) {
        formData.append("pdf_upload", input.pdfUpload);
      }

      const url = buildUrl(API_ROUTES["ai.generateFromDesign"], {
        project: authManager.projectId,
        tenant: authManager.tenantSlug,
        template: templateId,
      });

      const response = await authManager.authenticatedFetch(url, {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (response.status === 403) {
          throw new Error("ai_generation_not_available");
        }
        throw new Error(
          errorData?.message || "Failed to generate template from design",
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read stream");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let result: TemplateContent | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) {
            continue;
          }

          const jsonStr = line.slice(6);

          let event;
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (event.type === "error") {
            throw new Error(
              event.message || "Failed to generate template from design",
            );
          }

          if (event.type === "done") {
            result = event.content ?? null;

            if (result) {
              onApply?.(result);
            }
          }
        }
      }

      return result;
    } catch (err) {
      const wrappedError =
        err instanceof Error
          ? err
          : new Error("Failed to generate template from design");
      error.value = wrappedError.message;
      onError?.(wrappedError);

      return null;
    } finally {
      isGenerating.value = false;
    }
  }

  function reset(): void {
    isGenerating.value = false;
    error.value = null;
  }

  return {
    isGenerating,
    error,
    generate,
    reset,
  };
}
