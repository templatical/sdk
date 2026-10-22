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

export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, "");
}

export function stripCssUrlsAndStrings(css: string): string {
  return css.replace(/url\([^)]*\)|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'/gi, "");
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
