import { expect } from "@playwright/test";
import { test } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Host page typography must not inherit into the editor.
 *
 * Shadow DOM blocks host *rules*; it does not block inheritance, which follows
 * the flattened tree. So every inheritable property set on an ancestor of the
 * container crosses the boundary unless `.tpl` neutralizes it, and the same is
 * true in light-DOM mode. Twelve properties were measured leaking before the
 * reset covered them.
 *
 * This runs in both DOM-mode projects on purpose: shadow mode is where the
 * isolation is *assumed* to hold and therefore where a regression would go
 * unnoticed, while light mode has no boundary at all.
 *
 * The structural counterpart is
 * `packages/editor/tests/inherited-property-scope.test.ts`; this spec is what
 * proves the declarations actually win against a real host cascade.
 */

/** Ordinary design-system typography, of the kind that really ships. */
const HOSTILE: Record<string, string> = {
  "letter-spacing": "0.12em",
  "word-spacing": "0.35em",
  "text-transform": "uppercase",
  "font-style": "italic",
  "font-weight": "800",
  "text-indent": "14px",
  "text-align": "right",
  "white-space": "pre",
  "list-style-type": "square",
  "cursor": "crosshair",
  "font-variant-numeric": "tabular-nums",
  "text-shadow": "1px 1px red",
};

/** What each property must still compute to inside the editor. */
const EXPECTED: Record<string, string> = {
  letterSpacing: "normal",
  wordSpacing: "0px",
  textTransform: "none",
  fontStyle: "normal",
  fontWeight: "400",
  textIndent: "0px",
  textAlign: "start",
  whiteSpace: "normal",
  listStyleType: "disc",
  cursor: "auto",
  fontVariantNumeric: "normal",
  textShadow: "none",
};

test.describe("host style inheritance", () => {
  test("editor chrome ignores hostile host typography", async ({
    page,
    editorReady,
  }) => {
    void editorReady;

    await page.addStyleTag({
      content: `html, body, ${SELECTORS.editorContainer} {\n${Object.entries(
        HOSTILE,
      )
        .map(([k, v]) => `  ${k}: ${v} !important;`)
        .join("\n")}\n}`,
    });

    const computed = await page.evaluate(
      ({ selector, keys }) => {
        const host = document.querySelector(selector)!;
        // Shadow mode puts `.tpl` inside the shadow root; light mode leaves it
        // in the host's own subtree. Same assertion either way.
        const root: ParentNode = host.shadowRoot ?? host;
        const tpl = root.querySelector(".tpl") as HTMLElement;
        const style = getComputedStyle(tpl);
        return Object.fromEntries(
          keys.map((k) => [k, style[k as never] as string]),
        );
      },
      { selector: SELECTORS.editorContainer, keys: Object.keys(EXPECTED) },
    );

    expect(computed).toEqual(EXPECTED);
  });

  test("the canvas renders email content unaffected", async ({
    page,
    editorReady,
  }) => {
    void editorReady;

    await page.addStyleTag({
      content: `html, body, ${SELECTORS.editorContainer} {\n${Object.entries(
        HOSTILE,
      )
        .map(([k, v]) => `  ${k}: ${v} !important;`)
        .join("\n")}\n}`,
    });

    // The canvas is the surface that has to stay honest: a leaked
    // `text-transform` would show the user an email the recipient never gets.
    const computed = await page.evaluate(
      ({ selector, keys }) => {
        const host = document.querySelector(selector)!;
        const root: ParentNode = host.shadowRoot ?? host;
        const canvas = (root.querySelector(".tpl-canvas") ??
          root.querySelector(".tpl-body")) as HTMLElement;
        const probe = document.createElement("p");
        probe.textContent = "email body copy";
        canvas.appendChild(probe);
        const style = getComputedStyle(probe);
        const out = Object.fromEntries(
          keys.map((k) => [k, style[k as never] as string]),
        );
        probe.remove();
        return out;
      },
      { selector: SELECTORS.editorContainer, keys: Object.keys(EXPECTED) },
    );

    expect(computed).toEqual(EXPECTED);
  });

  test("an RTL host still propagates its writing direction", async ({
    page,
    editorReady,
  }) => {
    void editorReady;

    // `direction` is deliberately left inheriting, so this is the one property
    // the reset must NOT neutralize. Without the carve-out an RTL embedder
    // would get an LTR editor.
    await page.addStyleTag({
      content: `html, body, ${SELECTORS.editorContainer} { direction: rtl !important; }`,
    });

    const direction = await page.evaluate((selector) => {
      const host = document.querySelector(selector)!;
      const root: ParentNode = host.shadowRoot ?? host;
      const tpl = root.querySelector(".tpl") as HTMLElement;
      return getComputedStyle(tpl).direction;
    }, SELECTORS.editorContainer);

    expect(direction).toBe("rtl");
  });
});
