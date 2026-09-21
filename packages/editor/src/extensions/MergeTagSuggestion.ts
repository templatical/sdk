import type { MergeTag } from "@templatical/types";
import { Extension } from "@tiptap/core";
import Suggestion, {
  type SuggestionOptions,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import type { Ref } from "vue";
import { createMergeTagPopup, filterMergeTags } from "../utils/mergeTagPopup";

export interface MergeTagSuggestionOptions {
  /** Available merge tags */
  /**
   * Read live, not captured: the list can be replaced while a block is being
   * edited (`editor.setMergeTags`), and a snapshot taken when the extension
   * was configured would keep suggesting the old tags.
   */
  mergeTags: () => MergeTag[];
  /** Trigger string (e.g. "{{", "*|", "%%=") */
  char: string;
  /** Localized empty-state label */
  emptyText: string;
  /**
   * Mount target for the suggestion popup. When provided with a non-null
   * `.value`, the popup attaches into that element instead of
   * `document.body` — keeping it inside the editor's effective DOM root
   * (shadow-aware). Pass the ref returned by `usePopoverRoot()`.
   *
   * Falls back to `document.body` when omitted or when the ref's value is
   * null at popup-open time (e.g. headless/test editors without an editor
   * shell). Preserves pre-Phase-3 behavior for callers that don't migrate.
   */
  popoverRoot?: Ref<HTMLElement | null> | null;
}

/**
 * Builds the `@tiptap/suggestion` `render` factory for the merge-tag popup.
 * A thin adapter over {@link createMergeTagPopup}: it maps ProseMirror's
 * `SuggestionProps` (items, `clientRect`, `view.dom`, `command`) onto the
 * controller. Exported as a standalone function so that mapping can be
 * unit-tested with mocked `SuggestionProps` instead of a full editor.
 */
export function createMergeTagSuggestionRenderer(
  emptyText: string,
  popoverRootRef?: Ref<HTMLElement | null> | null,
): NonNullable<SuggestionOptions<MergeTag>["render"]> {
  return () => {
    const popup = createMergeTagPopup(emptyText, popoverRootRef);

    return {
      onStart: (props: SuggestionProps<MergeTag>) => {
        // Use view.dom (ProseMirror contenteditable, actually
        // attached to the DOM) rather than options.element, which may
        // be a detached div when no `element` is passed to the editor
        // constructor (as is the case with @tiptap/vue-3 EditorContent).
        const viewDom = props.editor.view?.dom as HTMLElement | undefined;
        popup.open({
          items: props.items,
          getRect: props.clientRect ?? null,
          anchorEl: viewDom ?? null,
          onCommand: (item) => props.command(item),
        });
      },
      onUpdate: (props: SuggestionProps<MergeTag>) => {
        popup.update({
          items: props.items,
          getRect: props.clientRect ?? null,
          onCommand: (item) => props.command(item),
        });
      },
      onKeyDown: (props: SuggestionKeyDownProps): boolean => {
        // Escape closes via TipTap's suggestion plugin (→ onExit); report it
        // handled without selecting.
        if (props.event.key === "Escape") {
          return true;
        }
        return popup.handleKeyDown(props.event);
      },
      onExit: () => popup.close(),
    };
  };
}

export const MergeTagSuggestion = Extension.create<MergeTagSuggestionOptions>({
  name: "mergeTagSuggestion",

  addOptions() {
    return {
      mergeTags: () => [],
      char: "{{",
      emptyText: "No matching merge tags",
      popoverRoot: null,
    };
  },

  addProseMirrorPlugins() {
    const tags = this.options.mergeTags();
    const emptyText = this.options.emptyText;
    const popoverRootRef = this.options.popoverRoot;

    const config: Omit<SuggestionOptions<MergeTag>, "editor"> = {
      char: this.options.char,
      allowSpaces: false,
      startOfLine: false,
      // Default is [" "] which requires whitespace/line-start before the
      // trigger char — so `.{{` would not fire. Allow any preceding char.
      allowedPrefixes: null,
      items: ({ query }: { query: string }) => filterMergeTags(tags, query),
      command: ({
        editor,
        range,
        props,
      }: {
        editor: SuggestionProps<MergeTag>["editor"];
        range: { from: number; to: number };
        props: MergeTag;
      }) => {
        // Use insertContentAt for atomic replace (matches the canonical
        // @tiptap/suggestion + Mention pattern). Avoids edge cases where
        // chained deleteRange + insertMergeTag fails to insert when the
        // selection state shifts mid-chain.
        editor
          .chain()
          .focus()
          .insertContentAt(range, {
            type: "mergeTagNode",
            attrs: { label: props.label, value: props.value },
          })
          .run();
      },
      render: createMergeTagSuggestionRenderer(emptyText, popoverRootRef),
    };

    return [
      Suggestion({
        editor: this.editor,
        ...config,
      }),
    ];
  },
});
