import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Mechanical guards for the `DESIGN.md` rules a source scan can actually check.
 *
 * These exist because every rule below had already been broken in a way nobody
 * could see: the utilities compiled to nothing, or resolved to a framework
 * default, so the editor looked plausible and the design system was fiction.
 * A reviewer cannot catch any of them by reading a diff — the class string looks
 * correct in all four cases.
 *
 * Each `describe` names the rule it enforces and why the failure is invisible.
 */

const SRC = join(import.meta.dirname, "..", "src");

function listSourceFiles(): string[] {
  const entries = readdirSync(SRC, { recursive: true, withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() && /\.(vue|ts|css)$/.test(entry.name) && !entry.name.endsWith(".d.ts"),
    )
    .map((entry) =>
      relative(SRC, join(entry.parentPath ?? SRC, entry.name))
        .split(sep)
        .join("/"),
    )
    .sort();
}

const FILES = listSourceFiles();

/** Every `pattern` match in the tree, as actionable `path:line  match` strings. */
function offenders(pattern: RegExp, skip: (relPath: string) => boolean = () => false): string[] {
  const hits: string[] = [];
  for (const relPath of FILES) {
    if (skip(relPath)) continue;
    const lines = readFileSync(join(SRC, relPath), "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const match of line.matchAll(pattern)) {
        hits.push(`${relPath}:${i + 1}  ${match[0]}`);
      }
    });
  }
  return hits;
}

const INDEX_CSS = () => readFileSync(join(SRC, "styles", "index.css"), "utf8");

