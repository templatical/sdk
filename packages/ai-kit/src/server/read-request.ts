import type {
  AiFixFinding,
  AiMergeTags,
  AiRewritePreset,
  TemplateContent,
} from "@templatical/types";
import { SdkError } from "@templatical/types";
import {
  AI_DESIGN_FIELDS,
  AI_ERROR_MESSAGES,
  AI_LIMITS,
  AI_SESSION_HEADER,
  matchAiRoute,
  type AiFixFindingBody,
  type AiGenerateBody,
  type AiRewriteBody,
} from "../wire";

export interface AiDesignBody {
  prompt: string | null;
  file: Blob;
  fileKind: "image" | "pdf";
  mergeTags: AiMergeTags | null;
  content: TemplateContent;
  revision: number | null;
}

interface Base {
  template: string;
  /** `X-Templatical-Session`, when sent. */
  sessionId: string | null;
}

export type AiWireRequest = Base &
  (
    | { route: "generate"; body: AiGenerateBody }
    | { route: "fixFinding"; body: AiFixFindingBody }
    | { route: "generateFromDesign"; body: AiDesignBody }
    | { route: "rewriteText"; body: AiRewriteBody }
    | { route: "conversationMessages" | "clearConversation" }
    | { route: "undoMessage" | "redoMessage"; message: string }
    | {
        route: "settleReplay";
        message: string;
        replayId: string;
        body: { direction: "undo" | "redo"; applied: boolean };
      }
  );

const PRESETS: readonly AiRewritePreset[] = [
  "shorten",
  "expand",
  "friendlier",
  "formal",
  "fixGrammar",
  "translate",
];
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MERGE_TAG_SYNTAXES = [
  "liquid",
  "handlebars",
  "mailchimp",
  "ampscript",
  "custom",
];
const CATEGORIES = ["spam", "readability", "bestPractices"];

function invalid(message: string): never {
  throw new SdkError(message, 422);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBoundedText = (value: unknown, max: number): value is string =>
  typeof value === "string" && Array.from(value).length <= max;

function content(value: unknown): TemplateContent {
  if (
    !isRecord(value) ||
    !Array.isArray(value.blocks) ||
    !isRecord(value.settings)
  ) {
    invalid("content must be the template's content.");
  }
  if (
    new TextEncoder().encode(JSON.stringify(value)).length >
    AI_LIMITS.contentMaxBytes
  )
    throw new SdkError(
      AI_ERROR_MESSAGES.content_too_large,
      413,
      "content_too_large",
    );
  return value as unknown as TemplateContent;
}

function mergeTags(value: unknown): AiMergeTags | null {
  if (value === null || value === undefined) return null;
  if (
    !isRecord(value) ||
    typeof value.syntax !== "string" ||
    !MERGE_TAG_SYNTAXES.includes(value.syntax) ||
    !Array.isArray(value.tags) ||
    value.tags.length > AI_LIMITS.mergeTagsMax
  ) {
    invalid("mergeTags must be { syntax, tags } with at most 500 tags.");
  }
  for (const tag of value.tags) {
    if (
      !isRecord(tag) ||
      !isBoundedText(tag.value, 200) ||
      !isBoundedText(tag.label, 100) ||
      (tag.group !== undefined && !isBoundedText(tag.group, 100)) ||
      (tag.description !== undefined && !isBoundedText(tag.description, 200))
    ) {
      invalid(
        "Each merge tag must have string value (at most 200 characters) and label (at most 100), with optional string group (at most 100) and description (at most 200).",
      );
    }
  }
  return value as unknown as AiMergeTags;
}

function revision(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 0) {
    invalid("revision must be a whole number or null.");
  }
  return number;
}

function optionalText(
  value: unknown,
  max: number,
  message: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Array.from(value).length > max)
    invalid(message);
  return value;
}

function finding(value: unknown): AiFixFinding {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.message !== "string" ||
    typeof value.suggestion !== "string" ||
    !CATEGORIES.includes(value.category as string) ||
    !(value.blockId === null || typeof value.blockId === "string")
  ) {
    invalid("finding must be { id, message, suggestion, category, blockId }.");
  }
  if (
    Array.from(value.id).length > 64 ||
    Array.from(value.message).length > 1000 ||
    Array.from(value.suggestion).length > 1000
  ) {
    invalid(
      "finding.id must be at most 64 characters, and finding.message and finding.suggestion at most 1,000 characters.",
    );
  }
  return value as unknown as AiFixFinding;
}

/**
 * The wire's request, parsed and checked against `AI_LIMITS`; `null` when the
 * request is no route of the wire. Field validation throws `SdkError(message, 422)`;
 * oversized content throws `content_too_large` (413).
 */
