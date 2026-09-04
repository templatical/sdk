import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "vue/compiler-sfc";
import type { ElementNode, RootNode, TemplateChildNode } from "vue/compiler-sfc";

/**
 * Nothing between the editor root and `.tpl-popover-root` may clip.
 *
 * Every dialog teleports into `.tpl-popover-root` and renders `position:
 * fixed; inset: 0`, which is supposed to cover the viewport regardless of how
 * small the consumer's container is. **Safari does not let a `fixed`
 * descendant escape an ancestor's `overflow: hidden` when painting**, even
 * though it correctly resolves the layout against the viewport. So the dialog
 * is positioned right and then painted clipped to that ancestor's box.
 *
 * That ancestor used to be our own editor root, which carried
 * `tpl:overflow-hidden`. Issue #633: with the editor mounted below a ~105px
 * host header, the merge-tag picker's dimming backdrop darkened only the
 * editor's own area and the dialog's title bar was cut off above the
 * container's top edge. Chrome, Firefox and Playwright's WebKit all paint it
 * correctly, which is why it survived — see the note on coverage below.
 *
 * The fix is to move the clip rather than remove it: an inner chrome wrapper
 * keeps `overflow: hidden` for the header, rails, canvas and footer, while
 * `.tpl-popover-root` stays a direct child of the (unclipped) root. That also
 * keeps the popover root inside `.tpl`, which is load-bearing for a second
 * reason: `--tpl-base-size` is declared there and `@theme inline` rebases the
 * whole Tailwind length scale onto it, so a popover hoisted out of `.tpl`
 * would lose every colour token *and* the sizing scale unless it re-declared
 * the class itself. `ColorPicker` and the merge-tag suggestion popup do not.
 *
 * **This is not reachable from a browser test.** Playwright's WebKit does not
 * reproduce it at 18.0 or 26.5 (verified against the reporter's own repro), so
 * adding a WebKit e2e project would not guard it. Real Safari 27 does. That
 * makes this structural guard the only automated coverage, so keep it strict.
 */

const EDITOR_VUE = join(import.meta.dirname, "..", "src", "Editor.vue");

/** Class names that clip a `position: fixed` descendant in Safari. */
const CLIPPING = /(^|:)overflow(-x|-y)?-(hidden|clip|scroll|auto)$/;

function isElement(node: TemplateChildNode | RootNode): node is ElementNode {
  return node.type === 1;
}

/** Static `class="…"` tokens. A bound `:class` cannot express a clip here. */
function staticClasses(node: ElementNode): string[] {
  const attr = node.props.find(
    (prop) => prop.type === 6 && prop.name === "class",
  );
  if (!attr || attr.type !== 6) return [];
  return (attr.value?.content ?? "").split(/\s+/).filter(Boolean);
}

function clips(node: ElementNode): boolean {
  return staticClasses(node).some((token) => CLIPPING.test(token));
}

function hasClass(node: ElementNode, name: string): boolean {
  return staticClasses(node).includes(name);
}

function parseRoot(): ElementNode {
  const sfc = parse(readFileSync(EDITOR_VUE, "utf8"));
  const ast = sfc.descriptor.template?.ast;
  if (!ast) throw new Error("Editor.vue has no <template>");
  const root = ast.children.filter(isElement)[0];
  if (!root) throw new Error("Editor.vue's template has no root element");
  return root;
}

/** Path from the root down to the first element matching `match`, inclusive. */
function pathTo(
  root: ElementNode,
  match: (node: ElementNode) => boolean,
): ElementNode[] | null {
  if (match(root)) return [root];
  for (const child of root.children.filter(isElement)) {
    const found = pathTo(child, match);
    if (found) return [root, ...found];
  }
  return null;
}

const root = parseRoot();
const pathToPopoverRoot = pathTo(root, (node) =>
  hasClass(node, "tpl-popover-root"),
);

describe("popover root is outside every clip (#633)", () => {
  it("Editor.vue's template has a .tpl-popover-root", () => {
    expect(pathToPopoverRoot).not.toBeNull();
    expect(pathToPopoverRoot!.at(-1)!.tag).toBe("div");
  });

  it("the editor root itself does not clip", () => {
    expect(staticClasses(root)).toContain("tpl");
    expect(clips(root)).toBe(false);
  });

  it("no ancestor of the popover root clips", () => {
    const clipping = pathToPopoverRoot!
      .filter(clips)
      .map((node) => `<${node.tag} class="${staticClasses(node).join(" ")}">`);
    expect(clipping).toEqual([]);
  });

  it("the chrome is still clipped by an inner wrapper", () => {
    // Removing the clip outright would let the canvas and rails spill out of
    // the consumer's container. The fix relocates it; it does not delete it.
    // Asserted via the header specifically: the canvas already carries
    // `overflow-auto` of its own, so a looser "some child clips" check would
    // pass off `.tpl-body` even if the wrapper were missing entirely.
    const pathToHeader = pathTo(root, (node) => node.tag === "EditorHeader");
    expect(pathToHeader).not.toBeNull();
    const wrappers = pathToHeader!
      .slice(1) // strictly below the root — the root must not be the clipper
      .filter(clips);
    expect(wrappers.length).toBeGreaterThan(0);
  });

  it("the small-screen notice still paints over the dialogs (#235)", () => {
    // The notice is `absolute inset-0` at z-index 10001 and relies on being a
    // later sibling of the popover root. Moving it inside the clipped chrome
    // wrapper would put the popover root after it in paint order, so dialogs
    // would show through the gate.
    const children = root.children.filter(isElement);
    const popoverIndex = children.findIndex((node) =>
      hasClass(node, "tpl-popover-root"),
    );
    const noticeIndex = children.findIndex(
      (node) => node.tag === "SmallScreenNotice",
    );
    expect(popoverIndex).toBeGreaterThanOrEqual(0);
    expect(noticeIndex).toBeGreaterThan(popoverIndex);
  });
});