describe("design system conformance", () => {
  it("source tree was discovered (sanity check)", () => {
    // Guard against the walker silently returning [] (e.g. a wrong SRC path),
    // which would make every assertion below vacuously pass.
    expect(FILES.length).toBeGreaterThan(150);
  });

  describe("Tailwind variant ordering — the prefix comes first", () => {
    /**
     * `prefix(tpl)` requires `tpl:hover:bg-x`, never `hover:tpl:bg-x`. The
     * second form generates NO CSS at all, so the hover state silently does
     * nothing while the class string still reads like a working hover. 49 of
     * these had accumulated across 16 files before this guard existed.
     */
    it("no <variant>:tpl: utilities anywhere in source", () => {
      expect(offenders(/\b[a-z][a-z0-9-]*:tpl:/g)).toEqual([]);
    });

    it("the working form is actually in use (positive control)", () => {
      // Without this, the assertion above would also pass if every variant
      // utility were deleted rather than corrected.
      expect(offenders(/\btpl:hover:/g).length).toBeGreaterThan(20);
    });
  });

  describe("Shadow Vocabulary — the five --tpl-shadow-* steps", () => {
    /**
     * DESIGN.md §5 defines depth as five tokens. Tailwind's own shadow scale
     * looks identical in light mode and never dark-themes: `tpl:shadow-xs` is a
     * fixed `rgba(0,0,0,0.05)`, while `--tpl-shadow-sm` deepens to alpha 0.2 in
     * dark mode. So a Tailwind-scale shadow loses its depth entirely on a dark
     * canvas — invisible in light-mode review.
     */
    it("no Tailwind-scale shadow utilities; depth comes from tokens", () => {
      // The negative lookahead is what lets bare `tpl:shadow` be caught without
      // also matching the correct `tpl:shadow-[var(--tpl-shadow-sm)]`.
      expect(
        offenders(
          /\btpl:(?:[a-z][a-z0-9-]*:)*shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl))?(?![-\w[])/g,
        ),
      ).toEqual([]);
    });

    it("tokenised shadows are actually in use (positive control)", () => {
      expect(offenders(/shadow-\[var\(--tpl-shadow/g).length).toBeGreaterThan(20);
    });
  });

  describe("The On-Amber Rule — amber fills route through one token", () => {
    /**
     * `--tpl-on-primary` is an alias for the paper colour, so an amber fill reads
     * near-white in light and near-black in dark. Hard-coding `--tpl-bg` or
     * `--tpl-text` at a call site produces the same pixels today and quietly
     * opts that site out of the decision: light mode on amber is 2.80:1, an
     * accepted exception recorded in DESIGN.md, and if it is ever revisited it
     * has to be revisited in one place rather than seventeen.
     */
    it("no amber fill hard-codes its label colour", () => {
      const bad: string[] = [];
      for (const relPath of FILES) {
        readFileSync(join(SRC, relPath), "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (!line.includes("bg-[var(--tpl-primary)]")) return;
            for (const token of ["--tpl-text", "--tpl-bg"]) {
              if (line.includes(`text-[var(${token})]`)) {
                bad.push(`${relPath}:${i + 1}  amber fill hard-codes ${token}`);
              }
            }
          });
      }
      expect(bad).toEqual([]);
    });

    it("the token is a single themed alias, not two literals", () => {
      const css = INDEX_CSS();
      // One declaration: `var(--tpl-bg)` already carries the theme, so a second
      // in the dark block would be a literal that silently stops tracking it.
      expect(css.match(/--tpl-on-primary:/g) ?? []).toHaveLength(1);
      expect(css).toContain("--tpl-on-primary: var(--tpl-user-on-primary, var(--tpl-bg))");
    });

    it("the amber surfaces actually use it (positive control)", () => {
      expect(offenders(/text-\[var\(--tpl-on-primary\)\]/g).length).toBeGreaterThan(10);
    });
  });

  describe("The house tempo — 120ms spring", () => {
    /**
     * DESIGN.md §1 and PRODUCT.md principle 2 both state one curve at 120ms.
     * Tailwind's untouched defaults are 150ms in Material easing
     * (`cubic-bezier(.4, 0, .2, 1)`), so every bare `tpl:transition-*` used to
     * opt out of the house tempo by doing nothing. Overriding the two theme
     * defaults is what makes the rule true by default rather than per call site.
     */
    it("the theme overrides Tailwind's transition defaults", () => {
      const css = INDEX_CSS();
      expect(css).toContain("--default-transition-duration: 120ms");
      expect(css).toMatch(
        /--default-transition-timing-function:\s*cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\)/,
      );
    });

    it("no duration-150 — it restates the default we replaced", () => {
      // An explicit 150 is now always an accident: it opts a call site back out
      // of the house tempo to the exact value Tailwind shipped.
      expect(offenders(/\btpl:(?:[a-z][a-z0-9-]*:)*duration-150\b/g)).toEqual([]);
    });
  });

  describe("Comment composers — one shape for the same job", () => {
    /**
     * The new-comment and reply composers do the same thing and had inverted
     * structures: one bordered the wrapper and put its action inside, the other
     * bordered the textarea and stacked its actions beside it. That reads as two
     * different controls. Both now use the wrapper recipe, so the border, the
     * radius, the surface and the focus ring come from one place.
     */
    it("both composers use the bordered wrapper, not a bordered field", () => {
      const src = readFileSync(join(SRC, "components", "CommentsSidebar.vue"), "utf8");
      // Two wrappers: the reply and the new comment.
      expect(src.match(/tpl-comments-input-wrapper tpl-focus-ring-host/g) ?? []).toHaveLength(2);
      // Scoped to the two composers. The `editBody` textareas are a different
      // pattern on purpose — an inline edit form with Save and Cancel in a row
      // beneath it, so the field is bordered in its own right and takes the
      // reset's ring directly, with nothing to double up against.
      const composers = (src.match(/<textarea[\s\S]*?\/>/g) ?? []).filter((ta) =>
        /v-model="(replyBody|newCommentBody)"/.test(ta),
      );
      expect(composers).toHaveLength(2);
      for (const ta of composers) {
        expect(ta).toContain("tpl:border-none");
        expect(ta).toContain("tpl:bg-transparent");
        expect(ta).toContain("tpl:outline-none");
      }
    });

    it("both send buttons share the send-button class", () => {
      const src = readFileSync(join(SRC, "components", "CommentsSidebar.vue"), "utf8");
      // Reply send, reply cancel, new-comment send — plus the CSS rule itself.
      expect((src.match(/tpl-comments-send-btn/g) ?? []).length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("The Warm-Neutral Rule — no pure white or black", () => {
    /**
     * DESIGN.md 2: every neutral carries chroma 0.002-0.015 toward hue 60, and
     * "#000 and #fff do not appear in this system". A `text-white` reads as
     * correct in a diff and is a hair brighter than `--tpl-bg` in light mode —
     * but it is also frozen, so it cannot follow the theme, and on a dark surface
     * it is the one value the palette deliberately avoids.
     *
     * Two things are deliberately out of scope, because neither is a palette
     * neutral. `#fff` inside `mask: linear-gradient(#fff 0 0)` means "fully
     * opaque", not a colour. And a translucent `bg-black/30` is a scrim — a
     * darkening layer over arbitrary imagery or a modal backdrop — which is why
     * the rule matches only opaque forms. Hence the `(?!\/)` lookahead: an
     * opacity modifier marks the scrim case.
     */
    it("no opaque Tailwind white or black colour utilities", () => {
      expect(
        offenders(
          /\btpl:(?:[a-z][a-z0-9-]*:)*(?:bg|text|border|ring|fill|stroke|shadow|divide|outline)-(?:white|black)\b(?!\/)/g,
        ),
      ).toEqual([]);
    });
  });

  describe("Composite focus ring — one halo, not two", () => {
    /**
     * The `.tpl` reset gives every input, select, textarea and button a
     * `--tpl-ring` on `:focus-visible`. A composite control that renders the ring
     * on its wrapper via `:focus-within` therefore paints a second, concentric
     * halo on the field inside it — visible on every focus, and invisible in a
     * diff because the two rules live in different files.
     *
     * `tpl-focus-ring-host` on the wrapper suppresses the inner one.
     */
    it("every :focus-within ring wrapper is a declared focus-ring host", () => {
      const offending: string[] = [];
      for (const relPath of FILES) {
        const src = readFileSync(join(SRC, relPath), "utf8");
        // A component painting the ring on a `:focus-within` wrapper.
        const paints = /:focus-within\s*\{[^}]*box-shadow:\s*var\(--tpl-ring\)/s.test(src);
        if (!paints) continue;
        if (!src.includes("tpl-focus-ring-host")) {
          offending.push(`${relPath}  paints a :focus-within ring without tpl-focus-ring-host`);
        }
      }
      expect(offending).toEqual([]);
    });

    it("the suppressing rule exists and is opt-in (positive control)", () => {
      const css = INDEX_CSS();
      expect(css).toContain(".tpl-focus-ring-host:focus-within");
      expect(css).toMatch(/\.tpl-focus-ring-host:focus-within\s*\n?\s*:is\(input, select, textarea\):focus-visible/);
      // Two wrappers use it today; a bare `:focus-within :is(...)` rule without
      // the marker class would strip the ring from every input in the editor.
      expect(offenders(/tpl-focus-ring-host/g).length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Reduced motion — respected on every animation", () => {
    /**
     * PRODUCT.md principle 2 and DESIGN.md's do-list both require it on *every*
     * animation. File-level granularity is deliberate: it is the strongest
     * check a source scan can make without parsing CSS, and it catches the real
     * failure mode (a component defines a keyframe animation and forgets the
     * guard entirely).
     */
    it("every file defining @keyframes also guards prefers-reduced-motion", () => {
      const withKeyframes = FILES.filter((relPath) =>
        readFileSync(join(SRC, relPath), "utf8").includes("@keyframes"),
      );
      expect(withKeyframes.length).toBeGreaterThan(2);

      const unguarded = withKeyframes.filter(
        (relPath) =>
          !readFileSync(join(SRC, relPath), "utf8").includes("prefers-reduced-motion"),
      );
      expect(unguarded).toEqual([]);
    });
  });
});
