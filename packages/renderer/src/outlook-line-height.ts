import { findOpenTagEnd, roundHundredths } from "@templatical/types";

export const DEFAULT_TEXT_FONT_SIZE = 14;

/** A pixel line height for Word's alternate line-height declaration. */
export function outlookLineHeightPx(
  lineHeight: string | number,
  fontSizePx: number,
): string | null {
  if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) return null;
  const value = String(lineHeight).trim();
  const percent = value.endsWith("%");
  const numeric = percent ? value.slice(0, -1).trim() : value;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(numeric)) return null;
  const multiple = Number(numeric) / (percent ? 100 : 1);
  const pixels = multiple * fontSizePx;
  if (!Number.isFinite(pixels) || pixels <= 0) return null;
  return `${roundHundredths(pixels)}px`;
}

type StyleAttribute = {
  value: string;
  valueStart: number;
  valueEnd: number;
  quote: '"' | "'" | null;
};

type TextSummary = {
  hasText: boolean;
  spanSize: number | null;
  uniform: boolean;
};

type Frame = {
  tag: string;
  effectiveSpanSize: number | null;
  ownFontSize: number | null;
  cssFontSizePx: number;
  effectiveLineHeight: { value: string; percentPx: string | null } | null;
  summary: TextSummary;
  target?: {
    style: StyleAttribute | null;
    ownLineHeight: string | null;
    edit: Edit;
  };
};

type Edit = { start: number; end: number; value: string };

const TARGET_TAG = /^(?:p|li|h[1-6])$/;
const SPACE = /[ \t\n\f\r]/;
const VOID_TAGS = new Set(["area", "br", "hr", "img", "input", "meta", "link"]);

function tagAttributes(
  tag: string,
  offset: number,
): { style: StyleAttribute | null; selfClosing: boolean } {
  let i = offset;
  let style: StyleAttribute | null = null;
  while (i < tag.length) {
    while (i < tag.length && SPACE.test(tag[i])) i++;
    if (tag[i] === "/" && i === tag.length - 1) {
      return { style, selfClosing: true };
    }
    const start = i;
    while (i < tag.length && !SPACE.test(tag[i]) && tag[i] !== "=") i++;
    if (start === i) break;
    const name = tag.slice(start, i).toLowerCase();
    while (i < tag.length && SPACE.test(tag[i])) i++;
    if (tag[i] !== "=") continue;
    i++;
    while (i < tag.length && SPACE.test(tag[i])) i++;
    const quote = tag[i];
    if (quote === '"' || quote === "'") {
      const end = tag.indexOf(quote, i + 1);
      if (name === "style") {
        style = {
          value: tag.slice(i + 1, end),
          valueStart: i + 1,
          valueEnd: end,
          quote,
        };
      }
      i = end + 1;
    } else {
      const valueStart = i;
      while (i < tag.length && !SPACE.test(tag[i])) i++;
      if (name === "style") {
        style = {
          value: tag.slice(valueStart, i),
          valueStart,
          valueEnd: i,
          quote: null,
        };
      }
    }
  }
  return { style, selfClosing: false };
}

function declaration(style: string, property: string): string | null {
  let value: string | null = null;
  let important = false;
  for (const part of style.split(";")) {
    const separator = part.indexOf(":");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim().toLowerCase() === property) {
      const raw = part.slice(separator + 1).trim();
      const hasPriority = /!\s*important\s*$/i.test(raw);
      if (value === null || hasPriority || !important) {
        value = raw.replace(/!\s*important\s*$/i, "").trim();
        important = hasPriority;
      }
    }
  }
  return value;
}

function pxFontSize(value: string | null): number | null {
  if (value === null || !/^(?:\d+(?:\.\d*)?|\.\d+)px$/i.test(value)) {
    return null;
  }
  const size = Number(value.slice(0, -2));
  return Number.isFinite(size) && size > 0 ? size : null;
}

function addText(summary: TextSummary, size: number | null): void {
  if (!summary.hasText) {
    summary.hasText = true;
    summary.spanSize = size;
  }
  if (size === null || size !== summary.spanSize) summary.uniform = false;
}

function mergeSummary(parent: TextSummary, child: TextSummary): void {
  if (!child.hasText) return;
  if (!parent.hasText) {
    parent.hasText = true;
    parent.spanSize = child.spanSize;
    parent.uniform = child.uniform;
  } else if (!child.uniform || parent.spanSize !== child.spanSize) {
    parent.uniform = false;
  }
}

function uniformSpanFontSize(frame: Frame): number | null {
  return frame.summary.hasText && frame.summary.uniform
    ? frame.summary.spanSize
    : null;
}

function contentFontSize(frame: Frame): number {
  return uniformSpanFontSize(frame) ?? frame.cssFontSizePx;
}

function resolvedFontSize(frame: Frame): number {
  return frame.ownFontSize ?? contentFontSize(frame);
}

/** Add the alternate line height to rich-text blocks in one forward scan. */
export function addOutlookLineHeight(
  html: string,
  defaults: { lineHeight: string | number; fontSizePx: number },
): string {
  return addOutlookLineHeightWithFontSize(html, defaults).html;
}

