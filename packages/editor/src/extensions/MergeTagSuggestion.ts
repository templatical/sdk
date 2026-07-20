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

/** Options for opening the merge-tag popup. */
export interface MergeTagPopupOpenOptions {
  /** Filtered tags to render. */
  items: MergeTag[];
  /**
   * Anchor rect getter (the caret rect). Same contract as
   * `@tiptap/suggestion`'s `clientRect`: viewport coordinates, re-read on
   * every reposition so the popup tracks the caret through scroll.
   */
  getRect: (() => DOMRect | null) | null;
  /**
   * Element that owns the ARIA combobox state and serves as the theme +
   * scroll-ancestor anchor — the ProseMirror `view.dom` in rich text, the
   * `<input>`/`<textarea>` in a field.
   */
  anchorEl: HTMLElement | null;
  /** Called with the item the user picks. */
  onCommand: (item: MergeTag) => void;
}

/** Options for updating the popup after the query changed. */
export interface MergeTagPopupUpdateOptions {
  items: MergeTag[];
  getRect: (() => DOMRect | null) | null;
  onCommand: (item: MergeTag) => void;
}

/**
 * Imperative handle over a single merge-tag suggestion popup.
 * Both the TipTap suggestion renderer and the input/textarea autocomplete
 * driver drive the SAME controller, so the popup's rendering, positioning,
 * scroll-tracking, ARIA wiring, and keyboard behavior are identical across
 * rich-text and plain-field surfaces by construction.
 */
export interface MergeTagPopupController {
  /** Mount the popup and start tracking the caret. */
  open(options: MergeTagPopupOpenOptions): void;
  /** Refresh items + anchor after the query changed. */
  update(options: MergeTagPopupUpdateOptions): void;
  /**
   * Handle a navigation/selection key (Arrow/Enter/Tab). Returns whether it
   * was handled. Does NOT handle Escape — each caller owns Escape (TipTap's
   * plugin closes via `onExit`; the field driver calls `close()`).
   */
  handleKeyDown(event: KeyboardEvent): boolean;
  /** Unmount the popup, clear ARIA, and detach listeners. Idempotent. */
  close(): void;
  /** Whether the popup is currently mounted. */
  isOpen(): boolean;
}

/**
 * Creates a merge-tag suggestion popup controller: mount, ARIA wiring,
 * caret-tracking position (flip-above + off-screen freeze), scroll/resize
 * repositioning, and cleanup. Framework-agnostic — it takes a plain caret
 * rect getter and an anchor element, so it serves both the ProseMirror
 * suggestion plugin and native text fields.
 */
