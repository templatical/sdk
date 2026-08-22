import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * A modal panel's size cap must resolve against its own backdrop, never against
 * the viewport.
 *
 * `TplModal`'s backdrop is `fixed; inset: 0`. That covers the viewport only
 * while nothing traps it: an ancestor with `transform`, `filter`,
 * `backdrop-filter`, `perspective`, `will-change: transform`,
 * `contain: paint|layout|content|strict`, `container-type`, or a running
 * transform animation becomes the containing block for fixed descendants. The
 * editor is a component embedded in someone else's page, so any of those can
 * sit above it without the editor knowing.
 *
 * When one does, `inset: 0` resolves to that ancestor's box while a `vh` cap on
 * the panel still resolves to the viewport, and the two disagree. Issue #575:
 * a 420px-tall host inside a 720px viewport gave a 648px panel (90vh) inside a
 * 420px containing block — clipped ~113px off both the top and the bottom by
 * the host's `overflow: hidden`, with the panel's own `overflow-y: visible`
 * leaving no way to scroll to the buttons. Every dialog was already capped and
 * internally scrollable; the cap was just measuring the wrong box.
 *
 * The rule this guard enforces:
 *
 *   a panel slotted into `TplModal`  ⇒  a PERCENTAGE cap, never a `vh`/`vw` one
 *
 * `max-h-[90%]` / `max-h-[80%]` keep each dialog's original proportion — the
 * numbers are the old `vh` values, now read against the backdrop — and
 * `max-h-full` is the flat-100% form. A percentage needs an unbroken chain of
 * definite heights above it, which `TplModal` supplies (see its own group
 * below); the backdrop's padding is the floor that keeps a dialog off the edge
 * when the host box is small enough for a percentage gutter to vanish.
 *
 * Inner regions may still use viewport units — a panel bounded by its backdrop
 * bounds its children transitively, and `flex-1 min-h-0 overflow-y-auto` makes
 * them shrink well before any `vh` preference applies. Only the outermost
 * element, the one that decides whether the buttons are reachable at all, is
 * covered here.
 *
 * Behavioural coverage lives in
 * `apps/playground/e2e/tests/modal-height-clamp.spec.ts`, which arms a real
 * fixed-position trap around the editor and asserts the panel stays inside it.
 * happy-dom reports 0 for every box, so the clipping itself is not unit-testable.
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

/** A percentage `max-height` — `max-h-full` (100%) or an explicit `max-h-[n%]`. */
const PERCENTAGE_HEIGHT_CAP = /tpl:max-h-(?:full|\[\d+(?:\.\d+)?%\])/;