/** Mark rich text and report the first paragraph's visible content size. */
export function addOutlookLineHeightWithFontSize(
  html: string,
  defaults: { lineHeight: string | number; fontSizePx: number },
): { html: string; firstParagraphFontSizePx: number | null } {
  const stack: Frame[] = [];
  const openings = new Map<string, number[]>();
  const edits: Edit[] = [];
  let firstParagraphFontSizePx: number | null = null;
  let cursor = 0;
  let open = html.indexOf("<");
  while (open !== -1) {
    const text = html.slice(cursor, open);
    if (text.trim() !== "" && stack.length > 0) {
      const frame = stack[stack.length - 1];
      addText(frame.summary, frame.effectiveSpanSize);
    }

    if (html.startsWith("<!--", open)) {
      const commentEnd = html.indexOf("-->", open + 4);
      if (commentEnd === -1) return { html, firstParagraphFontSizePx: null };
      cursor = commentEnd + 3;
      open = html.indexOf("<", cursor);
      continue;
    }

    const closing = html[open + 1] === "/";
    const nameStart = open + (closing ? 2 : 1);
    if (!/[a-z]/i.test(html[nameStart] ?? "")) {
      cursor = open + 1;
      open = html.indexOf("<", cursor);
      continue;
    }
    let nameEnd = nameStart + 1;
    while (/[a-z\d-]/i.test(html[nameEnd] ?? "")) nameEnd++;
    const tagName = html.slice(nameStart, nameEnd).toLowerCase();
    const end = findOpenTagEnd(html, nameEnd);
    if (end === -1) return { html, firstParagraphFontSizePx: null };

    if (closing) {
      const matchingIndex = openings.get(tagName)?.at(-1);
      if (matchingIndex !== undefined) {
        while (stack.length > matchingIndex) {
          const frame = stack.pop()!;
          openings.get(frame.tag)!.pop();
          const size = resolvedFontSize(frame);
          if (
            frame.tag === "p" &&
            stack.length === 0 &&
            firstParagraphFontSizePx === null
          ) {
            firstParagraphFontSizePx =
              uniformSpanFontSize(frame) ?? defaults.fontSizePx;
          }
          if (frame.target) {
            const { style, ownLineHeight, edit } = frame.target;
            const effective = frame.effectiveLineHeight;
            const pixels =
              ownLineHeight !== null
                ? ownLineHeight.trim().endsWith("%")
                  ? (effective?.percentPx ?? null)
                  : outlookLineHeightPx(ownLineHeight, size)
                : effective === null
                  ? outlookLineHeightPx(defaults.lineHeight, size)
                  : effective.value.trim().endsWith("%")
                    ? effective.percentPx
                    : outlookLineHeightPx(effective.value, size);
            if (pixels !== null) {
              const declaration = `mso-line-height-alt:${pixels}`;
              if (style === null) {
                edit.value = ` style="${declaration}"`;
              } else {
                const separator =
                  style.value.endsWith(";") || style.value === "" ? "" : ";";
                edit.value =
                  style.quote === null
                    ? `"${style.value}${separator}${declaration}"`
                    : `${separator}${declaration}`;
              }
            }
          }
          if (stack.length > 0) {
            mergeSummary(stack[stack.length - 1].summary, frame.summary);
          }
        }
      }
    } else {
      const tag = html.slice(open, end);
      const { style, selfClosing } = tagAttributes(tag, nameEnd - open);
      if (selfClosing || VOID_TAGS.has(tagName)) {
        cursor = end + 1;
        open = html.indexOf("<", cursor);
        continue;
      }
      const spanSize =
        tagName === "span"
          ? pxFontSize(declaration(style?.value ?? "", "font-size"))
          : null;
      const inheritedSpanSize = stack.at(-1)?.effectiveSpanSize ?? null;
      const ownFontSize = pxFontSize(
        declaration(style?.value ?? "", "font-size"),
      );
      const cssFontSizePx =
        ownFontSize ?? stack.at(-1)?.cssFontSizePx ?? defaults.fontSizePx;
      const ownLineHeight = declaration(style?.value ?? "", "line-height");
      const frame: Frame = {
        tag: tagName,
        effectiveSpanSize:
          spanSize ??
          (inheritedSpanSize === null
            ? null
            : (ownFontSize ?? inheritedSpanSize)),
        ownFontSize,
        cssFontSizePx,
        effectiveLineHeight:
          ownLineHeight === null
            ? (stack.at(-1)?.effectiveLineHeight ?? null)
            : {
                value: ownLineHeight,
                percentPx: ownLineHeight.trim().endsWith("%")
                  ? outlookLineHeightPx(ownLineHeight, cssFontSizePx)
                  : null,
              },
        summary: {
          hasText: false,
          spanSize: null,
          uniform: true,
        },
      };
      if (
        TARGET_TAG.test(tagName) &&
        !(style?.quote === null && /["'`]/.test(style.value)) &&
        declaration(style?.value ?? "", "mso-line-height-alt") === null
      ) {
        const editStart =
          style === null
            ? end
            : open + (style.quote === null ? style.valueStart : style.valueEnd);
        const edit = {
          start: editStart,
          end: style === null ? end : open + style.valueEnd,
          value: "",
        };
        edits.push(edit);
        frame.target = {
          style,
          ownLineHeight,
          edit,
        };
      }
      const indexes = openings.get(tagName) ?? [];
      indexes.push(stack.length);
      openings.set(tagName, indexes);
      stack.push(frame);
    }
    cursor = end + 1;
    open = html.indexOf("<", cursor);
  }

  let output = "";
  let copied = 0;
  for (const edit of edits) {
    if (edit.value === "") continue;
    output += html.slice(copied, edit.start) + edit.value;
    copied = edit.end;
  }
  return { html: output + html.slice(copied), firstParagraphFontSizePx };
}
