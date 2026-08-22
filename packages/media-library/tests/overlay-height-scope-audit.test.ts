import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Guards the issue #575 fix for the media library: an overlay panel's size cap
 * must resolve against its own backdrop, never against the viewport.
 *
 * Every modal here rolls its own `fixed; inset: 0` backdrop. That covers the
 * viewport only while nothing traps it — an ancestor with `transform`,
 * `filter`, `backdrop-filter`, `perspective`, `will-change: transform`,
 * `contain: paint|layout|content|strict`, `container-type`, or a running
 * transform animation becomes the containing block for fixed descendants. This
 * package is not a page: `MediaLibraryModal` teleports into the editor's
 * `popoverTarget`, so it lands inside a consumer's markup where any of those
 * can sit above it.
 *
 * When one does, `inset: 0` resolves to that ancestor's box while a `vh`/`vw`
 * cap still resolves to the viewport, and the panel overflows a container that
 * usually also has `overflow: hidden` — with no scrollbar to reach its buttons.
 * Percentages resolve against whatever the backdrop turned out to be, so they
 * are correct trapped or not.
 *
 * The rule:
 *
 *   panel of a `fixed inset-0` backdrop  ⇒  a PERCENTAGE cap, never `vh`/`vw`
 *
 * Two things make that percentage resolve here, and both are asserted below:
 * the backdrop must be `inset-0` (which makes its height definite) and the
 * panel must be its DIRECT child. The editor needed an extra `h-full` link
 * because `TplModal` puts a wrapper in between; nothing here does, so a
 * percentage on the panel reads the backdrop's content box directly. If a
 * wrapper is ever introduced, it needs `h-full` or every cap here silently
 * stops applying — a percentage against an indefinite height is dropped, not
 * clamped, so the panel would revert to its content size and look untouched.
 *
 * The gutter lives on the backdrop's padding rather than each panel's `mx-4`,
 * both so it is a floor when the host box is small and because padding on a
 * `100%`-sized element would add to it and overflow (preflight is omitted here
 * too, so non-form elements keep `content-box` — the trap behind issue #115).
 *
 * Source-level, not CSS-level, unlike the sibling audits in this package: the
 * defect is which box a cap is measured against, which is a property of the
 * markup, and there is no e2e for this package to measure layout in.
 */

const SRC = join(import.meta.dirname, "..", "src");

function listVueFiles(): string[] {
  const entries = readdirSync(SRC, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".vue"))
    .map((entry) =>
      relative(SRC, join(entry.parentPath ?? SRC, entry.name))
        .split(sep)
        .join("/"),
    )
    .sort();
}

/**
 * The full opening tag starting at `index`.
 *
 * Scans forward with a quote-aware cursor rather than regexing to the next `>`,
 * because attribute values legitimately contain one (`v-if="count > 0"`, arrow
 * functions in handlers).
 */
function openingTagFrom(source: string, index: number): string {
  let quote: string | null = null;
  for (let i = index; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return source.slice(index, i + 1);
    }
  }
  return source.slice(index);
}

/** The first element tag opening after `from`, skipping comments and text. */
function nextElementTag(source: string, from: number): string | null {
  let cursor = from;
  while (cursor < source.length) {
    const open = source.indexOf("<", cursor);
    if (open === -1) return null;
    if (source.startsWith("<!--", open)) {
      const close = source.indexOf("-->", open);
      if (close === -1) return null;
      cursor = close + 3;
      continue;
    }
    if (source[open + 1] === "/") {
      cursor = open + 2;
      continue;
    }
    return openingTagFrom(source, open);
  }
  return null;
}

/** A percentage `max-height` — class utility or inline style. */
const PERCENTAGE_HEIGHT_CAP =
  /tpl:max-h-(?:full|\[\d+(?:\.\d+)?%\])|max-height:\s*\d+(?:\.\d+)?%/;

