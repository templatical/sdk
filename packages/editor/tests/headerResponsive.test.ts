// @vitest-environment happy-dom
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mountCrowdedHeader } from "../../../apps/playground/e2e/helpers/localization-header";

const src = (file: string) =>
  readFileSync(join(import.meta.dirname, "../src", file), "utf8");
describe("header container compaction", () => {
  it("responds to its editor container without conditional centre controls", () => {
    expect(src("styles/index.css")).toContain("container-name: tpl-header");
    const header = src("styles/index.css");
    expect(header).toContain("@container tpl-header (max-width: 1024px)");
    expect(header).toMatch(/\.tpl-header-left[\s\S]*?min-width: 0/);
    expect(header).toMatch(/\.tpl-header-right[\s\S]*?min-width: 0/);
    expect(header).toContain(".tpl-header-label");
    expect(header).toContain(".tpl-language-tag");
  });

  it.each([false, true])(
    "retains accessible names and tooltips on compact controls (shadow: %s)",
    async (shadow) => {
      const dispose = await mountCrowdedHeader(shadow);
      onTestFinished(dispose);
      await vi.dynamicImportSettled();
      const host = document.querySelector(
        '[data-testid="language-header-harness"]',
      )!;
      const root = shadow ? host.shadowRoot! : host;
      for (const button of root.querySelectorAll(
        '.tpl-header-center button, [data-testid="language-menu"], [data-testid="comments-trigger"], [data-testid="ai-menu-trigger"], [data-testid="test-email-trigger"], [data-testid="template-save"]',
      )) {
        expect(button.getAttribute("aria-label")).toBeTruthy();
        expect(button.getAttribute("title")).toBeTruthy();
      }
      expect(root.querySelector(".tpl-language-tag")).not.toBeNull();
    },
  );

  it("swaps the language name for its tag only in the compact header", () => {
    // A scoped `.tpl-language-tag { display: none }` outranks the compact
    // rule (same specificity, later sheet), which left the compact trigger
    // without any visible label. Both rules live in the owned sheet, base first.
    const css = src("styles/index.css");
    const hidden = css.search(/\.tpl-language-tag\s*\{\s*display: none;/);
    const compact = css.indexOf("@container tpl-header (max-width: 1024px)");
    expect(hidden).toBeGreaterThan(-1);
    expect(hidden).toBeLessThan(compact);
    expect(css.slice(compact)).toMatch(
      /\.tpl-header-left \.tpl-language-tag\s*\{\s*display: inline;/,
    );
    expect(src("components/localization/LanguageMenu.vue")).not.toMatch(
      /\.tpl-language-tag\s*\{/,
    );
  });

  it("compacts the crowded 768px header and contains the template name within its shrinking column", () => {
    // These rules must be in the owned sheet the harness adopts. SFC styles
    // injected into document.head cannot cross its shadow boundary.
    const css = src("styles/index.css");
    const breakpoint = Number(
      css.match(/@container tpl-header \(max-width: (\d+)px\)/)?.[1],
    );
    expect(breakpoint).toBeGreaterThanOrEqual(768);
    expect(css).toMatch(
      /\.tpl-header-identity\s+\[data-testid="template-name"\][\s\S]*?max-width: 100%/,
    );
  });
});
