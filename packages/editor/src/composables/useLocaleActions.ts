import type {
  UseCollaborationReturn,
  UseEditorReturn,
  UseHistoryReturn,
} from "@templatical/core";
import {
  applyOperationsInPlace,
  invertOperations,
  OperationError,
  type Operation,
} from "@templatical/types";

export interface UseLocaleActionsReturn {
  /** Applies `setDefaultLocale` as one undo step and moves the view to `locale`; returns the refusal, if any. */
  setDefaultLocale(
    locale: string,
  ): { applied: true } | { applied: false; error: OperationError };
}

interface UseLocaleActionsOptions {
  editor: Pick<UseEditorReturn, "content" | "setActiveLocale" | "markDirty">;
  history: () => Pick<UseHistoryReturn, "record">;
  collaboration?: {
    core: Pick<UseCollaborationReturn, "applyOperations">;
  } | null;
}

export function useLocaleActions(
  options: UseLocaleActionsOptions,
): UseLocaleActionsReturn {
  const { editor } = options;
  return {
    setDefaultLocale(locale) {
      const ops: Operation[] = [{ op: "setDefaultLocale", locale }];
      if (options.collaboration) {
        const result = options.collaboration.core.applyOperations(ops, {});
        if (!result.applied) return result;
      } else {
        try {
          invertOperations(editor.content.value, ops);
        } catch (error) {
          if (error instanceof OperationError) return { applied: false, error };
          throw error;
        }
        options.history().record();
        applyOperationsInPlace(editor.content.value, ops);
        editor.markDirty();
      }
      editor.setActiveLocale(locale);
      return { applied: true };
    },
  };
}
