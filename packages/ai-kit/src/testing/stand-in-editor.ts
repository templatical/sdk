import type {
  AiAppliedBatch,
  AiMergeTags,
  AiOperationsResult,
  AiTurnHandlers,
  Operation,
  TemplateContent,
} from "@templatical/types";
import {
  applyOperations,
  invertOperations,
  OperationError,
  safeClone,
} from "@templatical/types";

/** The editor the suites drive: `onOperations` applies with the engine. */
export interface StandInEditor {
  content: TemplateContent;
  readonly mergeTags: AiMergeTags;
  readonly sessionId: string;
  readonly applied: Operation[][];
  readonly refused: { code: string; opIndex: number; message: string }[];
  readonly serverBatches: AiAppliedBatch[];
  /** Apply a batch as the editor would answer `onOperations`. */
  apply(ops: Operation[]): AiOperationsResult;
  /** Fresh handlers for one call; `text` collects what streamed. */
  handlers(extra?: { onText?: (text: string) => void }): AiTurnHandlers & {
    readonly text: string;
  };
}

export function createStandInEditor(
  content: TemplateContent,
  mergeTags: AiMergeTags = { syntax: "liquid", tags: [] },
): StandInEditor {
  const editor: StandInEditor = {
    content: safeClone(content),
    mergeTags: safeClone(mergeTags),
    sessionId: crypto.randomUUID(),
    applied: [],
    refused: [],
    serverBatches: [],
    apply(ops) {
      try {
        const inverse = invertOperations(editor.content, ops);
        editor.content = applyOperations(editor.content, ops);
        editor.applied.push(safeClone(ops));
        return { applied: true, inverse };
      } catch (error) {
        if (!(error instanceof OperationError)) throw error;
        const refusal = {
          code: error.code,
          opIndex: error.opIndex,
          message: error.message,
        };
        editor.refused.push(refusal);
        return { applied: false, ...refusal, code: error.code };
      }
    },
    handlers(extra = {}) {
      let text = "";
      return {
        get text() {
          return text;
        },
        onText(chunk) {
          text += chunk;
          extra.onText?.(chunk);
        },
        onOperations: async (ops) => editor.apply(ops),
        onApplied(batch) {
          editor.serverBatches.push({ ...batch });
        },
      };
    },
  };
  return editor;
}