export function createMergeTagPopup(
  emptyText: string,
  popoverRootRef?: Ref<HTMLElement | null> | null,
): MergeTagPopupController {
  let app: App | null = null;
  let container: HTMLElement | null = null;
  let editableEl: HTMLElement | null = null;
  const itemsRef = ref<MergeTag[]>([]);
  const selectedIndex = ref(0);
  let currentCommand: ((item: MergeTag) => void) | null = null;
  const listId = `tpl-merge-tag-suggestion-${++POPUP_ID_SEQ}`;
  let latestClientRect: (() => DOMRect | null) | null = null;
  let scrollTargets: Array<EventTarget> = [];
  let pendingRaf: number | null = null;

  function reposition(): void {
    position(latestClientRect?.() ?? null);
  }

  /**
   * Reposition immediately and on the next animation frame.
   * After a keystroke triggers the suggestion, TipTap may run its
   * own `scrollIntoView` to keep the caret visible. That scroll
   * lands AFTER the current task's `position()` call but BEFORE
   * the browser's next paint, so we re-measure on rAF to catch
   * the post-scroll caret rect. Without this, the popup pins to
   * the pre-scroll caret position and ends up offset on slower
   * runners.
   */
  function repositionAfterPaint(): void {
    reposition();
    if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
    pendingRaf = requestAnimationFrame(() => {
      pendingRaf = null;
      reposition();
    });
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
      // shadow-ok: ancestor walk terminator; not a mount target
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
    // Position `absolute` relative to the mount target — the popover root
    // (`position: relative`) or the <body> fallback. The caret rect is in
    // viewport space, so subtract the offset parent's rect to get local
    // coords: a transformed ancestor of the editor becomes the containing
    // block for a `fixed` popup and would offset it, but not for an
    // `absolute` popup anchored inside the positioned popover root. The
    // off-screen freeze and flip-above decisions still use viewport metrics.
    container.style.position = "absolute";
    container.style.zIndex = "9999";
    const origin = container.offsetParent?.getBoundingClientRect();
    const originTop = origin?.top ?? 0;
    const originLeft = origin?.left ?? 0;
    container.style.left = `${rect.left - originLeft}px`;
    // Place below caret first; offsetHeight is sync-readable after
    // the Vue app has mounted (or after onUpdate's reactive flush).
    container.style.top = `${rect.bottom - originTop}px`;
    const popupHeight = container.offsetHeight;
    if (popupHeight === 0) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < popupHeight) {
      // Not enough room below — flip above. Clamp to 0 so the
      // popup never positions off the top of the viewport.
      const flippedTop = Math.max(0, rect.top - popupHeight);
      container.style.top = `${flippedTop - originTop}px`;
    }
  }

  function applyThemeContext(
    target: HTMLElement,
    editorEl: HTMLElement | null | undefined,
  ): void {
    // When the popup mounts to document.body its `position: fixed`
    // resolves against the viewport — any transform/filter on a
    // consumer-page ancestor (route transitions, reveal animations,
    // dark canvas inversion) creates a containing block and moves
    // fixed descendants with it. Body ancestors don't transform.
    //
    // When mounting inside the editor's popover root, the popup is a
    // descendant of the `.tpl[data-tpl-theme]` root so CSS vars + font
    // would inherit — but the snapshot below is still emitted inline
    // because inline declarations win and the cost is negligible. This
    // keeps a single behavior across both mount paths.
    //
    // CSS vars (--tpl-bg-elevated, --tpl-border, etc.) are scoped to
    // `.tpl` and `.tpl[data-tpl-theme="dark"]` in the editor's
    // stylesheet, so the popup wouldn't inherit them at body root.
    // Adding `class="tpl"` would also pull base rules (min-height,
    // flex, full-page bg) we don't want on a popup. Instead, snapshot
    // every --tpl-* custom property from the editor's theme root and
    // re-emit them inline on the popup wrapper.
    const themeRoot = editorEl?.closest<HTMLElement>("[data-tpl-theme]");
    if (!themeRoot) return;
    const themeValue = themeRoot.getAttribute("data-tpl-theme");
    if (themeValue) target.setAttribute("data-tpl-theme", themeValue);
    const computed = window.getComputedStyle(themeRoot);
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (prop.startsWith("--tpl-")) {
        target.style.setProperty(prop, computed.getPropertyValue(prop));
      }
    }
    // The popup no longer inherits font from the editor wrapper, so
    // its content would render in the page's default font and end up
    // at a different height — which changes the flip-above decision
    // and shifts the popup off the caret. Copy typography too.
    target.style.fontFamily = computed.fontFamily;
    target.style.fontSize = computed.fontSize;
    target.style.lineHeight = computed.lineHeight;
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
    open: ({ items, getRect, anchorEl, onCommand }) => {
      itemsRef.value = items;
      selectedIndex.value = 0;
      currentCommand = onCommand;

      container = document.createElement("div");
      container.setAttribute("data-testid", "merge-tag-suggestion-popup");
      editableEl = anchorEl;
      applyThemeContext(container, anchorEl);
      // Prefer the editor's popover root (shadow-aware) when wired by
      // the consumer. Falls back to document.body for headless callers
      // that don't pass `popoverRoot` to configure().
      // shadow-ok: fallback when popoverRoot wasn't provided (e.g., headless caller); editor mounts pass the shadow-aware root
      const mountTarget = popoverRootRef?.value ?? document.body;
      mountTarget.appendChild(container);

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
      latestClientRect = getRect;
      repositionAfterPaint();
      attachScrollListeners(anchorEl);
    },
    update: ({ items, getRect, onCommand }) => {
      itemsRef.value = items;
      // Reset selection when item set changes (query changed).
      if (selectedIndex.value >= items.length) {
        selectedIndex.value = 0;
      }
      currentCommand = onCommand;
      setActiveDescendant();
      latestClientRect = getRect;
      repositionAfterPaint();
    },
    handleKeyDown: (event: KeyboardEvent): boolean => {
      const handled = handleSuggestionKeyDown(
        event,
        itemsRef.value,
        selectedIndex,
        select,
      );
      if (handled) setActiveDescendant();
      return handled;
    },
    close: () => {
      // Idempotent: nothing to tear down (and no window listeners to detach)
      // when the popup was never opened. Keeps repeated close() / close-before-
      // open cheap and side-effect-free.
      if (container === null) return;
      if (pendingRaf !== null) {
        cancelAnimationFrame(pendingRaf);
        pendingRaf = null;
      }
      detachScrollListeners();
      setEditableAria(false);
      app?.unmount();
      container.remove();
      app = null;
      container = null;
      editableEl = null;
      currentCommand = null;
      latestClientRect = null;
    },
    isOpen: () => container !== null,
  };
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
      mergeTags: [],
      char: "{{",
      emptyText: "No matching merge tags",
      popoverRoot: null,
    };
  },

  addProseMirrorPlugins() {
    const tags = this.options.mergeTags;
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