/** A `max-height`/`max-width` expressed in viewport units, class or inline. */
const VIEWPORT_CAP =
  /max-[hw]-\[[^\]]*\d(?:vh|vw|dvh|dvw|svh|svw|lvh|lvw)|max-(?:height|width)\s*:\s*[^;"]*\d(?:vh|vw|dvh|dvw|svh|svw|lvh|lvw)/;

interface Panel {
  file: string;
  tag: string;
}

/** The element each `TplModal` consumer slots in as its dialog panel. */
function findTplModalPanels(): Panel[] {
  const panels: Panel[] = [];

  for (const file of listVueFiles()) {
    const source = readFileSync(join(SRC, file), "utf8");
    for (const match of source.matchAll(/<TplModal[\s>]/g)) {
      const openTag = openingTagFrom(source, match.index);
      const tag = nextElementTag(source, match.index + openTag.length);
      if (tag) panels.push({ file, tag });
    }
  }

  return panels;
}

const PANELS = findTplModalPanels();
const TPL_MODAL = readFileSync(join(SRC, "components/TplModal.vue"), "utf8");

/** The backdrop: the `fixed inset-0` element inside `TplModal`. */
const BACKDROP = (() => {
  const index = TPL_MODAL.search(/<div[^>]*tpl:fixed/);
  return index === -1 ? "" : openingTagFrom(TPL_MODAL, index);
})();

/** The wrapper between backdrop and panel — it carries the focus-trap ref. */
const WRAPPER = (() => {
  const index = TPL_MODAL.indexOf('ref="dialogRef"');
  return index === -1 ? "" : openingTagFrom(TPL_MODAL, TPL_MODAL.lastIndexOf("<", index));
})();

describe("overlay height scope", () => {
  it("finds every TplModal panel (sanity check)", () => {
    // Guards against the scanner silently returning [] — a broken walker would
    // otherwise make every case below pass. These six are the current floor.
    const files = PANELS.map((panel) => panel.file).sort();
    expect(files).toEqual([
      "components/LogicTagPickerModal.vue",
      "components/MergeTagPickerModal.vue",
      "components/RestoreVersionDialog.vue",
      "components/SaveBlockDialog.vue",
      "components/SavedBlocksBrowserModal.vue",
      "components/TestEmailModal.vue",
    ]);
  });

  it.each(PANELS.map((panel) => [panel.file, panel] as const))(
    "%s caps its panel against the backdrop, not the viewport",
    (_file, panel) => {
      expect(panel.tag).toMatch(PERCENTAGE_HEIGHT_CAP);
      expect(panel.tag).not.toMatch(VIEWPORT_CAP);
    },
  );

  describe("TplModal supplies the definite-height chain", () => {
    it("sizes the backdrop to its containing block", () => {
      // `inset: 0` is what makes the backdrop's height definite, which is the
      // first link in the chain a panel's percentage cap resolves through.
      expect(BACKDROP).toMatch(/tpl:fixed/);
      expect(BACKDROP).toMatch(/tpl:inset-0/);
    });

    it("puts the gutter on the backdrop, not on the full-height wrapper", () => {
      // Tailwind preflight is omitted, so non-form elements keep the browser's
      // `content-box`. Padding on an `h-full` element would add to 100% and
      // overflow by exactly the padding — the same trap as issue #115. Insets
      // size the backdrop's border box, so padding there safely shrinks the
      // content box the panel measures against.
      expect(BACKDROP).toMatch(/tpl:p-4/);
      expect(WRAPPER).not.toMatch(/tpl:p[xytrbl]?-/);
    });

    it("spans the wrapper across the backdrop's height", () => {
      // A bare `<div>` here is the defect: its height is content-derived, so a
      // percentage cap on the panel resolves against an indefinite height and
      // is dropped entirely. `h-full` restores the chain.
      expect(WRAPPER).toMatch(/tpl:h-full/);
      expect(WRAPPER).toMatch(/tpl:flex/);
      expect(WRAPPER).toMatch(/tpl:items-center/);
    });

    it("leaves the wrapper shrink-to-fit horizontally", () => {
      // Height is the axis that has to become definite. Widening this element
      // would change what `w-full` on a panel resolves against, inflating every
      // shrink-to-fit dialog to its `max-w-*` — the collapsed test-email form
      // would jump straight to `max-w-2xl`.
      expect(WRAPPER).not.toMatch(/tpl:w-full/);
    });

    it("closes on a click outside the panel", () => {
      // The wrapper now covers the backdrop's content box, so the backdrop's
      // own `@click.self` no longer sees clicks in the centring gap. Both
      // elements need the handler or click-outside-to-close silently dies.
      expect(WRAPPER).toMatch(/@click\.self="emit\('close'\)"/);
      expect(BACKDROP).toMatch(/@click\.self="emit\('close'\)"/);
    });
  });

  it("caps the cloud save-gate panel against its own backdrop", () => {
    // Rolls its own backdrop rather than going through TplModal, so it is not
    // in PANELS — but it is the same `fixed inset-0` + `vh` mismatch. Its panel
    // is a direct child of the flex backdrop, so no wrapper link is needed.
    const source = readFileSync(
      join(SRC, "cloud/components/CloudSaveGateModal.vue"),
      "utf8",
    );
    const backdropIndex = source.search(/<div[^>]*tpl:fixed/);
    expect(backdropIndex).toBeGreaterThan(-1);
    const backdrop = openingTagFrom(source, backdropIndex);
    expect(backdrop).toMatch(/tpl:inset-0/);
    expect(backdrop).toMatch(/tpl:p-/);

    const panel = nextElementTag(source, backdropIndex + backdrop.length);
    expect(panel).toMatch(PERCENTAGE_HEIGHT_CAP);
    expect(panel).not.toMatch(VIEWPORT_CAP);
  });

  it("detects a viewport cap when one is reintroduced (guard is live)", () => {
    // Proves VIEWPORT_CAP matches the shapes this bug actually took, so the
    // cases above fail loudly instead of passing on a regex that stopped
    // matching. Every string here is a literal from before the fix.
    for (const reintroduced of [
      'class="tpl-scale-in tpl:flex tpl:max-h-[90vh] tpl:w-full"',
      'class="tpl tpl:flex tpl:max-h-[80vh] tpl:w-[min(420px,92vw)]"',
      'class="tpl:max-w-[calc(100vw_-_2*var(--tpl-base-size))]"',
      'style="max-height: 90vh;"',
      'style="max-width: 95vw;"',
    ]) {
      expect(reintroduced).toMatch(VIEWPORT_CAP);
    }

    // And stays quiet on a correctly capped panel, including the fixed sizes
    // and token-based widths that sit alongside the cap.
    for (const fixed of [
      'class="tpl:flex tpl:max-h-[90%] tpl:w-full tpl:max-w-2xl"',
      'class="tpl tpl:flex tpl:max-h-[80%] tpl:w-[420px] tpl:max-w-full"',
      'class="tpl:max-w-[calc(100%_-_2*var(--tpl-base-size))]"',
    ]) {
      expect(fixed).not.toMatch(VIEWPORT_CAP);
      expect(fixed).not.toMatch(/\d(?:vh|vw)/);
    }

    // The percentage matcher accepts both shapes and rejects the vh one, so a
    // panel cannot satisfy the rule by swapping units.
    expect('tpl:max-h-full').toMatch(PERCENTAGE_HEIGHT_CAP);
    expect('tpl:max-h-[90%]').toMatch(PERCENTAGE_HEIGHT_CAP);
    expect('tpl:max-h-[90vh]').not.toMatch(PERCENTAGE_HEIGHT_CAP);
  });
});
