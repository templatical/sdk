import type {
  AiChatAttachment,
  AiFixFinding,
  AiMergeTags,
  TemplateContent,
} from "@templatical/types";
import { safeClone } from "@templatical/types";
import { version } from "../../package.json";
import cases from "../../eval/cases.json";
import empty from "../../eval/empty.json";
import domainMismatch from "../../eval/domain-mismatch.json";
import lowText from "../../eval/low-text.json";
import injection from "../../eval/injection.json";
import promo from "../../eval/promo.json";
import welcome from "../../eval/welcome.json";
import type { AiModelAdapter } from "../server/model";
import {
  buildAltTextRequest,
  buildChatRequest,
  buildFixRequest,
} from "../server/prompts";
import {
  buildAltTextRepairRequest,
  checkAltText,
  checkAltTextAnswer,
} from "../server/checks";
import { runEditingTurn } from "../server/run-editing-turn";

export type AiEvalCheck =
  | { type: "applied" | "notApplied" }
  | { type: "present" | "missing"; block: string }
  | { type: "contains" | "notContains"; block?: string; text: string }
  | { type: "lintGone"; ruleId: string }
  | { type: "field" | "fieldNot"; block: string; path: string; matches: string }
  | { type: "setting"; path: string; matches: string }
  | { type: "greater"; block: string; path: string; than: number }
  | { type: "maxText"; block: string; chars: number }
  | { type: "countType"; blockType: string; min: number }
  | { type: "order"; first: string; then: string }
  | { type: "firstContains"; text: string }
  | { type: "reply"; matches: string };

export type AiEvalAltCheck =
  | { type: "nonEmpty" | "withinLimit" }
  | { type: "containsAll" | "containsAny"; texts: string[] }
  | { type: "notMatches"; matches: string }
  | { type: "shortOrMatches"; chars: number; matches: string };

type EvalTemplate =
  "welcome" | "promo" | "injection" | "empty" | "domain-mismatch" | "low-text";

interface EvalTurnCase {
  name: string;
  template: EvalTemplate;
  /** Block ids the case may delete; every other original id must survive. */
  removed?: string[];
  checks: AiEvalCheck[];
}

export interface AiEvalAltTextInput {
  /** Path relative to the package's eval/ folder. */
  image: string;
  linkHref: string | null;
  nearbyText: string;
  maxLength: number;
}

export type AiEvalCase =
  | (EvalTurnCase & {
      kind?: "edit";
      message: string;
      selectedBlockId?: string;
      attachments?: { file: string; kind: "image" | "pdf" }[];
    })
  | (EvalTurnCase & { kind: "fix"; finding: AiFixFinding })
  | (AiEvalAltTextInput & {
      kind: "altText";
      name: string;
      checks: AiEvalAltCheck[];
    });

/** The cases of S7's test set (`eval/cases.json`). An omitted kind means edit. */
export const AI_EVAL_CASES = cases as AiEvalCase[];
export const AI_EVAL_TEMPLATES: Readonly<
  Record<EvalTemplate, TemplateContent>
> = {
  welcome: welcome as unknown as TemplateContent,
  promo: promo as unknown as TemplateContent,
  injection: injection as unknown as TemplateContent,
  empty: empty as unknown as TemplateContent,
  "domain-mismatch": domainMismatch as unknown as TemplateContent,
  "low-text": lowText as unknown as TemplateContent,
};
/** The merge tags every case's editor declares. */
export const AI_EVAL_MERGE_TAGS: AiMergeTags = {
  syntax: "liquid",
  tags: [
    { value: "{{first_name}}", label: "First name" },
    { value: "{{coupon_code}}", label: "Coupon code" },
    { value: "{{unsubscribe_url}}", label: "Unsubscribe link" },
  ],
};

export interface AiEvalTurnInput {
  content: TemplateContent;
  mergeTags: AiMergeTags;
  message: string;
  selectedBlockId: string | null;
  finding: AiFixFinding | null;
  attachments: AiChatAttachment[];
}

export interface AiEvalTurnOutput {
  /** The template after the turn. */
  content: TemplateContent;
  reply: string;
  /** Whether the turn changed the template. */
  applied: boolean;
}

export interface AiEvalReport {
  model: string;
  passed: number;
  /** Cases that ran; skipped cases are excluded. */
  total: number;
  skipped: number;
  /** Whole percent, rounded down. */
  rate: number;
  ok: boolean;
  results: {
    name: string;
    ok: boolean;
    reason: string | null;
    skipped?: true;
  }[];
}

type Json = Record<string, unknown>;

/** Every block by id, in document order (a section, then its columns). */
function blocksById(content: TemplateContent): Map<string, Json> {
  const found = new Map<string, Json>();
  const walk = (blocks: unknown): void => {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks as Json[]) {
      if (typeof block !== "object" || block === null) continue;
      if (typeof block.id === "string") found.set(block.id, block);
      if (Array.isArray(block.children))
        for (const column of block.children) walk(column);
    }
  };
  walk(content.blocks);
  return found;
}

