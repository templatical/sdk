import type {
  AiFixFinding,
  AiMergeTags,
  AiRewritePreset,
  TemplateContent,
} from "@templatical/types";
import {
  CHAT_REQUEST,
  DESIGN_REQUEST,
  EDITING_RULES,
  FIX_REQUEST,
  OPERATIONS_GUIDE,
  REWRITE_INSTRUCTIONS,
  REWRITE_PRESETS,
  TEMPLATE_CONTENT_SCHEMA,
} from "../generated/assets";
import { fill } from "./fill";
import { flattenMergeTags } from "./merge-tags";

/**
 * The system prompt of chat, fix and design turns: the rules
 * (`prompts/editing.md`), the operation vocabulary (`prompts/operations.md`)
 * and the content schema (`schema/template-content.schema.json`), joined as
 * below. Static, so a provider can cache it with the tool definition.
 */
export const editingInstructions = `${EDITING_RULES}\n\n# Operations\n\n${OPERATIONS_GUIDE}\n\n# Template content schema\n\n${TEMPLATE_CONTENT_SCHEMA}`;

/** The rewrite system prompt (`prompts/rewrite.md`). */
export const rewriteInstructions = REWRITE_INSTRUCTIONS;
/**
 * The design request (`prompts/design.md`), with `{notes}` for the user's
 * prompt. A design turn runs with `editingInstructions` as its system prompt
 * and this as its request, the image or PDF attached.
 */
export const designInstructions = DESIGN_REQUEST;

/** What each rewrite preset asks for (`prompts/rewrite-presets.json`). */
export const REWRITE_PRESET_INSTRUCTIONS: Readonly<
  Record<AiRewritePreset, string>
> = REWRITE_PRESETS;

function describeMergeTags(mergeTags: AiMergeTags | null): string {
  if (!mergeTags || mergeTags.tags.length === 0) {
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
  mergeTags: AiMergeTags | null;
  selectedBlockId: string | null;
  /** `buildChatRequest`, `buildFixRequest` or `buildDesignRequest`. */
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

export function buildChatRequest(message: string): string {
  return fill(CHAT_REQUEST, { message });
}

export function buildFixRequest(finding: AiFixFinding): string {
  return fill(FIX_REQUEST, {
    message: finding.message,
    suggestion: finding.suggestion,
    block: finding.blockId ?? "the whole template",
  });
}

export function buildDesignRequest(prompt: string | null): string {
  return fill(DESIGN_REQUEST, {
    notes: prompt !== null && prompt.trim() !== "" ? prompt : "none",
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
