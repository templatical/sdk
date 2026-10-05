// Email-client safety over a custom block's rendered HTML. Custom blocks are
// raw HTML the SDK passes through untouched (inside <mj-text>), so nothing
// downstream repairs a layout Outlook can't draw; this is the only check.
// Rules run on every specimen state's output so both sides of each {% if %}
// are seen, and an empty optional image surfaces as src="".

import { Parser } from "htmlparser2";
import type { RenderedState } from "./render";
import type { CustomBlockIssue, CustomBlockWorkingFile } from "./types";

const FLEX_GRID = /(^|;)\s*display\s*:\s*(inline-)?(flex|grid)\b/i;
const POSITION = /(^|;)\s*position\s*:\s*(absolute|fixed)\b/i;
const DIV_LAYOUT = /(^|;)\s*(width|max-width|float)\s*:/i;
const BG_IMAGE = /(^|;)\s*background(-image)?\s*:[^;]*url\(/i;
const BG_COLOR = /(^|;)\s*background-color\s*:/i;

// The same two layout rules over stylesheet text, where a declaration can
// also follow `{` or a newline.
const CSS_FLEX_GRID = /(^|[;{\s])display\s*:\s*(inline-)?(flex|grid)\b/i;
const CSS_POSITION = /(^|[;{\s])position\s*:\s*(absolute|fixed)\b/i;

const IMPORT_MESSAGE =
  "`@import` is dropped by most email clients; inline the rules.";
const FLEX_GRID_MESSAGE =
  "`display: flex`/`grid` is ignored by Outlook and Gmail on many clients; use tables.";
const POSITION_MESSAGE =
  "`position: absolute/fixed` is unsupported in email clients.";

/** Layout rules that hold for stylesheet text: the definition's and a `<style>`'s. */
function cssLayoutIssues(css: string, path?: string): CustomBlockIssue[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const issues: CustomBlockIssue[] = [];
  const at = path === undefined ? {} : { path };
  if (CSS_FLEX_GRID.test(text))
    issues.push({
      ruleId: "safety.flex-grid",
      severity: "error",
      ...at,
      message: FLEX_GRID_MESSAGE,
    });
  if (CSS_POSITION.test(text))
    issues.push({
      ruleId: "safety.position",
      severity: "error",
      ...at,
      message: POSITION_MESSAGE,
    });
  return issues;
}

function stylesheetIssues(
  def: CustomBlockWorkingFile,
  css: string,
): CustomBlockIssue[] {
  const issues: CustomBlockIssue[] = [];
  if (/@import\b/i.test(css)) {
    issues.push({
      ruleId: "safety.import",
      severity: "error",
      path: "/stylesheet",
      message: IMPORT_MESSAGE,
    });
  }
  issues.push(...cssLayoutIssues(css, "/stylesheet"));
  const stripped = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/url\([^)]*\)/gi, "")
    .replace(/"[^"]*"|'[^']*'/g, "");
  const prefix = `tplc-${def.type}-`;
  const unscoped = [
    ...new Set(
      [...stripped.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]),
    ),
  ].filter((cls) => !cls.startsWith(prefix));
  if (unscoped.length > 0) {
    issues.push({
      ruleId: "safety.unscoped-class",
      severity: "warning",
      path: "/stylesheet",
      message: `Classes ${unscoped.map((c) => `.${c}`).join(", ")} aren't prefixed \`${prefix}\`; the SDK doesn't scope them, so they can collide with other blocks.`,
    });
  }
  return issues;
}

export function checkEmailSafety(
  def: CustomBlockWorkingFile,
  rendered: RenderedState[],
): CustomBlockIssue[] {
  const issues: CustomBlockIssue[] = [];
  const add = (
    ruleId: string,
    severity: CustomBlockIssue["severity"],
    message: string,
  ) => issues.push({ ruleId, severity, message });

  for (const { state, html } of rendered) {
    let inStyle = false;
    let styleText = "";
    const parser = new Parser(
      {
        onopentag(name, attrs) {
          const style = attrs.style ?? "";
          if (FLEX_GRID.test(style))
            add("safety.flex-grid", "error", FLEX_GRID_MESSAGE);
          if (POSITION.test(style))
            add("safety.position", "error", POSITION_MESSAGE);
          if (BG_IMAGE.test(style) && !BG_COLOR.test(style))
            add(
              "safety.bg-image-fallback",
              "warning",
              "A background image needs a `background-color` fallback; many clients block images.",
            );
          if (name === "script")
            add(
              "safety.script",
              "error",
              "`<script>` is stripped by every email client.",
            );
          if (
            name === "link" &&
            (attrs.rel ?? "").toLowerCase() === "stylesheet"
          )
            add(
              "safety.external-stylesheet",
              "error",
              "External stylesheets are not loaded by email clients; use inline styles or `stylesheet`.",
            );
          if (name === "style") {
            inStyle = true;
            styleText = "";
            add(
              "safety.style-tag",
              "warning",
              "Move `<style>` rules into the definition's `stylesheet`, which the renderer places in `<mj-head>`.",
            );
          }
          if (name === "div" && DIV_LAYOUT.test(style))
            add(
              "safety.div-layout",
              "warning",
              "A `<div>` carrying width or float is unreliable in Outlook; lay out with tables.",
            );
          if (name === "img") {
            if (!("alt" in attrs))
              add(
                "safety.img-alt",
                "warning",
                'Every `<img>` needs an `alt` attribute (`alt=""` for decorative images), ideally bound to a field.',
              );
            if (!("width" in attrs))
              add(
                "safety.img-width",
                "warning",
                "Give `<img>` a `width` attribute; Outlook ignores CSS widths on images.",
              );
            if ((attrs.src ?? "") === "")
              add(
                "safety.empty-img-src",
                "warning",
                `An \`<img>\` renders with an empty \`src\` in the "${state}" state; wrap it in \`{% if <field> %}\`.`,
              );
          }
        },
        ontext(text) {
          if (inStyle) styleText += text;
        },
        onclosetag(name) {
          if (name === "style") {
            inStyle = false;
            if (/@import\b/i.test(styleText))
              add("safety.import", "error", IMPORT_MESSAGE);
            issues.push(...cssLayoutIssues(styleText));
          }
        },
      },
      { decodeEntities: true },
    );
    parser.write(html);
    parser.end();
  }
  if (def.stylesheet) issues.push(...stylesheetIssues(def, def.stylesheet));

  const seen = new Set<string>();
  return issues.filter((i) => {
    const k = `${i.ruleId}\0${i.path ?? ""}\0${i.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
