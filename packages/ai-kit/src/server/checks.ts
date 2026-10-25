import { SdkError } from "@templatical/types";
import { AI_ERROR_MESSAGES } from "../wire";
import type { AiMergeTags } from "@templatical/types";
import type { AiModelMessage } from "./model";
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
  mergeTags: AiMergeTags,
): { ok: true; html: string } | { ok: false; reason: string } {
  const clean = stripFences(html).trim();
  if (clean === "") return { ok: false, reason: "Your rewrite was empty." };
  if (mergeTags.syntax !== "custom") {
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

/** Normalize a draft and return a reason for one alt-text repair retry. */
export function checkAltTextAnswer(
  answer: string,
  { maxLength }: { maxLength: number },
): { ok: true; alt: string } | { ok: false; reason: string } {
  let alt = answer.trim();
  if (
    (alt.startsWith('"') && alt.endsWith('"')) ||
    (alt.startsWith("'") && alt.endsWith("'"))
  )
    alt = alt.slice(1, -1).trim();
  alt = alt.replace(/^(?:image of|picture of)(?:\s+|$)/i, "").trim();
  if (alt === "") return { ok: false, reason: "Your answer was empty." };
  // Check before normalization can consume a line break after "Image of".
  if (/[\r\n\u2028\u2029]/.test(answer.trim()))
    return { ok: false, reason: "Your answer had several lines." };
  if (/<[a-z]/i.test(alt))
    return { ok: false, reason: "Your answer contained HTML." };
  if (alt.length > maxLength)
    return {
      ok: false,
      reason: `Your answer was ${alt.length} characters; the limit is ${maxLength}.`,
    };
  return { ok: true, alt };
}

/** Keep the original image request and ask once more with its length limit. */
export function buildAltTextRepairRequest(
  built: { system: string; messages: AiModelMessage[] },
  answer: string,
  reason: string,
  maxLength: number,
): { system: string; messages: AiModelMessage[] } {
  return {
    system: built.system,
    messages: [
      ...built.messages,
      { role: "assistant", content: answer },
      {
        role: "user",
        content: `${reason} Reply again with only the alt text: one line of plain text, at most ${maxLength} characters.`,
      },
    ],
  };
}

/** Normalize a draft and enforce the request's UTF-16 alt-text limit. */
export function checkAltText(
  answer: string,
  { maxLength }: { maxLength: number },
): string {
  const check = checkAltTextAnswer(answer, { maxLength });
  if (!check.ok)
    throw new SdkError(
      AI_ERROR_MESSAGES.ai_output_invalid,
      502,
      "ai_output_invalid",
    );
  return check.alt;
}