/** A case pattern; PCRE's leading `(?i)` becomes the `i` flag. */
function pattern(source: string): RegExp {
  return source.startsWith("(?i)")
    ? new RegExp(source.slice(4), "iu")
    : new RegExp(source, "u");
}

function matches(value: unknown, source: string): boolean {
  const subject =
    typeof value === "string" ? value : JSON.stringify(value ?? null);
  return pattern(source).test(subject);
}

function containsText(scope: unknown, text: string): boolean {
  return JSON.stringify(scope)
    .toLowerCase()
    .includes(JSON.stringify(text).slice(1, -1).toLowerCase());
}

function at(target: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        typeof value === "object" && value !== null
          ? (value as Json)[key]
          : undefined,
      target,
    );
}

/**
 * Run one case's checks against a turn's outcome; the first failure's reason,
 * or `null` when it passed (S7 Cloud Task 11's `failure()`).
 */
export function checkEvalCase(
  testCase: Exclude<AiEvalCase, { kind: "altText" }>,
  original: TemplateContent,
  output: AiEvalTurnOutput,
  lintCheck?: (content: TemplateContent) => string[],
): string | null {
  const blocks = blocksById(output.content);
  const removed = testCase.removed ?? [];
  for (const id of blocksById(original).keys()) {
    if (!blocks.has(id) && !removed.includes(id))
      return `block ${id} was deleted`;
  }
  const order = [...blocks.keys()];
  for (const check of testCase.checks) {
    const block =
      "block" in check && check.block !== undefined
        ? blocks.get(check.block)
        : undefined;
    const scope =
      "block" in check && check.block !== undefined ? block : output.content;
    let ok: boolean;
    switch (check.type) {
      case "applied":
        ok = output.applied;
        break;
      case "notApplied":
        ok = !output.applied;
        break;
      case "present":
        ok = block !== undefined;
        break;
      case "missing":
        ok = block === undefined;
        break;
      case "contains":
        ok = scope !== undefined && containsText(scope, check.text);
        break;
      case "notContains":
        ok = scope === undefined || !containsText(scope, check.text);
        break;
      case "field":
        ok =
          block !== undefined && matches(at(block, check.path), check.matches);
        break;
      case "fieldNot":
        ok =
          block !== undefined && !matches(at(block, check.path), check.matches);
        break;
      case "lintGone":
        ok =
          lintCheck !== undefined &&
          !lintCheck(output.content).includes(check.ruleId);
        break;
      case "setting":
        ok = matches(at(output.content.settings, check.path), check.matches);
        break;
      case "greater": {
        const value = block ? at(block, check.path) : undefined;
        ok = typeof value === "number" && value > check.than;
        break;
      }
      case "maxText": {
        const raw =
          block && typeof block.content === "string" ? block.content : "";
        // A length measure, not a sanitizer: the text between the tags.
        const text = raw.split(/<[^>]*>/).join("");
        ok =
          block !== undefined && Array.from(text.trim()).length <= check.chars;
        break;
      }
      case "countType":
        ok =
          [...blocks.values()].filter(
            (candidate) => candidate.type === check.blockType,
          ).length >= check.min;
        break;
      case "order": {
        const first = order.indexOf(check.first);
        const then = order.indexOf(check.then);
        ok = first !== -1 && then !== -1 && first < then;
        break;
      }
      case "firstContains":
        ok =
          output.content.blocks[0] !== undefined &&
          containsText(output.content.blocks[0], check.text);
        break;
      case "reply":
        ok = matches(output.reply, check.matches);
        break;
      default:
        ok = false;
    }
    if (!ok) return `check failed: ${JSON.stringify(check)}`;
  }
  return null;
}

/** Public URL for a fixture from this package's fixed-version SDK release. */
function fixtureUrl(file: string): string {
  return `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/${file}`;
}

/** Text-free public probe image from this package's fixed-version SDK release. */
export const AI_CONFORMANCE_ALT_TEXT_IMAGE_URL = fixtureUrl("images/probe.png");

async function loadFixture(file: string): Promise<Blob> {
  const response = await fetch(fixtureUrl(file));
  if (!response.ok) throw new Error(`Fixture ${file}: HTTP ${response.status}`);
  return response.blob();
}

function checkAltCase(
  testCase: Extract<AiEvalCase, { kind: "altText" }>,
  text: string,
): string | null {
  const contains = (value: string) =>
    text.toLowerCase().includes(value.toLowerCase());
  const matches = (source: string) =>
    new RegExp(source.replace(/^\(\?i\)/, ""), "iu").test(text);
  for (const check of testCase.checks) {
    let ok: boolean;
    switch (check.type) {
      case "nonEmpty":
        ok = text.trim() !== "";
        break;
      case "withinLimit":
        ok = text.length <= testCase.maxLength;
        break;
      case "containsAll":
        ok = check.texts.every(contains);
        break;
      case "containsAny":
        ok = check.texts.some(contains);
        break;
      case "notMatches":
        ok = !matches(check.matches);
        break;
      case "shortOrMatches":
        ok = text.length <= check.chars || matches(check.matches);
        break;
      default:
        ok = false;
    }
    if (!ok) return `check failed: ${JSON.stringify(check)}`;
  }
  return null;
}