export async function readAiRequest(
  request: Request,
): Promise<AiWireRequest | null> {
  const match = matchAiRoute(request.method, new URL(request.url).pathname);
  if (!match) return null;
  const base: Base = {
    template: match.template,
    sessionId: request.headers.get(AI_SESSION_HEADER),
  };

  if (base.sessionId !== null && !isBoundedText(base.sessionId, 200))
    invalid("The session id must be at most 200 characters.");

  switch (match.route) {
    case "conversationMessages":
    case "clearConversation":
      return { ...base, route: match.route };
    case "undoMessage":
    case "redoMessage":
      return { ...base, route: match.route, message: match.message ?? "" };
    case "generateFromDesign": {
      const form = await request
        .formData()
        .catch(() => invalid("Send the design as multipart form data."));
      const image = form.get(AI_DESIGN_FIELDS.image);
      const pdf = form.get(AI_DESIGN_FIELDS.pdf);
      const file = image ?? pdf;
      if (!(file instanceof Blob) || (image !== null && pdf !== null)) {
        invalid("Upload one image or one PDF.");
      }
      const fileKind = image !== null ? "image" : "pdf";
      if (
        fileKind === "image"
          ? !IMAGE_TYPES.includes(file.type)
          : file.type !== "application/pdf"
      ) {
        invalid("Upload a PNG, JPEG, WebP or GIF image, or a PDF.");
      }
      if (file.size > AI_LIMITS.designMaxBytes)
        invalid("The file must be 5 MB or smaller.");
      const json = (field: string): unknown => {
        const raw = form.get(field);
        if (raw === null) return null;
        try {
          return JSON.parse(String(raw));
        } catch {
          return invalid(`${field} must be JSON.`);
        }
      };
      return {
        ...base,
        route: "generateFromDesign",
        body: {
          prompt: optionalText(
            form.get(AI_DESIGN_FIELDS.prompt),
            AI_LIMITS.designPromptMaxChars,
            "The prompt must be at most 2,000 characters.",
          ),
          file,
          fileKind,
          mergeTags: mergeTags(json(AI_DESIGN_FIELDS.mergeTags)),
          content: content(json(AI_DESIGN_FIELDS.content)),
          revision: revision(form.get(AI_DESIGN_FIELDS.revision)),
        },
      };
    }
    default:
      break;
  }

  const body = await request.json().catch(() => invalid("Send a JSON body."));
  if (!isRecord(body)) invalid("Send a JSON object.");

  switch (match.route) {
    case "settleReplay": {
      if (
        (body.direction !== "undo" && body.direction !== "redo") ||
        typeof body.applied !== "boolean"
      )
        invalid(
          "A replay outcome must have direction undo or redo and boolean applied.",
        );
      return {
        ...base,
        route: "settleReplay",
        message: match.message!,
        replayId: match.replayId!,
        body: { direction: body.direction, applied: body.applied },
      };
    }
    case "generate": {
      const message = body.message;
      if (
        typeof message !== "string" ||
        message.trim() === "" ||
        Array.from(message).length > AI_LIMITS.messageMaxChars
      ) {
        invalid("The message must be 1 to 4,000 characters.");
      }
      if (
        typeof body.selectedBlockId === "string" &&
        !isBoundedText(body.selectedBlockId, 200)
      )
        invalid("selectedBlockId must be at most 200 characters.");
      return {
        ...base,
        route: "generate",
        body: {
          message,
          selectedBlockId:
            typeof body.selectedBlockId === "string"
              ? body.selectedBlockId
              : null,
          mergeTags: mergeTags(body.mergeTags),
          content: content(body.content),
          revision: revision(body.revision),
        },
      };
    }
    case "fixFinding":
      return {
        ...base,
        route: "fixFinding",
        body: {
          finding: finding(body.finding),
          mergeTags: mergeTags(body.mergeTags),
          content: content(body.content),
          revision: revision(body.revision),
        },
      };
    case "rewriteText": {
      const html = body.html;
      if (
        typeof html !== "string" ||
        html === "" ||
        Array.from(html).length > AI_LIMITS.rewriteHtmlMaxChars
      ) {
        invalid("html must be 1 to 20,000 characters.");
      }
      const preset = body.preset ?? null;
      if (preset !== null && !PRESETS.includes(preset as AiRewritePreset))
        invalid("Unknown preset.");
      const instruction = optionalText(
        body.instruction,
        AI_LIMITS.instructionMaxChars,
        "The instruction must be at most 500 characters.",
      );
      if (preset === null && instruction === null)
        invalid("Choose a preset or write an instruction.");
      const language = body.language === "" ? null : (body.language ?? null);
      if (
        language !== null &&
        (typeof language !== "string" ||
          !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language))
      ) {
        invalid("language must be a BCP 47 tag.");
      }
      if (preset === "translate" && language === null)
        invalid("Choose a language to translate into.");
      return {
        ...base,
        route: "rewriteText",
        body: {
          html,
          preset: preset as AiRewritePreset | null,
          language,
          instruction,
          mergeTags: mergeTags(body.mergeTags),
        },
      };
    }
  }
}
