import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../src/i18n/locales/en";
import de from "../src/i18n/locales/de";

function readComponent(relativePath: string): string {
  return readFileSync(resolve(__dirname, "..", "src", relativePath), "utf-8");
}

describe("Canvas landmark region", () => {
  const src = readComponent("components/Canvas.vue");

  it("applies role=region with a localized aria-label", () => {
    expect(src).toContain('role="region"');
    expect(src).toContain(':aria-label="t.landmarks.canvas"');
  });
});

describe("Toolbar landmark region", () => {
  const src = readComponent("components/Toolbar.vue");

  it("applies a localized aria-label to the toolbar <aside>", () => {
    expect(src).toContain(':aria-label="t.landmarks.blockToolbar"');
  });
});

describe("RightSidebar landmark region", () => {
  const src = readComponent("components/RightSidebar.vue");

  it("applies a localized aria-label to the right sidebar <aside>", () => {
    expect(src).toContain(':aria-label="t.landmarks.rightSidebar"');
  });

  it("uses h3 (not h4) for the no-selection heading to align with Toolbar h3", () => {
    expect(src).toMatch(
      /<h3[^>]*>\s*\{\{\s*t\.sidebar\.noSelection\s*\}\}/,
    );
  });
});

describe("Reorder announcement live region", () => {
  it("Editor.vue renders a polite aria-live region bound to the reorder composable", () => {
    const src = readComponent("Editor.vue");
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('aria-atomic="true"');
    expect(src).toContain("core.keyboardReorder.announcement.value");
  });

  it("CloudEditor.vue renders a polite aria-live region bound to the reorder composable", () => {
    const src = readComponent("cloud/CloudEditor.vue");
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('aria-atomic="true"');
    expect(src).toContain("core.keyboardReorder.announcement.value");
  });
});

describe("Landmark i18n keys", () => {
  it("en + de expose the four landmark labels", () => {
    const keys = [
      "canvas",
      "blockToolbar",
      "rightSidebar",
      "reorderAnnouncements",
    ] as const;
    for (const key of keys) {
      expect(en.landmarks[key].length).toBeGreaterThan(0);
      expect(de.landmarks[key].length).toBeGreaterThan(0);
    }
  });
});
