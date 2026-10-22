import type { Scan, CssMatch } from "./scan";
import { stripCssUrlsAndStrings } from "./scan";

export interface Detection {
  excerpt: string;
  usage?: string;
  value?: string;
  tag?: string;
}

const clean = (value: string): string =>
  value.replace(/\s+/g, " ").trim().slice(0, 80);
const cssExcerpt = ({ prop, value }: CssMatch) => clean(`${prop}: ${value}`);
const element = (tag: string) => `<${tag}>`;
const colorValue = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

function imageMedia(value: string): string | null {
  const match = /^\s*data:(image\/[\w.+-]+)/i.exec(value);
  return match ? match[1].toLowerCase() : null;
}

function backgroundWithoutFallback(scan: Scan): CssMatch | undefined {
  const sources = new Map<string, CssMatch[]>();
  for (const declaration of scan.css) {
    const key = declaration.group;
    sources.set(key, [...(sources.get(key) ?? []), declaration]);
  }
  for (const declarations of sources.values()) {
    const image = declarations.find(
      (d) =>
        (d.prop === "background" || d.prop === "background-image") &&
        /url\(/i.test(d.value),
    );
    if (!image || "bgcolor" in image.attrs) continue;
    const fallback = declarations.some(
      (d) =>
        d.prop === "background-color" ||
        (d.prop === "background" &&
          colorValue.test(stripCssUrlsAndStrings(d.value))),
    );
    if (!fallback) return image;
  }
}

export function detect(scan: Scan, id: string): Detection | null {
  const css = scan.css;
  const tags = scan.tags;
  let match: CssMatch | undefined;
  let tag: string | undefined;
  switch (id) {
    case "compat.css-display-flex":
    case "compat.css-display-grid": {
      const kind = id.endsWith("flex") ? "flex" : "grid";
      match = css.find(
        (d) =>
          d.prop === "display" &&
          new RegExp(`^(?:inline-)?${kind}\\b`, "i").test(d.value),
      );
      return match
        ? {
            excerpt: cssExcerpt(match),
            usage: match.value
              .match(/^(?:inline-)?(?:flex|grid)/i)?.[0]
              .toLowerCase(),
          }
        : null;
    }
    case "compat.css-position":
      match = css.find(
        (d) =>
          d.prop === "position" && /^(absolute|fixed|sticky)\b/i.test(d.value),
      );
      return match
        ? {
            excerpt: cssExcerpt(match),
            usage: match.value.match(/^\w+/)?.[0].toLowerCase(),
            value: match.value.match(/^\w+/)?.[0].toLowerCase(),
          }
        : null;
    case "compat.css-variables":
      match = css.find((d) =>
        /\bvar\(\s*--/i.test(stripCssUrlsAndStrings(d.value)),
      );
      return match ? { excerpt: cssExcerpt(match) } : null;
    case "compat.css-at-import":
      return scan.cssTexts.some((text) =>
        /@import\b/i.test(stripCssUrlsAndStrings(text)),
      )
        ? { excerpt: "@import" }
        : null;
    case "compat.html-link":
      return tags.some(
        (t) =>
          t.tag === "link" &&
          /(?:^|\s)stylesheet(?:\s|$)/i.test(t.attrs.rel ?? ""),
      )
        ? { excerpt: '<link rel="stylesheet">' }
        : null;
    case "compat.html-style":
    case "compat.html-svg":
    case "compat.html-object":
    case "compat.html-video":
    case "compat.html-audio":
    case "compat.html-script":
    case "compat.html-iframe":
      tag = id.slice(12);
      return tags.some((t) => t.tag === tag) ? { excerpt: element(tag) } : null;
    case "compat.html-form":
      tag = tags.find((t) =>
        ["form", "input", "select", "textarea"].includes(t.tag),
      )?.tag;
      return tag ? { excerpt: element(tag) } : null;
    case "compat.css-width":
      match = css.find(
        (d) =>
          d.inline &&
          d.prop === "width" &&
          (["div", "p", "span", "body"].includes(d.tag) ||
            (d.tag === "img" && !("width" in d.attrs))),
      );
      return match ? { excerpt: cssExcerpt(match), tag: match.tag } : null;
    case "compat.css-max-width":
      match = css.find(
        (d) => d.inline && d.prop === "max-width" && d.tag !== "table",
      );
      return match ? { excerpt: cssExcerpt(match), tag: match.tag } : null;
    case "compat.css-float":
      match = css.find((d) => d.prop === "float");
      return match ? { excerpt: cssExcerpt(match), tag: match.tag } : null;
    case "compat.css-background-image":
      match = backgroundWithoutFallback(scan);
      return match ? { excerpt: cssExcerpt(match) } : null;
    case "compat.image-base64": {
      const cssUrls = scan.cssTexts.flatMap((text) =>
        [...text.matchAll(/url\(\s*['"]?\s*(data:image\/[\w.+-]+)/gi)].map(
          (match) => match[1],
        ),
      );
      const candidate = [...scan.urls, ...cssUrls]
        .map(imageMedia)
        .find((v) => v !== null);
      return candidate
        ? { excerpt: `data:${candidate}`, usage: candidate }
        : null;
    }
    default:
      return null;
  }
}
