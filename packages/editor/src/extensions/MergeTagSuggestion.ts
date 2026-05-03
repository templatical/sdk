import type { MergeTag } from "@templatical/types";
import { Extension } from "@tiptap/core";
import Suggestion, {
  type SuggestionOptions,
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import { type App, createApp, h, ref, type Ref } from "vue";
import MergeTagSuggestionList from "../components/MergeTagSuggestionList.vue";

const MAX_RESULTS = 10;

// Monotonic counter for unique listbox IDs across multiple popup instances.
let POPUP_ID_SEQ = 0;

export interface MergeTagSuggestionOptions {
  /** Available merge tags */
  mergeTags: MergeTag[];
  /** Trigger string (e.g. "{{", "*|", "%%=") */
  char: string;
  /** Localized empty-state label */
  emptyText: string;
}

/**
 * Filter merge tags by query against label and value (case-insensitive).
 * Capped at MAX_RESULTS. Exported for testing.
 */
export function filterMergeTags(tags: MergeTag[], query: string): MergeTag[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") {
    return tags.slice(0, MAX_RESULTS);
  }
  return tags
    .filter((tag) => {
      const label = tag.label.toLowerCase();
      const value = tag.value.toLowerCase();
      return label.includes(trimmed) || value.includes(trimmed);
    })
    .slice(0, MAX_RESULTS);
}

/**
 * Handle a keydown event against a list of items. Returns whether the
 * event was handled (so the suggestion plugin can stop propagation).
 * Exported for testing.
 */
export function handleSuggestionKeyDown(
  event: KeyboardEvent,
  items: MergeTag[],
  selectedIndex: Ref<number>,
  onSelect: (item: MergeTag) => void,
): boolean {
  if (items.length === 0) {
    if (event.key === "Enter" || event.key === "Tab") return true;
    return false;
  }

  if (event.key === "ArrowDown") {
    selectedIndex.value = (selectedIndex.value + 1) % items.length;
    return true;
  }
  if (event.key === "ArrowUp") {
    selectedIndex.value =
      (selectedIndex.value - 1 + items.length) % items.length;
    return true;
  }
  if (event.key === "Enter" || event.key === "Tab") {
    onSelect(items[selectedIndex.value]);
    return true;
  }
  return false;
}

