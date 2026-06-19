import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Editor root (`.tpl`) sizing invariant for `styles/index.css`.
 *
 * The editor fills its container (`height: 100%`) and keeps a small
 * `min-height` floor only so it stays usable when mounted in a container with
 * no defined height. The floor MUST stay well below a typical short viewport:
 * the editor's panels are anchored `top-14 .. bottom-0`, so if the floor
 * exceeds a short, `overflow-hidden` container the editor overflows and its
 * bottom — the sidebar's last palette items, the footer, and the config
 * panel's lower content — is clipped with no way to scroll to it.
 *
 * Regression locked: issue #231 — the floor was 600px, which clipped on every
 * viewport under ~690px. Keep it modest.
 */
const STYLES = readFileSync(
  join(import.meta.dirname, "..", "src", "styles", "index.css"),
  "utf8",
);

describe("editor root sizing (.tpl)", () => {
  // The base `.tpl { ... }` rule (not the `.tpl[data-tpl-theme=...]` variants)
  // is the one carrying the min-height floor.
  const tplBlock =
    (STYLES.match(/\n\.tpl\s*\{[^}]*\}/g) ?? []).find((b) =>
      b.includes("min-height"),
    ) ?? "";

  it("the base .tpl rule declares a min-height floor", () => {
    expect(tplBlock).not.toBe("");
    expect(tplBlock).toMatch(/min-height:\s*\d+px/);
  });

  it("keeps the floor small enough not to clip short viewports (#231)", () => {
    const px = Number(tplBlock.match(/min-height:\s*(\d+)px/)?.[1]);
    // 600px regressed this; the floor must stay modest so it never exceeds a
    // short bounded container and push the panels' bottom edge out of view.
    expect(px).toBeGreaterThan(0);
    expect(px).toBeLessThanOrEqual(400);
  });
});
