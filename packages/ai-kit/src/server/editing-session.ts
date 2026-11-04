import type {
  AiMergeTags,
  Operation,
  TemplateContent,
} from "@templatical/types";
import {
  applyOperations,
  defaultLocaleOf,
  invertOperations,
  OperationError,
  resolveLocale,
  safeClone,
} from "@templatical/types";
import { AI_LIMITS } from "../wire";
import {
  contentRuleRefusal,
  localeLayerRuleRefusal,
  updateBlockRuleRefusal,
  walkBlocks,
} from "./content-rules";
import { mergeTagTokensIn, unknownMergeTags } from "./merge-tags";
import { engineRefusal, opRefusal, type NamedLock } from "./refusal";

export interface EditingSessionLimits {
  /** Operations per call. */
  maxOps: number;
  /** UTF-8 bytes of the content's JSON after a batch. */
  maxContentBytes: number;
  /** Block types the AI may not add (it may keep ones already there). */
  forbiddenBlockTypes: readonly string[];
}

export const EDITING_SESSION_LIMITS: Readonly<EditingSessionLimits> = {
  maxOps: AI_LIMITS.opsPerBatchMax,
  maxContentBytes: AI_LIMITS.contentMaxBytes,
  forbiddenBlockTypes: ["custom", "slot", "wrapper"],
};

export interface EditingSessionOptions {
  content: TemplateContent;
  /** The editor syntax and allowed tags; an empty list still checks tokens. */
  mergeTags: AiMergeTags;
  limits?: Partial<EditingSessionLimits>;
  /** Locks other sessions hold, with their names, when your backend has locks. */
  locks?: readonly NamedLock[];
  /** The session that asked: its own locks don't stop the AI. */
  sessionId?: string | null;
}

export type EditingApplyResult =
  | { ok: true; ops: Operation[]; inverse: Operation[]; feedback: "Applied." }
  | { ok: false; feedback: string };

