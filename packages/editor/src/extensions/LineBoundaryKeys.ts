import { Extension } from "@tiptap/core";

/**
 * Routes plain End/Home through `Selection.modify` instead of the browser's
 * native caret movement.
 *
 * Chromium (verified 140–151, including stable Chrome) has a bug where a
 * native End or Home pressed while a triple-click selection is active puts
 * Blink's selection state into a mode where the next typed character
 * natively smooth-scrolls the nearest scrollable ancestor (the editor's
 * canvas, `.tpl-body`) to its very bottom (End) or top (Home), dragging the
 * caret out of view. The state cannot be repaired after the fact — clearing
 * or re-setting the DOM selection, blur/refocus, and preventDefault on the
 * clicks all fail — but a programmatic caret move never arms it.
 *
 * `Selection.modify("move", direction, "lineboundary")` is the exact
 * equivalent of the native key (visual line boundary, bidi-aware via the
 * logical forward/backward directions), so behavior is unchanged for users.
 * Shift+End / Shift+Home extend selections natively and do not trigger the
 * bug, so only the plain keys are bound — a keymap entry without modifiers
 * never matches the shifted keys.
 */
export const LineBoundaryKeys = Extension.create({
  name: "lineBoundaryKeys",

  addKeyboardShortcuts() {
    const moveToLineBoundary =
      (direction: "forward" | "backward") =>
      ({ editor }: { editor: { view: unknown } }): boolean => {
        const view = editor.view as {
          composing: boolean;
          root: DocumentOrShadowRoot & {
            getSelection?: () => Selection | null;
          };
          dom: HTMLElement;
        };
        // During IME composition End/Home commit the composition; leave
        // that to the browser.
        if (!view || view.composing) return false;
        // `view.root` is the editable's Document or ShadowRoot, so the
        // selection resolves correctly in both mount modes. ShadowRoot's
        // getSelection is Chromium-only; elsewhere fall back to the owner
        // document (Chromium is also the only engine with the bug).
        const selection =
          typeof view.root?.getSelection === "function"
            ? view.root.getSelection()
            : (view.dom?.ownerDocument?.getSelection?.() ?? null);
        // `modify` is non-standard; without it, or with a selection that
        // is not ours, native handling is the safer default.
        if (!selection || typeof selection.modify !== "function") return false;
        if (!selection.anchorNode || !view.dom.contains(selection.anchorNode)) {
          return false;
        }
        selection.modify("move", direction, "lineboundary");
        return true;
      };

    return {
      End: moveToLineBoundary("forward"),
      Home: moveToLineBoundary("backward"),
    };
  },
});
