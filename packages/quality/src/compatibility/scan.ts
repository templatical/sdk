import { Parser } from "htmlparser2";
import type { Block } from "@templatical/types";

export interface TagMatch {
  tag: string;
  attrs: Record<string, string>;
}

export interface CssMatch {
  prop: string;
  value: string;
  tag: string;
  attrs: Record<string, string>;
  inline: boolean;
  group: string;
}

export interface Scan {
  tags: TagMatch[];
  css: CssMatch[];
  cssTexts: string[];
  urls: string[];
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
    let close = lower.indexOf(closers[opener], open + opener.length);
    if (opener !== "url(") {
      let cursor = open + 1;
      while (cursor < css.length) {
        if (css[cursor] === "\\") {
          cursor += 2;
        } else if (css[cursor] === opener) {
          close = cursor;
          break;
        } else {
          cursor++;
        }
      }
      if (cursor >= css.length) close = -1;
    }
    if (close === -1) return out;
    i = close + 1;
  }
}

export function declarations(
  css: string,
  tag: string,
  attrs: Record<string, string>,
  inline: boolean,
  group: string,
): CssMatch[] {
  const out: CssMatch[] = [];
  // Keep only a data URL's media type in values retained for issue excerpts.
  // This also keeps the semicolon in `;base64` from splitting a declaration.
  const text = stripCssComments(css).replace(
    /data:([\w.+-]+\/[\w.+-]+)[^)"']*/gi,
    "data:$1",
  );
  const expression = /(?:^|[;{])\s*([\w-]+)\s*:\s*([^;}]+)/g;
  for (const match of text.matchAll(expression)) {
    out.push({
      prop: match[1].toLowerCase(),
      value: match[2].trim(),
      tag,
      attrs,
      inline,
      group,
    });
  }
  return out;
}

export function scanHtml(
  html: string,
  stylesheet = "",
  urls: string[] = [],
): Scan {
  const scan: Scan = { tags: [], css: [], cssTexts: [], urls: [...urls] };
  let inStyle = false;
  let styleText = "";
  let cssSource = 0;
  const addCss = (
    css: string,
    tag: string,
    attrs: Record<string, string>,
    inline: boolean,
  ) => {
    scan.cssTexts.push(stripCssComments(css));
    const source = cssSource++;
    if (inline) {
      scan.css.push(...declarations(css, tag, attrs, true, `${source}`));
    } else {
      for (const [index, segment] of css.split("}").entries()) {
        scan.css.push(
          ...declarations(segment, tag, attrs, false, `${source}:${index}`),
        );
      }
    }
  };
  const parser = new Parser(
    {
      onopentag(tag, attrs) {
        scan.tags.push({ tag, attrs });
        if (attrs.style) addCss(attrs.style, tag, attrs, true);
        if (tag === "img" && attrs.src) scan.urls.push(attrs.src);
        if (attrs.background) scan.urls.push(attrs.background);
        if (tag === "style") {
          inStyle = true;
          styleText = "";
        }
      },
      ontext(text) {
        if (inStyle) styleText += text;
      },
      onclosetag(tag) {
        if (tag === "style") {
          inStyle = false;
          addCss(styleText, "style", {}, false);
        }
      },
    },
    { decodeEntities: true },
  );
  parser.end(html);
  if (stylesheet) addCss(stylesheet, "stylesheet", {}, false);
  return scan;
}

export function scanBlock(block: Block): Scan {
  const html: string[] = [];
  const stylesheets: string[] = [];
  const urls: string[] = [];
  switch (block.type) {
    case "html":
    case "paragraph":
    case "title":
      html.push(block.content);
      break;
    case "table":
      for (const row of block.rows)
        for (const cell of row.cells) html.push(cell.content);
      break;
    case "custom":
      if (block.renderedHtml) html.push(block.renderedHtml);
      if (block.renderedStylesheet) stylesheets.push(block.renderedStylesheet);
      break;
    case "image":
      urls.push(block.src);
      break;
    case "video":
      urls.push(block.thumbnailUrl);
      break;
    case "section":
      if (block.backgroundImage) urls.push(block.backgroundImage.url);
      if (block.wrapper?.backgroundImage)
        urls.push(block.wrapper.backgroundImage.url);
      break;
    case "wrapper":
      if (block.backgroundImage) urls.push(block.backgroundImage.url);
      break;
  }
  return scanHtml(html.join("\n"), stylesheets.join("\n"), urls);
}
