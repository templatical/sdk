import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Toolbar and Template Settings are only needed after a block is selected or
 * the Settings tab is opened. RightSidebar already `v-if`s both. A static
 * import still pulls ColorPicker, MergeTagInput, and every per-type toolbar
 * into the entry's static-import closure, which every session downloads
 * before the user clicks anything.
 *
 * `defineAsyncComponent` behind those `v-if`s fetches the chunk on first
 * render — the same contract IssuesPanel already uses in this file.
 */

const SRC = join(
  import.meta.dirname,
  "..",
  "src",
  "components",
  "RightSidebar.vue",
);

describe("RightSidebar lazy-loads the properties panels", () => {
  const src = readFileSync(SRC, "utf8");

  it("loads Toolbar through defineAsyncComponent, not a static import", () => {
    expect(src).toMatch(
      /defineAsyncComponent\(\s*\(\)\s*=>\s*import\(\s*["']\.\/Toolbar\.vue["']\s*\)/,
    );
    expect(src).not.toMatch(/import Toolbar from ["']\.\/Toolbar\.vue["']/);
  });

  it("loads TemplateSettings through defineAsyncComponent, not a static import", () => {
    expect(src).toMatch(
      /defineAsyncComponent\(\s*\(\)\s*=>\s*import\(\s*["']\.\/TemplateSettings\.vue["']\s*\)/,
    );
    expect(src).not.toMatch(
      /import TemplateSettingsPanel from ["']\.\/TemplateSettings\.vue["']/,
    );
  });

  it("still gates Toolbar on a selected block and TemplateSettings on the Settings tab", () => {
    // Without the v-if, defineAsyncComponent would fetch on RightSidebar
    // mount — every session, empty selection included.
    expect(src).toMatch(/<Toolbar\b[^>]*v-if="selectedBlock"/);
    expect(src).toMatch(/v-if="activeTab === 'settings' && settingsEnabled"/);
  });
});

describe("lazy panels expose a hydration testid", () => {
  // E2E selectBlock / openSettingsTab wait on these. The tabpanel shells
  // are visible before the async chunks land, so a missing testid sends
  // those waits back to a snapshot of an empty panel.
  it("Toolbar root carries data-testid=block-toolbar", () => {
    const toolbar = readFileSync(
      join(import.meta.dirname, "..", "src", "components", "Toolbar.vue"),
      "utf8",
    );
    expect(toolbar).toMatch(/data-testid="block-toolbar"/);
  });

  it("TemplateSettings root carries data-testid=template-settings", () => {
    const settings = readFileSync(
      join(
        import.meta.dirname,
        "..",
        "src",
        "components",
        "TemplateSettings.vue",
      ),
      "utf8",
    );
    expect(settings).toMatch(/data-testid="template-settings"/);
  });
});
