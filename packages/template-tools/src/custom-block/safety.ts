// Authoring checks over custom block HTML and CSS. Client support facts live
// in @templatical/quality and are applied by checkCustomBlock.
import { Parser } from "htmlparser2";
import type { RenderedState } from "./render";
import type { CustomBlockIssue, CustomBlockWorkingFile } from "./types";

/** Style-attribute declarations reused by the custom-block accessibility checks. */
export function declarations(style: string): [string, string][] {
  const out: [string, string][] = [];
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon > 0)
      out.push([
        part.slice(0, colon).trim().toLowerCase(),
        part.slice(colon + 1),
      ]);
  }
  return out;
}

/** Drops `/* … *\/` comments in one linear pass; an unterminated comment drops the rest. */
export function stripCssComments(css: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const open = css.indexOf("/*", i);
    if (open === -1) return out + css.slice(i);
    out += css.slice(i, open);
    const close = css.indexOf("*/", open + 2);
    if (close === -1) return out;
    i = close + 2;
  }
}

/**
 * Remove `url(...)` and quoted strings so the class scan can't read `.png` or
 * `"x.y"` as a selector. Linear: each opener's next position is searched for
 * again only once the cursor has passed it, so an opener that never closes
 * costs one scan, not one per occurrence. An unterminated `url(` or quote
 * drops the rest, as a CSS parser would.
 */
export function stripCssUrlsAndStrings(css: string): string {
  const lower = css.toLowerCase();
  const next = (needle: string, from: number) => {
    const at = lower.indexOf(needle, from);
    return at === -1 ? Infinity : at;
  };
  const closers: Record<string, string> = { "url(": ")", '"': '"', "'": "'" };
  const pos: Record<string, number> = { "url(": 0, '"': 0, "'": 0 };
  for (const k of Object.keys(pos)) pos[k] = next(k, 0);
  let out = "";
  let i = 0;
  for (;;) {
    let opener = "";
    let open = Infinity;
    for (const k of Object.keys(pos)) {
      if (pos[k] < i) pos[k] = next(k, i);
      if (pos[k] < open) {
        open = pos[k];
        opener = k;
      }
    }
    if (open === Infinity) return out + css.slice(i);
    out += css.slice(i, open);
    const close = lower.indexOf(closers[opener], open + opener.length);
    if (close === -1) return out;
    i = close + 1;
  }
}

export function checkEmailSafety(
  def: CustomBlockWorkingFile,
  rendered: RenderedState[],
): CustomBlockIssue[] {
  const issues: CustomBlockIssue[] = [];
  const add = (
    ruleId: string,
    message: string,
    suggestion: string,
    path?: string,
  ) => {
    issues.push({
      ruleId,
      severity: "warning",
      message,
      suggestion,
      reference: "https://docs.templatical.com/guide/custom-blocks",
      ...(path ? { path } : {}),
    });
  };
  for (const { state, html } of rendered) {
    const parser = new Parser(
      {
        onopentag(name, attrs) {
          if (name === "style")
            add(
              "safety.style-tag",
              "A <style> element is inside the custom block HTML.",
              "Move its rules into the definition's stylesheet, which the renderer places in <mj-head>.",
            );
          if (name !== "img") return;
          if (!("alt" in attrs))
            add(
              "safety.img-alt",
              "An <img> element has no alt attribute.",
              'Add alt text, or alt="" for a decorative image.',
            );
          if (!("width" in attrs))
            add(
              "safety.img-width",
              "An <img> element has no width attribute.",
              "Add a width attribute for Outlook.",
            );
          if ((attrs.src ?? "") === "")
            add(
              "safety.empty-img-src",
              `An <img> element has an empty src in the "${state}" state.`,
              "Wrap the image in a Liquid condition that checks the source against blank.",
            );
        },
      },
      { decodeEntities: true },
    );
    parser.end(html);
  }
  if (def.stylesheet) {
    const stripped = stripCssUrlsAndStrings(stripCssComments(def.stylesheet));
    const prefix = `tplc-${def.type}-`;
    const unscoped = [
      ...new Set(
        [...stripped.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(
          (match) => match[1],
        ),
      ),
    ].filter((name) => !name.startsWith(prefix));
    if (unscoped.length > 0)
      add(
        "safety.unscoped-class",
        `Classes ${unscoped.map((name) => `.${name}`).join(", ")} aren't prefixed \`${prefix}\`; the SDK doesn't scope them, so they can collide with other blocks.`,
        `Prefix each class with ${prefix}.`,
        "/stylesheet",
      );
  }
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.ruleId}\0${issue.path ?? ""}\0${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
