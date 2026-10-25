import type {
  AiMergeTags,
  Operation,
  TemplateContent,
} from "@templatical/types";
import {
  applyOperations,
  invertOperations,
  OperationError,
  safeClone,
} from "@templatical/types";
import { AI_LIMITS } from "../wire";
import {
  contentRuleRefusal,
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