/**
 * Run each case on a fresh template. Missing optional runners skip their cases;
 * thrown turns or checks fail. The pass rate counts only cases that ran.
 */
export async function runAiEvalSet(options: {
  runTurn: (input: AiEvalTurnInput) => Promise<AiEvalTurnOutput>;
  runAltText?: (input: AiEvalAltTextInput) => Promise<string>;
  lintCheck?: (content: TemplateContent) => string[];
  loadFile?: (file: string) => Promise<Blob>;
  model: string;
  cases?: readonly AiEvalCase[];
  minPassRate?: number;
}): Promise<AiEvalReport> {
  const cases = options.cases ?? AI_EVAL_CASES;
  const results: AiEvalReport["results"] = [];
  for (const testCase of cases) {
    const missing =
      testCase.kind === "altText"
        ? !options.runAltText
          ? "runAltText"
          : null
        : testCase.checks.some((check) => check.type === "lintGone") &&
            !options.lintCheck
          ? "lintCheck"
          : null;
    if (missing) {
      results.push({
        name: testCase.name,
        ok: false,
        reason: `Skipped: ${missing} is required.`,
        skipped: true,
      });
      continue;
    }
    let reason: string | null;
    try {
      if (testCase.kind === "altText") {
        const text = await options.runAltText!({
          image: testCase.image,
          linkHref: testCase.linkHref,
          nearbyText: testCase.nearbyText,
          maxLength: testCase.maxLength,
        });
        reason = checkAltCase(testCase, text);
      } else {
        const original = AI_EVAL_TEMPLATES[testCase.template];
        const attachments: AiChatAttachment[] = [];
        if (testCase.kind !== "fix") {
          for (const attachment of testCase.attachments ?? []) {
            attachments.push({
              file: await (options.loadFile ?? loadFixture)(attachment.file),
              kind: attachment.kind,
              name: attachment.file.split("/").pop()!,
            });
          }
        }
        const output = await options.runTurn({
          content: safeClone(original),
          mergeTags: AI_EVAL_MERGE_TAGS,
          message: testCase.kind === "fix" ? "" : testCase.message,
          selectedBlockId:
            testCase.kind === "fix" ? null : (testCase.selectedBlockId ?? null),
          finding: testCase.kind === "fix" ? safeClone(testCase.finding) : null,
          attachments,
        });
        reason = checkEvalCase(testCase, original, output, options.lintCheck);
      }
    } catch (error) {
      reason =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
    }
    results.push({ name: testCase.name, ok: reason === null, reason });
  }
  const skipped = results.filter((result) => result.skipped).length;
  const total = results.length - skipped;
  const passed = results.filter((result) => result.ok).length;
  const rate = total === 0 ? 0 : Math.floor((passed * 100) / total);
  return {
    model: options.model,
    passed,
    total,
    skipped,
    rate,
    ok: rate >= (options.minPassRate ?? 90),
    results,
  };
}

/** A `runAltText` using image URLs; override them for unreleased fixtures. */
export function evalAltTextWith(
  model: AiModelAdapter,
  options: { imageUrl?: (file: string) => string } = {},
): (input: AiEvalAltTextInput) => Promise<string> {
  return async (input) => {
    const request = buildAltTextRequest({
      templateId: "eval",
      sessionId: "eval",
      blockId: "eval-image",
      image: { url: (options.imageUrl ?? fixtureUrl)(input.image) },
      currentAlt: null,
      linkHref: input.linkHref,
      nearbyText: input.nearbyText,
      locale: "en",
      maxLength: input.maxLength,
    });
    let text = "";
    for await (const part of model.stream({ ...request, tools: [] })) {
      if (part.type === "text") text += part.text;
    }
    const check = checkAltTextAnswer(text, { maxLength: input.maxLength });
    if (!check.ok) {
      const repair = buildAltTextRepairRequest(
        request,
        text,
        check.reason,
        input.maxLength,
      );
      text = "";
      for await (const part of model.stream({ ...repair, tools: [] })) {
        if (part.type === "text") text += part.text;
      }
    }
    return checkAltText(text, { maxLength: input.maxLength });
  };
}

/** A `runTurn` on the kit's own loop, for a model behind an `AiModelAdapter`. */
export function evalTurnWith(
  model: AiModelAdapter,
  options: { maxSteps?: number } = {},
): (input: AiEvalTurnInput) => Promise<AiEvalTurnOutput> {
  return async (input) => {
    const result = await runEditingTurn({
      request: {
        content: input.content,
        mergeTags: input.mergeTags,
        selectedBlockId: input.selectedBlockId,
        request: input.finding
          ? buildFixRequest(input.finding)
          : buildChatRequest(input.message, {
              hasAttachments: input.attachments.length > 0,
            }),
        attachments: input.attachments.map(({ kind, file }) => ({
          kind,
          mediaType: file.type,
          data: file,
        })),
      },
      model,
      write: () => {},
      ...(options.maxSteps !== undefined ? { maxSteps: options.maxSteps } : {}),
    });
    return {
      content: result.content,
      reply: result.text,
      applied: result.batches.length > 0,
    };
  };
}
