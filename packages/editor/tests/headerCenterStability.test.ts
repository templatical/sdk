import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The header's centre track must never change width.
 *
 * `EditorHeader`'s grid is `1fr auto 1fr`, so the centre track is exactly
 * max-content wide and the two equal `fr` columns centre it. That makes any
 * width change to the group redistribute **symmetrically about the header's
 * centre** — every sibling moves by half the delta, whichever side of the
 * insertion point it sits on. DOM order is irrelevant.
 *
 * Measured before the fix (issue #574): entering preview mode added the
 * 189px sample/label toggle plus a 40px gap, and Viewport, DarkMode and
 * **Preview** each jumped 114.5px left while the version-history menu jumped
 * 114.6px right. Re-clicking Preview to leave the mode meant hunting for a
 * button that had moved half a toggle's width away. Cloud had it worse: its
 * `CollaboratorBar` sat in the same track, so the button slid out from under
 * the cursor whenever anyone joined or left.
 *
 * The invariant that fixes the whole class, rather than the one instance:
 * **nothing inside the centre track may be conditional.** No `v-if`, no
 * `v-show`, no `<slot>`. A track whose children are all unconditional has a
 * constant width, so it cannot re-centre. Conditional controls belong in the
 * edge-anchored `fr` columns, which grow away from their anchored edge and
 * therefore move nothing already in them.
 *
 * Preview-only controls belong on the preview surface instead — see the
 * overlay-layer group below.
 */
const SRC = join(import.meta.dirname, "..", "src");
const headerComponent = readFileSync(
  join(SRC, "components", "EditorHeader.vue"),
  "utf8",
);
const editorSource = readFileSync(join(SRC, "Editor.vue"), "utf8");

/** The centre track's markup: its own div through to the right column's. */
function centerTrack(): string {
  const start = headerComponent.indexOf("tpl-header-center");
  const end = headerComponent.indexOf("tpl-header-right");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return headerComponent.slice(start, end);
}

function rightColumn(): string {
  const start = headerComponent.indexOf("tpl-header-right");
  const end = headerComponent.indexOf("</header>");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return headerComponent.slice(start, end);
}

function leftColumn(): string {
  const start = headerComponent.indexOf("tpl-header-left");
  const end = headerComponent.indexOf("tpl-header-center");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return headerComponent.slice(start, end);
}

describe("header centre track holds a constant width", () => {
  it("carries exactly the three view controls", () => {
    const center = centerTrack();
    expect(center).toContain("<ViewportToggle");
    expect(center).toContain("<DarkModeToggle");
    expect(center).toContain("<PreviewToggle");
  });

  it("renders nothing conditionally inside the track", () => {
    // The load-bearing assertion. Anything conditional here changes the
    // track's width, and the grid re-centres it — moving Preview.
    const center = centerTrack();
    expect(center).not.toMatch(/\bv-if\b/);
    expect(center).not.toMatch(/\bv-else\b/);
    expect(center).not.toMatch(/\bv-show\b/);
  });

  it("offers no slot in the centre column", () => {
    // `center-extras` was the hole Cloud's `CollaboratorBar` came through.
    // Retired rather than left empty: a slot nobody fills is an invitation.
    expect(centerTrack()).not.toContain("<slot");
    expect(headerComponent).not.toContain("center-extras");
    expect(editorSource).not.toContain("center-extras");
  });

  it("does not render the preview-only merge-tag toggle", () => {
    // It lives on the preview surface now — a header control that exists in
    // one mode only cannot sit in a track that must not change width.
    expect(headerComponent).not.toContain("MergeTagModeToggle");
  });

  it("puts version history in the left column", () => {
    // It joins the name and the write time as "which template, and which
    // version of it". The right column was tried and reverted: that row is
    // `justify-end` and already at the edge of its track, so an extra control
    // there spills leftward over the centre track and intercepts clicks meant
    // for the Preview button — the menu's back-arrow covered it, which the
    // preview-resolution e2e caught.
    expect(leftColumn()).toContain("<VersionHistoryMenu");
    expect(centerTrack()).not.toContain("<VersionHistoryMenu");
    expect(rightColumn()).not.toContain("<VersionHistoryMenu");
  });

  it("keeps version history after the name and timestamp stack", () => {
    const left = leftColumn();
    expect(left.indexOf("<TemplateNameField")).toBeLessThan(
      left.indexOf("<VersionHistoryMenu"),
    );
    expect(left.indexOf("<TemplateTimestamp")).toBeLessThan(
      left.indexOf("<VersionHistoryMenu"),
    );
  });

  it("puts the cloud presence bar in the left column", () => {
    // Presence sits with the template's identity, where the cloud plan-usage
    // readout already is.
    expect(leftColumn()).toContain('<slot name="left-extras" />');
  });
});

/**
 * The preview surface's overlay layer.
 *
 * `Editor.vue` floats its preview chrome in a `sticky top-0 h-0` layer over the
 * canvas body. Zero height is the load-bearing part: the layer contributes no
 * space, so nothing in it can push the canvas around, which is what lets a
 * preview-only control live here instead of in the header's centre track.
 *
 * Inside it, **one absolutely-positioned centred column** holds the pills.
 * Fixed per-pill offsets were tried first and were wrong: both pills are
 * reachable at once (the restore pill needs `hasHiddenBlocks`, the toggle needs
 * preview mode with no `resolvePreview` configured, and nothing makes those
 * mutually exclusive), so they must stack — but pinning the restore pill 48px
 * down left it there when it rendered alone, and in editing mode, where the
 * toggle never shows, that dropped it onto the first block's content. Flow gets
 * both cases right.
 */
describe("preview overlay pills stack in a centred column", () => {
  function overlayLayer(): string {
    const start = editorSource.indexOf("tpl-preview-overlay");
    const end = editorSource.indexOf("<main");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return editorSource.slice(start, end);
  }

  it("floats in a zero-height sticky layer", () => {
    const layer = overlayLayer();
    expect(layer).toContain("tpl:sticky");
    expect(layer).toContain("tpl:h-0");
  });

  it("holds exactly one positioned, canvas-centred column", () => {
    // One `absolute` for the column, not one per pill: a pill positioned in its
    // own right is a pill with a hardcoded offset to get wrong.
    const layer = overlayLayer();
    expect(layer.match(/tpl:absolute/g)?.length).toBe(1);
    expect(layer.match(/tpl:left-1\/2/g)?.length).toBe(1);
    expect(layer.match(/tpl:-translate-x-1\/2/g)?.length).toBe(1);
    expect(layer).toContain("tpl:flex-col");
  });

  it("puts the column under the header, not further down", () => {
    // `top-2` clears the header without reaching into the canvas card, which
    // starts at the `<main>` padding.
    expect(overlayLayer()).toContain("tpl:top-2");
    expect(overlayLayer()).not.toContain("tpl:top-14");
  });

  /** One entry per `<Transition>`-wrapped pill, in source order. */
  function pills(): string[] {
    return overlayLayer().split("<Transition").slice(1);
  }

  it("orders the switch above the restore pill", () => {
    const [toggle, restore] = pills();
    expect(toggle).toContain("merge-tag-mode-toggle-anchor");
    expect(restore).toContain("restore-hidden-blocks");
  });

  it("gives no pill an offset of its own", () => {
    // Order comes from the column. An offset here is the bug that put the
    // restore pill over the canvas content.
    for (const pill of pills()) {
      expect(pill).not.toMatch(/tpl:top-\d/);
      expect(pill).not.toContain("tpl:absolute");
    }
  });

  it("styles the restore pill with the shared warning recipe", () => {
    // Not a bespoke string: it stacks with the Sample/Label switch, so it has
    // to be the same height and radius. Hand-rolling it is how it came to sit
    // 8px shorter, `rounded-full`, with a 1.85:1 label.
    const [, restore] = pills();
    expect(restore).toContain("warningBtnCompactClass");
    expect(restore).not.toContain("tpl:rounded-full");
    expect(restore).not.toContain("var(--tpl-warning-light)");
    expect(editorSource).toContain(
      'import { warningBtnCompactClass } from "./constants/styleConstants"',
    );
  });

  it("shows the merge-tag toggle only in preview mode and without a resolver", () => {
    // Same two gates the header applied. Substitution never happens on the
    // editing canvas, and a configured `resolvePreview` supersedes samples
    // entirely.
    const layer = overlayLayer();
    expect(layer).toContain("editor.state.previewMode");
    expect(layer).toContain("core.previewResolution.supersedesSamples.value");
  });
});

/**
 * The warning recipe itself: amber on the border, never as the label.
 *
 * `--tpl-warning` is a light amber (76.9% L), so as a label on `--tpl-bg` it is
 * 2.11:1 — which is why this skin diverges from `btnDangerSkin`, whose mid-red
 * manages 3.76:1. The muted label is 5.93:1 light / 5.99:1 dark. The pill this
 * replaced painted `--tpl-warning` on `--tpl-warning-light`: 1.85:1.
 */
describe("warningBtnCompactClass", () => {
  const recipe = readFileSync(
    join(SRC, "constants", "styleConstants.ts"),
    "utf8",
  );

  function skin(): string {
    const start = recipe.indexOf("const btnWarningSkin");
    expect(start).toBeGreaterThan(-1);
    return recipe.slice(start, recipe.indexOf(";", start));
  }

  it("carries the amber on the border and a muted label", () => {
    const src = skin();
    expect(src).toContain("tpl:border-[var(--tpl-warning)]");
    expect(src).toContain("tpl:text-[var(--tpl-text-muted)]");
    expect(src).not.toContain("tpl:text-[var(--tpl-warning)]");
  });

  it("fills with --tpl-bg at rest, so the amber is not a permanent surface", () => {
    // The One Signal Rule: an amber fill at rest would sit next to the
    // Sample/Label switch's amber active segment.
    const src = skin();
    expect(src).toContain("tpl:bg-[var(--tpl-bg)]");
    expect(src).not.toMatch(/(?<!hover:)bg-\[var\(--tpl-warning-light\)\]/);
  });

  it("brings the amber fill in on hover, like the danger skin", () => {
    expect(skin()).toContain("tpl:hover:bg-[var(--tpl-warning-light)]");
  });

  it("shares the compact scale with the header's controls", () => {
    // Same 38px box as the Sample/Label switch it stacks with.
    expect(recipe).toContain(
      "export const warningBtnCompactClass = `${btnBase} ${btnWarningSkin} ${btnSizeCompact}`",
    );
  });
});
