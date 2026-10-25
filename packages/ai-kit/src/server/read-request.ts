import type {
  AiFixFinding,
  AiChatAttachment,
  AiMergeTags,
  AiRewritePreset,
  TemplateContent,
} from "@templatical/types";
import { SdkError } from "@templatical/types";
import {
  AI_GENERATE_FIELDS,
  AI_ERROR_MESSAGES,
  AI_LIMITS,
  AI_SESSION_HEADER,
  matchAiRoute,
  type AiFixFindingBody,
  type AiAltTextBody,
  type AiGenerateBody,
  type AiRewriteBody,
} from "../wire";

interface Base {
  template: string;
  /** `X-Templatical-Session`, when sent. */
  sessionId: string | null;
}

export type AiWireRequest = Base &
  (
    | { route: "generate"; body: AiGenerateBody }
    | { route: "fixFinding"; body: AiFixFindingBody }
    | { route: "rewriteText"; body: AiRewriteBody }
    | { route: "altText"; body: AiAltTextBody }
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

function mergeTags(value: unknown): AiMergeTags {
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
  if (!isRecord(value))
    invalid(
      "finding must be { ruleId, message, suggestion, reference, blockId, excerpt? }.",
    );
  if (
    typeof value.ruleId !== "string" ||
    value.ruleId.length === 0 ||
    value.ruleId.length > 200
  )
    invalid("finding.ruleId must be 1 to 200 characters.");
  if (!isBoundedText(value.message, 1000))
    invalid("finding.message must be at most 1,000 code points.");
  if (!isBoundedText(value.suggestion, 1000))
    invalid("finding.suggestion must be at most 1,000 code points.");
  let reference: URL | null = null;
  if (typeof value.reference === "string" && value.reference.length <= 2048) {
    try {
      reference = new URL(value.reference);
    } catch {
      /* Invalid URL. */
    }
  }
  if (
    !reference ||
    (reference.protocol !== "http:" && reference.protocol !== "https:")
  )
    invalid(
      "finding.reference must be an http: or https: URL of at most 2,048 characters.",
    );
  if (
    value.blockId !== null &&
    (typeof value.blockId !== "string" || value.blockId.length > 200)
  )
    invalid(
      "finding.blockId must be a string of at most 200 characters or null.",
    );
  if (value.excerpt !== undefined && !isBoundedText(value.excerpt, 1000))
    invalid("finding.excerpt must be at most 1,000 code points when present.");
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
    default:
      break;
  }

  let attachments: AiChatAttachment[] = [];
  let body: unknown;
  if (
    match.route === "generate" &&
    request.headers.get("Content-Type")?.startsWith("multipart/form-data")
  ) {
    const form = await request
      .formData()
      .catch(() => invalid("Send the message as multipart form data."));
    const files = form.getAll(AI_GENERATE_FIELDS.attachment);
    if (files.length > AI_LIMITS.attachmentsMax)
      invalid("Attach at most 4 files.");
    if (
      files.some(
        (file) =>
          !(file instanceof Blob) ||
          (!IMAGE_TYPES.includes(file.type) && file.type !== "application/pdf"),
      )
    )
      invalid("Attach PNG, JPEG, WebP or GIF images, or PDFs.");
    const blobs = files as File[];
    if (blobs.some((file) => file.size > AI_LIMITS.attachmentMaxBytes))
      invalid("Each attachment must be 5 MB or smaller.");
    if (
      blobs.reduce((total, file) => total + file.size, 0) >
      AI_LIMITS.attachmentsTotalMaxBytes
    )
      invalid("Attachments must be 10 MB or smaller together.");
    if (blobs.some((file) => file.name.length > 255))
      invalid("An attachment's file name must be at most 255 characters.");
    attachments = blobs.map((file) => ({
      file,
      kind: file.type === "application/pdf" ? "pdf" : "image",
      name: file.name,
    }));
    const json = (field: string): unknown => {
      const raw = form.get(field);
      if (raw === null) return null;
      try {
        return JSON.parse(String(raw));
      } catch {
        return invalid(`${field} must be JSON.`);
      }
    };
    body = {
      message: form.get(AI_GENERATE_FIELDS.message),
      selectedBlockId: form.get(AI_GENERATE_FIELDS.selectedBlockId),
      revision: form.get(AI_GENERATE_FIELDS.revision),
      mergeTags: json(AI_GENERATE_FIELDS.mergeTags),
      content: json(AI_GENERATE_FIELDS.content),
    };
  } else {
    body = await request.json().catch(() => invalid("Send a JSON body."));
  }
  if (!isRecord(body)) invalid("Send a JSON object.");

  switch (match.route) {
    case "altText": {
      if (
        typeof body.blockId !== "string" ||
        body.blockId.length === 0 ||
        body.blockId.length > 200
      )
        invalid("blockId must be 1 to 200 characters.");
      let url: URL | null = null;
      if (
        isRecord(body.image) &&
        typeof body.image.url === "string" &&
        body.image.url.length <= 2048
      ) {
        try {
          url = new URL(body.image.url);
        } catch {
          /* Invalid URL. */
        }
      }
      if (!url || (url.protocol !== "http:" && url.protocol !== "https:"))
        invalid(
          "image.url must be an http: or https: URL of at most 2,048 characters.",
        );
      for (const key of ["currentAlt", "linkHref"] as const) {
        if (
          body[key] !== null &&
          (typeof body[key] !== "string" || body[key].length > 2048)
        )
          invalid(
            `${key} must be a string of at most 2,048 characters or null.`,
          );
      }
      if (!isBoundedText(body.nearbyText, 2000))
        invalid("nearbyText must be at most 2,000 code points.");
      if (
        typeof body.locale !== "string" ||
        body.locale.length > 35 ||
        !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(body.locale)
      )
        invalid("locale must be a BCP 47 tag of at most 35 characters.");
      if (
        typeof body.maxLength !== "number" ||
        !Number.isInteger(body.maxLength) ||
        body.maxLength < 1 ||
        body.maxLength > 1000
      )
        invalid("maxLength must be an integer from 1 to 1,000.");
      return {
        ...base,
        route: "altText",
        body: {
          blockId: body.blockId,
          image: { url: (body.image as { url: string }).url },
          currentAlt: body.currentAlt as string | null,
          linkHref: body.linkHref as string | null,
          nearbyText: body.nearbyText,
          locale: body.locale,
          maxLength: body.maxLength,
        },
      };
    }
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
          attachments,
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
