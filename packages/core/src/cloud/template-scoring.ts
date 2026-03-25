import type {
  ScoringCategory,
  ScoringFinding,
  ScoringResult,
} from "@templatical/types";
import type { AuthManager } from "./auth";
import { API_ROUTES, buildUrl } from "./url-builder";
import type { MergeTag, TemplateContent } from "@templatical/types";
import { ref } from "vue";

export interface UseTemplateScoringOptions {
  authManager: AuthManager;
  getTemplateId: () => string | null;
}

export interface UseTemplateScoringReturn {
  isScoring: ReturnType<typeof ref<boolean>>;
  scoringResult: ReturnType<typeof ref<ScoringResult | null>>;
  error: ReturnType<typeof ref<string | null>>;
  fixingFindingId: ReturnType<typeof ref<string | null>>;
  fixStreamingText: ReturnType<typeof ref<string>>;
  fixError: ReturnType<typeof ref<string | null>>;
  score: (
    content: TemplateContent,
    mergeTags: MergeTag[],
  ) => Promise<ScoringResult | null>;
  fixFinding: (
    blockContent: string,
    finding: ScoringFinding,
    mergeTags: MergeTag[],
  ) => Promise<string | null>;
  removeFinding: (category: ScoringCategory, findingId: string) => void;
  reset: () => void;
}

export function useTemplateScoring(
  options: UseTemplateScoringOptions,
): UseTemplateScoringReturn {
  const { authManager, getTemplateId } = options;

  const isScoring = ref(false);
  const scoringResult = ref<ScoringResult | null>(null);
  const error = ref<string | null>(null);
  const fixingFindingId = ref<string | null>(null);
  const fixStreamingText = ref("");
  const fixError = ref<string | null>(null);

  async function score(
    content: TemplateContent,
    mergeTags: MergeTag[],
  ): Promise<ScoringResult | null> {
    const templateId = getTemplateId();
    if (!templateId) {
      return null;
    }

    isScoring.value = true;
    error.value = null;
    scoringResult.value = null;

    try {
      const url = buildUrl(API_ROUTES["ai.score"], {
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
          current_content: content,
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
        throw new Error(errorData?.message || "Failed to score template");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read stream");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let result: ScoringResult | null = null;

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

          if (event.type === "error") {
            throw new Error(event.message || "Failed to score template");
          }

          if (event.type === "done") {
            result = event.result ?? null;
          }
        }
      }

      if (result) {
        for (const [category, categoryData] of Object.entries(
          result.categories,
        )) {
          for (const finding of categoryData.findings) {
            finding.category = category as ScoringCategory;
          }
        }
      }

      scoringResult.value = result;
      return result;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : "Failed to score template";
      return null;
    } finally {
      isScoring.value = false;
    }
  }

  async function fixFinding(
    blockContent: string,
    finding: ScoringFinding,
    mergeTags: MergeTag[],
  ): Promise<string | null> {
    const templateId = getTemplateId();
    if (!templateId) {
      return null;
    }

    fixingFindingId.value = finding.id;
    fixStreamingText.value = "";
    fixError.value = null;

    try {
      const url = buildUrl(API_ROUTES["ai.fixFinding"], {
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
          content: blockContent,
          finding: {
            id: finding.id,
            message: finding.message,
            suggestion: finding.suggestion,
            category: finding.category,
          },
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
        throw new Error(errorData?.message || "Failed to fix finding");
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
            fixStreamingText.value += event.text;
          } else if (event.type === "error") {
            throw new Error(event.message || "Failed to fix finding");
          } else if (event.type === "done") {
            result = event.content ?? null;
          }
        }
      }

      return result;
    } catch (err) {
      fixError.value =
        err instanceof Error ? err.message : "Failed to fix finding";
      return null;
    } finally {
      fixingFindingId.value = null;
    }
  }

  function removeFinding(category: ScoringCategory, findingId: string): void {
    if (!scoringResult.value) {
      return;
    }

    const cat = scoringResult.value.categories[category];
    if (!cat) {
      return;
    }

    cat.findings = cat.findings.filter((f) => f.id !== findingId);
  }

  function reset(): void {
    isScoring.value = false;
    scoringResult.value = null;
    error.value = null;
    fixingFindingId.value = null;
    fixStreamingText.value = "";
    fixError.value = null;
  }

  return {
    isScoring,
    scoringResult,
    error,
    fixingFindingId,
    fixStreamingText,
    fixError,
    score,
    fixFinding,
    removeFinding,
    reset,
  };
}
