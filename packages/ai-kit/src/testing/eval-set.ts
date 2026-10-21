import type { AiMergeTags, TemplateContent } from "@templatical/types";
import { safeClone } from "@templatical/types";
import cases from "../../eval/cases.json";
import injection from "../../eval/injection.json";
import promo from "../../eval/promo.json";
import welcome from "../../eval/welcome.json";
import type { AiModelAdapter } from "../server/model";
import { buildChatRequest } from "../server/prompts";
import { runEditingTurn } from "../server/run-editing-turn";

export type AiEvalCheck =
  | { type: "applied" | "notApplied" }
  | { type: "present" | "missing"; block: string }
  | { type: "contains" | "notContains"; block?: string; text: string }
  | { type: "field"; block: string; path: string; matches: string }
  | { type: "setting"; path: string; matches: string }
  | { type: "greater"; block: string; path: string; than: number }
  | { type: "maxText"; block: string; chars: number }
  | { type: "countType"; blockType: string; min: number }
  | { type: "order"; first: string; then: string }
  | { type: "firstContains"; text: string }
  | { type: "reply"; matches: string };

export interface AiEvalCase {
  name: string;
  template: "welcome" | "promo" | "injection";
  message: string;
  selectedBlockId?: string;
  /** Block ids the case may delete; every other original id must survive. */
  removed?: string[];
  checks: AiEvalCheck[];
}

/** The 32 cases of S7's test set (`eval/cases.json`). */
export const AI_EVAL_CASES = cases as AiEvalCase[];
export const AI_EVAL_TEMPLATES: Readonly<
  Record<AiEvalCase["template"], TemplateContent>
> = {
  welcome: welcome as unknown as TemplateContent,
  promo: promo as unknown as TemplateContent,
  injection: injection as unknown as TemplateContent,
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
  total: number;
  /** Whole percent, rounded down. */
  rate: number;
  ok: boolean;
  results: { name: string; ok: boolean; reason: string | null }[];
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
  testCase: AiEvalCase,
  original: TemplateContent,
  output: AiEvalTurnOutput,
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

/**
 * Run the test set (A1 §6): each case on a fresh copy of its template through
 * `runTurn`, which wraps your backend's turn. A turn that throws fails its case.
 */
export async function runAiEvalSet(options: {
  runTurn: (input: AiEvalTurnInput) => Promise<AiEvalTurnOutput>;
  model: string;
  cases?: readonly AiEvalCase[];
  minPassRate?: number;
}): Promise<AiEvalReport> {
  const cases = options.cases ?? AI_EVAL_CASES;
  const results: AiEvalReport["results"] = [];
  for (const testCase of cases) {
    const original = AI_EVAL_TEMPLATES[testCase.template];
    let reason: string | null;
    try {
      const output = await options.runTurn({
        content: safeClone(original),
        mergeTags: AI_EVAL_MERGE_TAGS,
        message: testCase.message,
        selectedBlockId: testCase.selectedBlockId ?? null,
      });
      reason = checkEvalCase(testCase, original, output);
    } catch (error) {
      reason =
        error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
    }
    results.push({ name: testCase.name, ok: reason === null, reason });
  }
  const passed = results.filter((result) => result.ok).length;
  const rate =
    cases.length === 0 ? 0 : Math.floor((passed * 100) / cases.length);
  return {
    model: options.model,
    passed,
    total: cases.length,
    rate,
    ok: rate >= (options.minPassRate ?? 90),
    results,
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
        request: buildChatRequest(input.message),
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
