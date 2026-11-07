import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A 360px side panel (AI, Comments) opens in the right-hand gutter while the
 * properties panel shifts left by the same 360px and the canvas narrows. All
 * three must move as one, on one token, or the panels drift apart and the
 * canvas settles before them.
 *
 * The panels slide with a keyframe animation, not a transition: Vue's enter
 * transition starts a frame after insertion, while the properties panel's
 * `right` transition starts the frame the state changes, so a transition-based
 * slide trails it by a frame. An animation starts the frame its class lands.
 */
const src = (file: string) =>
  readFileSync(join(import.meta.dirname, "../src", file), "utf8");

const css = src("styles/index.css").replace(/\/\*[\s\S]*?\*\//g, "");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1].replace(/\s+/g, " ").trim();
}

describe("side panel motion", () => {
  it("declares one overridable panel token", () => {
    expect(css).toContain(
      "--tpl-panel-transition: var(--tpl-user-panel-transition, 240ms cubic-bezier(0.16, 1, 0.3, 1));",
    );
  });

  it("slides both panels in and out with keyframes on the panel token", () => {
    expect(rule(".tpl-panel-enter-active")).toBe(
      "animation: var(--tpl-panel-transition) both tpl-panel-in;",
    );
    expect(rule(".tpl-panel-leave-active")).toBe(
      "animation: var(--tpl-panel-transition) both tpl-panel-out;",
    );
    expect(css).toMatch(
      /@keyframes tpl-panel-in\s*\{\s*from\s*\{\s*transform: translateX\(100%\);\s*\}\s*to\s*\{\s*transform: none;\s*\}\s*\}/,
    );
    expect(css).toMatch(
      /@keyframes tpl-panel-out\s*\{\s*from\s*\{\s*transform: none;\s*\}\s*to\s*\{\s*transform: translateX\(100%\);\s*\}\s*\}/,
    );
  });

  it("animates Comments around the v-if that mounts it", () => {
    // Inside the sidebar the transition mounted already visible (no enter)
    // and unmounted with the sidebar (no leave).
    expect(src("components/CommentsSidebar.vue")).not.toContain("<Transition\n");
    expect(src("components/CommentsPanel.vue")).toMatch(
      /<Transition[^>]*>\s*<CommentsSidebar\s+v-if="feature\.isOpen\.value"/,
    );
  });

  it.each(["components/ai/AiPanels.vue", "components/CommentsPanel.vue"])(
    "%s uses the shared panel classes and nothing else",
    (file) => {
      const source = src(file);
      expect(source).toContain('enter-active-class="tpl-panel-enter-active"');
      expect(source).toContain('leave-active-class="tpl-panel-leave-active"');
      // Tailwind 4's translate utilities set `translate`, which a `transform`
      // transition never animates: that pairing is how both panels jumped.
      expect(source).not.toMatch(/(enter|leave)-(from|to)-class=/);
      expect(source).not.toMatch(/slide-(enter|leave)-active/);
    },
  );

  it("moves the canvas and the properties panel on the same token", () => {
    expect(rule(".tpl-body")).toBe(
      "transition: left var(--tpl-panel-transition), right var(--tpl-panel-transition);",
    );
    expect(rule(".tpl-right-sidebar")).toBe(
      "transition: right var(--tpl-panel-transition);",
    );
    // An inline style or a utility would outrank or replace these.
    const editor = src("Editor.vue");
    expect(editor).not.toMatch(/left var\(--tpl-transition\)/);
    expect(editor).not.toContain('style="transition-property: right"');
    const aside = src("components/RightSidebar.vue").match(
      /<aside[\s\S]*?class="([^"]*)"/,
    )![1];
    expect(aside).toContain("tpl-right-sidebar");
    expect(aside).not.toMatch(/tpl:transition|tpl:duration/);
  });

  it("drops all three motions under reduced motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion"));
    expect(reduced).toMatch(
      /\.tpl-body,\s*\.tpl-right-sidebar\s*\{\s*transition: none;\s*\}/,
    );
    expect(reduced).toMatch(
      /\.tpl-panel-enter-active,\s*\.tpl-panel-leave-active\s*\{\s*animation: none;\s*\}/,
    );
  });
});
