import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `.tpl` must neutralize every inheritable typography property the host page
 * can set.
 *
 * Shadow DOM blocks host *rules* — a selector in the consumer's stylesheet
 * never matches inside the shadow root — but inheritance follows the flattened
 * tree, so every inheritable property walks straight across the boundary. The
 * editor's own reset is therefore the only defense, in both DOM modes, and it
 * stops exactly the properties it declares and nothing else.
 *
 * Measured against the built editor under a host setting the kind of global
 * typography design systems really ship (`letter-spacing: 0.12em`,
 * `text-transform: uppercase`, …). Twelve properties crossed:
 *
 *   letter-spacing · word-spacing · text-transform · font-style · font-weight
 *   text-indent · text-align · white-space · list-style-type · cursor
 *   font-variant-numeric · text-shadow
 *
 * `text-decoration` did **not** cross (it propagates rather than inherits) and
 * is deliberately absent below.
 *
 * The stake is not just ugly chrome. The leak reaches `.tpl-canvas`, so a host
 * with `text-transform: uppercase` renders the editor's WYSIWYG preview in
 * uppercase while the email the recipient receives is not — the canvas
 * misrepresents the output, which is worse than looking wrong.
 *
 * **`direction` is deliberately NOT reset.** An RTL host should propagate its
 * writing direction into the editor; that is inheritance working as intended.
 * `visibility` is likewise left alone — a hidden host should hide the editor.
 *
 * Do not "fix" this class by telling consumers to reset the container. A reset
 * would have to sit on the container itself to affect inheritance, which
 * collides head-on with the documented theming surface (`--tpl-user-*` set on
 * the container or an ancestor): `all: initial` / `all: revert` there wipes
 * every custom property and breaks theming outright.
 *
 * Behavioural coverage:
 * `apps/playground/e2e/tests/host-style-inheritance.spec.ts`.
 */

const STYLES = readFileSync(
  join(import.meta.dirname, "..", "src", "styles", "index.css"),
  "utf8",
);

/** property -> the value that neutralizes it. */
const NEUTRALIZED: Record<string, string> = {
  "letter-spacing": "normal",
  "word-spacing": "normal",
  "text-transform": "none",
  "font-style": "normal",
  "font-weight": "400",
  "text-indent": "0",
  // `start`, not `left` — `left` would break an RTL host, whose `direction` we
  // deliberately let inherit.
  "text-align": "start",
  "white-space": "normal",
  "list-style-type": "disc",
  "cursor": "auto",
  "font-variant-numeric": "normal",
  "text-shadow": "none",
};

/** The base `.tpl { … }` rule — the one carrying the min-height floor. */
const tplBlock =
  (STYLES.match(/\n\.tpl\s*\{[^}]*\}/g) ?? []).find((block) =>
    block.includes("min-height"),
  ) ?? "";

describe("host typography cannot inherit into the editor", () => {
  it("finds the base .tpl rule", () => {
    expect(tplBlock).not.toBe("");
  });

  it.each(Object.entries(NEUTRALIZED))(
    "declares %s: %s",
    (property, value) => {
      const declaration = new RegExp(
        `(^|[;{\\s])${property}\\s*:\\s*${value}\\s*(!important\\s*)?;`,
        "m",
      );
      expect(tplBlock).toMatch(declaration);
    },
  );

  it("leaves `direction` and `visibility` to inherit", () => {
    // RTL hosts must propagate their writing direction, and a hidden host
    // should hide the editor. Neutralizing either would be a regression.
    expect(tplBlock).not.toMatch(/(^|[;{\s])direction\s*:/m);
    expect(tplBlock).not.toMatch(/(^|[;{\s])visibility\s*:/m);
  });
});