export interface EditingSession {
  /** The working copy, after every accepted batch. */
  readonly content: TemplateContent;
  /** The accepted batches, in order, each with its inverse. */
  readonly batches: readonly { ops: Operation[]; inverse: Operation[] }[];
  /**
   * Check and apply one call of the tool. Accepted: stream `ops` as an
   * `operations` event, and keep `inverse` for Undo if you store history.
   * Refused: hand `feedback` back to the model as the tool's result.
   */
  apply(opsJson: unknown): EditingApplyResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocaleLayer(layer: unknown): layer is Record<string, unknown> {
  if (!isRecord(layer)) return false;
  if (Object.hasOwn(layer, "set") && !isRecord(layer.set)) return false;
  if (Object.hasOwn(layer, "text")) {
    if (!isRecord(layer.text)) return false;
    for (const entry of Object.values(layer.text)) {
      if (
        !isRecord(entry) ||
        typeof entry.value !== "string" ||
        typeof entry.sourceHash !== "string"
      )
        return false;
    }
  }
  return !Object.hasOwn(layer, "hidden") || layer.hidden === true;
}

function hasValidLocalizedChildren(type: unknown, children: unknown): boolean {
  if (type === "section")
    return (
      Array.isArray(children) &&
      children.every(
        (column) =>
          Array.isArray(column) &&
          column.every(
            (child) =>
              isRecord(child) &&
              (child.type !== "section" && child.type !== "wrapper"
                ? true
                : hasValidLocalizedChildren(child.type, child.children)),
          ),
      )
    );
  if (type === "wrapper")
    return (
      Array.isArray(children) &&
      children.every(
        (child) =>
          isRecord(child) &&
          (child.type !== "section" && child.type !== "wrapper"
            ? true
            : hasValidLocalizedChildren(child.type, child.children)),
      )
    );
  return true;
}

function hasInvalidLocaleLayers(blocks: unknown, settings?: unknown): boolean {
  if (isRecord(settings) && settings.l10n !== undefined) {
    if (!isRecord(settings.l10n)) return true;
    if (Object.values(settings.l10n).some((layer) => !isLocaleLayer(layer)))
      return true;
  }
  const pending = walkBlocks(blocks);
  for (let index = 0; index < pending.length; index++) {
    const l10n = pending[index].l10n;
    if (l10n === undefined) continue;
    if (!isRecord(l10n)) return true;
    for (const layer of Object.values(l10n)) {
      if (!isLocaleLayer(layer)) return true;
      const set = layer.set as Record<string, unknown> | undefined;
      if (
        set &&
        Object.hasOwn(set, "children") &&
        !hasValidLocalizedChildren(pending[index].type, set.children)
      )
        return true;
      pending.push(...walkBlocks(set?.children));
    }
  }
  return false;
}

/**
 * A turn's working copy of the template (A1 §5). Every call is checked, in
 * order: the shape, the count, the content rules, undeclared merge tags, the
 * engine (locks and preconditions included), the size; then applied.
 */
export function createEditingSession(
  options: EditingSessionOptions,
): EditingSession {
  const limits = { ...EDITING_SESSION_LIMITS, ...options.limits };
  const locks = options.locks ?? [];
  const sessionId = options.sessionId ?? null;
  let content = safeClone(options.content);
  const batches: { ops: Operation[]; inverse: Operation[] }[] = [];

  function refuse(reason: string): EditingApplyResult {
    return { ok: false, feedback: `Refused: ${reason}` };
  }

  function apply(opsJson: unknown): EditingApplyResult {
    let parsed: unknown = opsJson;
    if (typeof opsJson === "string") {
      try {
        parsed = JSON.parse(opsJson);
      } catch {
        return refuse('"ops" must be a JSON array of operations.');
      }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return refuse('"ops" must be a non-empty JSON array of operations.');
    }
    if (parsed.length > limits.maxOps) {
      return refuse(`send at most ${limits.maxOps} operations in one call.`);
    }

    if (hasInvalidLocaleLayers(content.blocks, content.settings))
      return refuse("the template has an invalid locale layer");
    for (const op of parsed) {
      if (!isRecord(op)) continue;
      if (
        (op.op === "addBlock" && hasInvalidLocaleLayers([op.block])) ||
        (op.op === "setContent" &&
          isRecord(op.content) &&
          hasInvalidLocaleLayers(op.content.blocks, op.content.settings))
      )
        return refuse("the template has an invalid locale layer");
    }

    const existing = new Map<string, Record<string, unknown>>();
    for (const block of walkBlocks(content.blocks)) {
      if (typeof block.id === "string") existing.set(block.id, block);
    }
    for (const [index, op] of parsed.entries()) {
      if (typeof op !== "object" || op === null) continue;
      const record = op as Record<string, unknown>;
      const added =
        record.op === "addBlock"
          ? [record.block]
          : record.op === "setContent"
            ? (record.content as { blocks?: unknown } | undefined)?.blocks
            : [];
      const reason =
        record.op === "updateBlock"
          ? updateBlockRuleRefusal(record, existing)
          : record.op === "updateBlockLocale" &&
              typeof record.blockId === "string" &&
              existing.has(record.blockId)
            ? localeLayerRuleRefusal(
                existing.get(record.blockId)!,
                record,
                existing,
                limits.forbiddenBlockTypes,
              )
            : contentRuleRefusal(added, existing, limits.forbiddenBlockTypes);
      if (reason !== null) return refuse(opRefusal(index, op, reason));
    }

    const mergeTags = options.mergeTags;
    if (mergeTags.syntax !== "custom") {
      const allowed = [
        ...mergeTags.tags.map((tag) => tag.value),
        ...mergeTagTokensIn(content, mergeTags.syntax),
      ];
      for (const [index, op] of parsed.entries()) {
        const unknown = unknownMergeTags(
          mergeTags.syntax,
          mergeTagTokensIn(op, mergeTags.syntax),
          allowed,
        );
        if (unknown.length > 0) {
          return refuse(
            opRefusal(
              index,
              op,
              `it uses merge tags this editor doesn't declare: ${unknown.join(", ")}`,
            ),
          );
        }
      }
    }

    const ops = parsed as Operation[];
    let next: TemplateContent;
    let inverse: Operation[];
    try {
      next = applyOperations(content, ops, {
        locks: locks.map(({ blockId, sessionId: holder }) => ({
          blockId,
          sessionId: holder,
        })),
        session: sessionId,
      });
      inverse = invertOperations(content, ops);
    } catch (error) {
      if (!(error instanceof OperationError)) throw error;
      return refuse(engineRefusal(error, parsed, content, locks, sessionId));
    }

    const contentReason = contentRuleRefusal(
      next.blocks,
      existing,
      limits.forbiddenBlockTypes,
    );
    if (contentReason !== null) return refuse(contentReason);

    if (hasInvalidLocaleLayers(next.blocks, next.settings))
      return refuse("the template has an invalid locale layer");

    const defaultLocale = defaultLocaleOf(next);
    const locales = new Set<string>([
      defaultLocale,
      ...(next.settings.locales ?? []),
      ...Object.keys(next.settings.l10n ?? {}),
    ]);
    const pending = walkBlocks(next.blocks);
    for (let index = 0; index < pending.length; index++) {
      const block = pending[index];
      if (typeof block.l10n !== "object" || block.l10n === null) continue;
      for (const [locale, layer] of Object.entries(block.l10n)) {
        locales.add(locale);
        const set = (layer as { set?: { children?: unknown } }).set;
        pending.push(...walkBlocks(set?.children));
      }
    }
    const resolvable = {
      ...next,
      settings: { ...next.settings, locales: [...locales] },
    };
    const views = new Map<string, TemplateContent>();
    try {
      for (const locale of locales)
        views.set(locale, resolveLocale(resolvable, locale));
    } catch {
      return refuse("the template has an invalid locale layer");
    }
    const base = views.get(defaultLocale)!;
    const baseBlocks = new Map<string, Record<string, unknown>>();
    for (const block of walkBlocks(base.blocks)) {
      if (typeof block.id === "string") baseBlocks.set(block.id, block);
    }
    const baseReason = contentRuleRefusal(
      base.blocks,
      existing,
      limits.forbiddenBlockTypes,
    );
    if (baseReason !== null) return refuse(baseReason);
    for (const [locale, view] of views) {
      if (locale === defaultLocale) continue;
      for (const block of walkBlocks(view.blocks)) {
        const original =
          typeof block.id === "string" ? baseBlocks.get(block.id) : undefined;
        if (
          original?.type === "custom" &&
          block.type === "custom" &&
          block.customType !== original.customType
        )
          return refuse("you can't change a block's customType");
      }
      const reason = contentRuleRefusal(
        view.blocks,
        baseBlocks,
        limits.forbiddenBlockTypes,
      );
      if (reason !== null) return refuse(reason);
    }

    const bytes = new TextEncoder().encode(JSON.stringify(next)).length;
    if (bytes > limits.maxContentBytes) {
      return refuse(
        `the template would be larger than ${limits.maxContentBytes} bytes. Change less at once.`,
      );
    }

    content = next;
    const accepted = safeClone(ops);
    batches.push({ ops: accepted, inverse });
    return { ok: true, ops: accepted, inverse, feedback: "Applied." };
  }

  return {
    get content() {
      return content;
    },
    batches,
    apply,
  };
}