export const MergeTagSuggestion = Extension.create<MergeTagSuggestionOptions>({
  name: "mergeTagSuggestion",

  addOptions() {
    return {
      mergeTags: [],
      char: "{{",
      emptyText: "No matching merge tags",
    };
  },

  addProseMirrorPlugins() {
    const tags = this.options.mergeTags;
    const emptyText = this.options.emptyText;

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
      render: () => {
        let app: App | null = null;
        let container: HTMLElement | null = null;
        let editableEl: HTMLElement | null = null;
        const itemsRef = ref<MergeTag[]>([]);
        const selectedIndex = ref(0);
        let currentCommand: ((item: MergeTag) => void) | null = null;
        const listId = `tpl-merge-tag-suggestion-${++POPUP_ID_SEQ}`;
        let latestClientRect: (() => DOMRect | null) | null = null;
        let scrollTargets: Array<EventTarget> = [];

        function reposition(): void {
          position(latestClientRect?.() ?? null);
        }

        function collectScrollAncestors(el: HTMLElement | null): HTMLElement[] {
          // Walk up the DOM finding scrollable ancestors. ProseMirror's
          // scrollIntoView fires on whichever ancestor scrolls — listening
          // to all of them ensures we reposition regardless of which one
          // moves.
          const result: HTMLElement[] = [];
          let node: HTMLElement | null = el?.parentElement ?? null;
          while (
            node &&
            node !== document.body &&
            node !== document.documentElement
          ) {
            const style = window.getComputedStyle(node);
            const overflow = style.overflow + style.overflowX + style.overflowY;
            if (/(auto|scroll|overlay)/.test(overflow)) {
              result.push(node);
            }
            node = node.parentElement;
          }
          return result;
        }

        function attachScrollListeners(viewDom: HTMLElement | null): void {
          scrollTargets = [window, ...collectScrollAncestors(viewDom)];
          for (const target of scrollTargets) {
            target.addEventListener("scroll", reposition, {
              passive: true,
              capture: true,
            });
          }
          window.addEventListener("resize", reposition, { passive: true });
        }

        function detachScrollListeners(): void {
          for (const target of scrollTargets) {
            target.removeEventListener("scroll", reposition, {
              capture: true,
            } as EventListenerOptions);
          }
          window.removeEventListener("resize", reposition);
          scrollTargets = [];
        }

        function position(rect: DOMRect | null): void {
          if (!container || !rect) return;
          // If the caret has scrolled out of the viewport, freeze the
          // popup at its last on-screen position. Following the caret
          // off-screen produces an invisible popup the user can't reach,
          // and lets pathological scroll loops drag the popup further
          // each tick.
          if (rect.bottom < 0 || rect.top > window.innerHeight) return;
          container.style.position = "fixed";
          container.style.left = `${rect.left}px`;
          container.style.zIndex = "9999";
          // Place below caret first; offsetHeight is sync-readable after
          // the Vue app has mounted (or after onUpdate's reactive flush).
          container.style.top = `${rect.bottom}px`;
          const popupHeight = container.offsetHeight;
          if (popupHeight === 0) return;
          const spaceBelow = window.innerHeight - rect.bottom;
          if (spaceBelow < popupHeight) {
            // Not enough room below — flip above. Clamp to 0 so the
            // popup never positions off the top of the viewport.
            const flippedTop = Math.max(0, rect.top - popupHeight);
            container.style.top = `${flippedTop}px`;
          }
        }

        function findMountTarget(
          editorEl: HTMLElement | null | undefined,
        ): HTMLElement {
          // Prefer the theme root (outside Canvas). Canvas.vue applies
          // `filter: invert(1) hue-rotate(180deg)` in dark mode, which
          // creates a containing block for `position: fixed` descendants.
          // Mounting inside the canvas would offset the popup. The theme
          // root has the CSS vars and no transform/filter — best of both.
          //
          // Click-outside is handled by mousedown.prevent.stop on options;
          // mount location no longer affects that.
          const root =
            editorEl?.closest<HTMLElement>("[data-tpl-theme]") ??
            editorEl?.closest<HTMLElement>(".tpl-text-editor-wrapper") ??
            null;
          return root ?? document.body;
        }

        function setEditableAria(active: boolean): void {
          if (!editableEl) return;
          if (active) {
            editableEl.setAttribute("role", "combobox");
            editableEl.setAttribute("aria-haspopup", "listbox");
            editableEl.setAttribute("aria-expanded", "true");
            editableEl.setAttribute("aria-controls", listId);
          } else {
            editableEl.removeAttribute("aria-expanded");
            editableEl.removeAttribute("aria-controls");
            editableEl.removeAttribute("aria-activedescendant");
            editableEl.removeAttribute("aria-haspopup");
            editableEl.removeAttribute("role");
          }
        }

        function setActiveDescendant(): void {
          if (!editableEl) return;
          if (itemsRef.value.length === 0) {
            editableEl.removeAttribute("aria-activedescendant");
            return;
          }
          editableEl.setAttribute(
            "aria-activedescendant",
            `${listId}-opt-${selectedIndex.value}`,
          );
        }

        function select(item: MergeTag): void {
          currentCommand?.(item);
        }

        return {
          onStart: (props: SuggestionProps<MergeTag>) => {
            itemsRef.value = props.items;
            selectedIndex.value = 0;
            currentCommand = (item) => props.command(item);

            container = document.createElement("div");
            container.setAttribute("data-testid", "merge-tag-suggestion-popup");
            // Use view.dom (ProseMirror contenteditable, actually
            // attached to the DOM) rather than options.element, which may
            // be a detached div when no `element` is passed to the editor
            // constructor (as is the case with @tiptap/vue-3 EditorContent).
            const viewDom = props.editor.view?.dom as HTMLElement | undefined;
            editableEl = viewDom ?? null;
            findMountTarget(viewDom ?? null).appendChild(container);

            app = createApp({
              render() {
                return h(MergeTagSuggestionList, {
                  items: itemsRef.value,
                  selectedIndex: selectedIndex.value,
                  emptyText,
                  listId,
                  onSelect: (item: MergeTag) => select(item),
                  onHover: (index: number) => {
                    selectedIndex.value = index;
                    setActiveDescendant();
                  },
                });
              },
            });
            app.mount(container);
            setEditableAria(true);
            setActiveDescendant();
            latestClientRect = props.clientRect ?? null;
            position(latestClientRect?.() ?? null);
            attachScrollListeners(viewDom ?? null);
          },
          onUpdate: (props: SuggestionProps<MergeTag>) => {
            itemsRef.value = props.items;
            // Reset selection when item set changes (query changed).
            if (selectedIndex.value >= props.items.length) {
              selectedIndex.value = 0;
            }
            currentCommand = (item) => props.command(item);
            setActiveDescendant();
            latestClientRect = props.clientRect ?? null;
            position(latestClientRect?.() ?? null);
          },
          onKeyDown: (props: SuggestionKeyDownProps): boolean => {
            if (props.event.key === "Escape") {
              return true;
            }
            const handled = handleSuggestionKeyDown(
              props.event,
              itemsRef.value,
              selectedIndex,
              select,
            );
            if (handled) setActiveDescendant();
            return handled;
          },
          onExit: () => {
            detachScrollListeners();
            setEditableAria(false);
            app?.unmount();
            container?.remove();
            app = null;
            container = null;
            editableEl = null;
            currentCommand = null;
            latestClientRect = null;
          },
        };
      },
    };

    return [
      Suggestion({
        editor: this.editor,
        ...config,
      }),
    ];
  },
});
