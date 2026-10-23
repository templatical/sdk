import { SdkError } from "@templatical/types";
import { AI_ERROR_MESSAGES } from "../wire";
import type { AiMergeTags } from "@templatical/types";
import {
  flattenMergeTags,
  mergeTagTokens,
  unknownMergeTags,
} from "./merge-tags";

function stripFences(text: string): string {
  return text.replace(/^\s*```[a-z]*\s*|\s*```\s*$/gi, "");
}

/**
 * A rewrite's output, checked: code fences dropped, not empty, no merge tag
 * that is neither declared nor in the input. On `ok: false`, ask once more
 * with `buildRewriteRepairPrompt`; if that fails too, reject with
 * `ai_output_invalid`. No sanitizer: the editor sanitizes what it shows.
 */
export function checkRewrite(
  html: string,
  inputHtml: string,
  mergeTags: AiMergeTags | null,
): { ok: true; html: string } | { ok: false; reason: string } {
  const clean = stripFences(html).trim();
  if (clean === "") return { ok: false, reason: "Your rewrite was empty." };
  if (mergeTags !== null && mergeTags.syntax !== "custom") {
    const allowed = [
      ...mergeTags.tags.map((tag) => tag.value),
      ...mergeTagTokens(flattenMergeTags(inputHtml), mergeTags.syntax),
    ];
    const unknown = unknownMergeTags(
      mergeTags.syntax,
      mergeTagTokens(clean, mergeTags.syntax),
      allowed,
    );
    if (unknown.length > 0) {
      return {
        ok: false,
        reason: `Your rewrite used merge tags that don't exist: ${unknown.join(", ")}.`,
      };
    }
  }
  return { ok: true, html: clean };
}

export function buildRewriteRepairPrompt(
  prompt: string,
  reason: string,
): string {
  return `${prompt}\n\n${reason} Rewrite it again, using only the merge tags in the text.`;
}

/** Normalize a draft and enforce the request's UTF-16 alt-text limit. */
export function checkAltText(
  answer: string,
  { maxLength }: { maxLength: number },
): string {
  let alt = answer.trim();
  if (
    (alt.startsWith('"') && alt.endsWith('"')) ||
    (alt.startsWith("'") && alt.endsWith("'"))
  )
    alt = alt.slice(1, -1).trim();
  alt = alt.replace(/^(?:image of|picture of)(?:\s+|$)/i, "").trim();
  if (alt === "" || /<[a-z]/i.test(alt) || alt.length > maxLength)
    throw new SdkError(
      AI_ERROR_MESSAGES.ai_output_invalid,
      502,
      "ai_output_invalid",
    );
  return alt;
}
