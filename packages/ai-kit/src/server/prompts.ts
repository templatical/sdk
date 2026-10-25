import type {
  AiFixFinding,
  AiAltTextRequest,
  AiMergeTags,
  AiRewritePreset,
  TemplateContent,
} from "@templatical/types";
import {
  ALT_TEXT_INSTRUCTIONS,
  CHAT_REQUEST,
  CHAT_ATTACHMENTS,
  EDITING_RULES,
  FIX_REQUEST,
  FIX_RULE_GUIDANCE,
  OPERATIONS_GUIDE,
  REWRITE_INSTRUCTIONS,
  REWRITE_PRESETS,
  TEMPLATE_CONTENT_SCHEMA,
} from "../generated/assets";
import type { AiModelMessage } from "./model";
import { fill } from "./fill";
import { flattenMergeTags } from "./merge-tags";

/**
 * The system prompt of chat and fix turns: the rules
 * (`prompts/editing.md`), the operation vocabulary (`prompts/operations.md`)
 * and the content schema (`schema/template-content.schema.json`), joined as
 * below. Static, so a provider can cache it with the tool definition.
 */
export const editingInstructions = `${EDITING_RULES}\n\n# Operations\n\n${OPERATIONS_GUIDE}\n\n# Template content schema\n\n${TEMPLATE_CONTENT_SCHEMA}`;

/** The rewrite system prompt (`prompts/rewrite.md`). */
export const rewriteInstructions = REWRITE_INSTRUCTIONS;
/** What each rewrite preset asks for (`prompts/rewrite-presets.json`). */
export const REWRITE_PRESET_INSTRUCTIONS: Readonly<
  Record<AiRewritePreset, string>
> = REWRITE_PRESETS;

export { FIX_RULE_GUIDANCE };

function describeMergeTags(mergeTags: AiMergeTags): string {
  if (mergeTags.tags.length === 0) {
    return "The editor declared no merge tags. Don't add any.";
  }
  return [
    `Syntax: ${mergeTags.syntax}`,
    ...mergeTags.tags.map((tag) => `- \`${tag.value}\`: ${tag.label}`),
  ].join("\n");
}

export interface EditingPromptInput {
  content: TemplateContent;
  revision?: number | null;
  mergeTags: AiMergeTags;
  selectedBlockId: string | null;
  /** `buildChatRequest` or `buildFixRequest`. */
  request: string;
}

/**
 * A turn's prompt (S7's `TemplatePrompt::build()`): the merge tags, the
 * template with its revision, the selected block, then the request. No
 * end-user identity.
 */
export function buildEditingPrompt(input: EditingPromptInput): string {
  const revision =
    input.revision === undefined || input.revision === null
      ? ""
      : ` (revision ${input.revision})`;
  return [
    "# Merge tags",
    describeMergeTags(input.mergeTags),
    "",
    `# Template${revision}`,
    "```json",
    JSON.stringify(input.content),
    "```",
    "",
    "# Selected block",
    input.selectedBlockId ?? "none",
    "",
    "# Request",
    input.request,
  ].join("\n");
}

export function buildChatRequest(
  message: string,
  options?: { hasAttachments?: boolean },
): string {
  return (
    fill(CHAT_REQUEST, { message }) +
    (options?.hasAttachments ? `\n\n${CHAT_ATTACHMENTS}` : "")
  );
}

export function buildFixRequest(finding: AiFixFinding): string {
  return fill(FIX_REQUEST, {
    ruleId: finding.ruleId,
    excerpt: finding.excerpt !== undefined ? `Excerpt: ${finding.excerpt}` : "",
    guidance: Object.hasOwn(FIX_RULE_GUIDANCE, finding.ruleId)
      ? (FIX_RULE_GUIDANCE as Readonly<Record<string, string>>)[finding.ruleId]
      : "Change only what the finding names.",
    message: finding.message,
    suggestion: finding.suggestion,
    block: finding.blockId ?? "the whole template",
  });
}

export interface RewritePromptInput {
  html: string;
  preset: AiRewritePreset | null;
  language: string | null;
  instruction: string | null;
}

/**
 * A rewrite's prompt (S7's `RewriteText`): the instruction from the preset and
 * the free text, then the text with the editor's tags as bare merge tags,
 * which is how the model reads and writes them.
 */
export function buildRewritePrompt(input: RewritePromptInput): string {
  const parts: string[] = [];
  if (input.preset === "translate") {
    parts.push(
      fill(REWRITE_PRESET_INSTRUCTIONS.translate, {
        language: input.language ?? "en",
      }),
    );
  } else if (input.preset !== null) {
    parts.push(REWRITE_PRESET_INSTRUCTIONS[input.preset]);
  }
  const instruction = input.instruction?.trim() ?? "";
  if (instruction !== "") {
    parts.push(input.preset === null ? instruction : `Also: ${instruction}`);
  }
  return `Instruction: ${parts.join(" ")}\n\nText:\n${flattenMergeTags(input.html)}`;
}

/** Build a plain-text request with the image attached by URL. */
export function buildAltTextRequest(request: AiAltTextRequest): {
  system: string;
  messages: AiModelMessage[];
} {
  return {
    system: fill(ALT_TEXT_INSTRUCTIONS, {
      maxLength: String(request.maxLength),
    }),
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          currentAlt: request.currentAlt,
          linkHref: request.linkHref,
          nearbyText: request.nearbyText,
          locale: request.locale,
        }),
        attachments: [{ kind: "image-url", url: request.image.url }],
      },
    ],
  };
}