/** A `max-height`/`max-width` expressed in viewport units, class or inline. */
const VIEWPORT_CAP =
  /max-[hw]-\[[^\]]*\d(?:vh|vw|dvh|dvw|svh|svw|lvh|lvw)|max-(?:height|width)\s*:\s*[^;"]*\d(?:vh|vw|dvh|dvw|svh|svw|lvh|lvw)/;

interface Overlay {
  file: string;
  backdrop: string;
  panel: string;
}

/** Every `fixed inset-0` backdrop in the package, paired with its panel. */
function findOverlays(): Overlay[] {
  const overlays: Overlay[] = [];

  for (const file of listVueFiles()) {
    const source = readFileSync(join(SRC, file), "utf8");
    for (const match of source.matchAll(/<div\b/g)) {
      const backdrop = openingTagFrom(source, match.index);
      if (!/tpl:fixed/.test(backdrop) || !/tpl:inset-0/.test(backdrop)) continue;
      const panel = nextElementTag(source, match.index + backdrop.length);
      overlays.push({ file, backdrop, panel: panel ?? "" });
    }
  }

  return overlays;
}

const OVERLAYS = findOverlays();

describe("media-library overlay height scope audit (issue #575)", () => {
  it("finds every fixed overlay (sanity check)", () => {
    // Guards against the scanner silently returning [] — a broken walker would
    // otherwise make every case below pass. These four are the current floor.
    expect(OVERLAYS.map((overlay) => overlay.file).sort()).toEqual([
      "components/MediaLibraryModal.vue",
      "components/media/MediaEditModal.vue",
      "components/media/MediaImportUrlModal.vue",
      "components/media/MediaReplaceModal.vue",
    ]);
  });

  it.each(OVERLAYS.map((overlay) => [overlay.file, overlay] as const))(
    "%s caps its panel against the backdrop, not the viewport",
    (_file, overlay) => {
      expect(overlay.panel).toMatch(PERCENTAGE_HEIGHT_CAP);
      expect(overlay.panel).not.toMatch(VIEWPORT_CAP);
    },
  );

  it.each(OVERLAYS.map((overlay) => [overlay.file, overlay] as const))(
    "%s centres its panel and owns the gutter on the backdrop",
    (_file, overlay) => {
      // `MediaLibraryModal`'s backdrop had none of this: a 900x650 panel as a
      // plain block child of `fixed inset-0` rendered pinned to the top-left
      // corner. Centring here is also what makes the panel a flex item of a
      // definite-height container, which is what its percentage cap reads.
      expect(overlay.backdrop).toMatch(/tpl:flex/);
      expect(overlay.backdrop).toMatch(/tpl:items-center/);
      expect(overlay.backdrop).toMatch(/tpl:justify-center/);
      expect(overlay.backdrop).toMatch(/tpl:p-4/);

      // The gutter is the backdrop's job, so a panel must not re-add its own.
      expect(overlay.panel).not.toMatch(/tpl:mx-\d/);
    },
  );

  it("detects a viewport cap when one is reintroduced (guard is live)", () => {
    // Proves the matchers fire on the shapes this bug actually took here, so
    // the cases above fail loudly rather than passing on a dead regex. Every
    // string is a literal from before the fix.
    for (const reintroduced of [
      'class="tpl:mx-4 tpl:flex tpl:max-h-[90vh] tpl:w-full tpl:flex-col"',
      "style=\"width: 900px; max-width: 95vw; max-height: 90vh;\"",
    ]) {
      expect(reintroduced).toMatch(VIEWPORT_CAP);
    }

    // And stay quiet on the corrected forms, inline or class.
    for (const fixed of [
      'class="tpl:flex tpl:max-h-[90%] tpl:w-full tpl:flex-col"',
      "style=\"width: 900px; max-width: 100%; max-height: 90%;\"",
    ]) {
      expect(fixed).not.toMatch(VIEWPORT_CAP);
      expect(fixed).toMatch(PERCENTAGE_HEIGHT_CAP);
    }
  });
});
