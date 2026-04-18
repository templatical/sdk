import type { MergeTag } from "@templatical/types";
import type { AuthManager } from "./auth";
import { API_ROUTES, buildUrl } from "./url-builder";
import { ref } from "vue";

export interface UseAiRewriteOptions {
  authManager: AuthManager;
  getTemplateId: () => string | null;
}

export interface UseAiRewriteReturn {
  isRewriting: ReturnType<typeof ref<boolean>>;
  streamingText: ReturnType<typeof ref<string>>;
  previousContent: ReturnType<typeof ref<string | null>>;
  rewrittenContent: ReturnType<typeof ref<string | null>>;
  isReverted: ReturnType<typeof ref<boolean>>;
  error: ReturnType<typeof ref<string | null>>;
  rewrite: (
    content: string,
    instruction: string,
    mergeTags: MergeTag[],
  ) => Promise<string | null>;
  undo: () => string | null;
  redo: () => string | null;
  reset: () => void;
}

export function useAiRewrite(options: UseAiRewriteOptions): UseAiRewriteReturn {
  const { authManager, getTemplateId } = options;

  const isRewriting = ref(false);
  const streamingText = ref("");
  const previousContent = ref<string | null>(null);
  const rewrittenContent = ref<string | null>(null);
  const isReverted = ref(false);
  const error = ref<string | null>(null);

  async function rewrite(
    content: string,
    instruction: string,
    mergeTags: MergeTag[],
  ): Promise<string | null> {
    const templateId = getTemplateId();
    if (!templateId) {
      return null;
    }

    isRewriting.value = true;
    streamingText.value = "";
    error.value = null;

    try {
      const url = buildUrl(API_ROUTES["ai.rewriteText"], {
        project: authManager.projectId,
        tenant: authManager.tenantSlug,
        template: templateId,
      });

      const response = await authManager.authenticatedFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          content,
          instruction,
          merge_tags: mergeTags.map((p) => ({
            label: p.label,
            value: p.value,
          })),
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("ai_generation_not_available");
        }
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || "Failed to rewrite text");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read stream");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let result: string | null = null;

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

          let event;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (event.type === "text") {
            streamingText.value += event.text;
          } else if (event.type === "error") {
            throw new Error(event.message || "Failed to rewrite text");
          } else if (event.type === "done") {
            result = event.content ?? null;

            if (result) {
              previousContent.value = content;
              rewrittenContent.value = result;
              isReverted.value = false;
            }
          }
        }
      }

      return result;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to rewrite text";
      return null;
    } finally {
      isRewriting.value = false;
    }
  }

  function undo(): string | null {
    if (!previousContent.value) {
      return null;
    }

    isReverted.value = true;
    return previousContent.value;
  }

  function redo(): string | null {
    if (!rewrittenContent.value) {
      return null;
    }

    isReverted.value = false;
    return rewrittenContent.value;
  }

  function reset(): void {
    isRewriting.value = false;
    streamingText.value = "";
    previousContent.value = null;
    rewrittenContent.value = null;
    isReverted.value = false;
    error.value = null;
  }

  return {
    isRewriting,
    streamingText,
    previousContent,
    rewrittenContent,
    isReverted,
    error,
    rewrite,
    undo,
    redo,
    reset,
  };
}
