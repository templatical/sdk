import { findOpenTagEnd } from "@templatical/types";

const SPACE = /[ \t\n\f\r]/;
const OUTLOOK_ALT = /^\s*mso-line-height-alt\s*:\s*[\d.]+px\s*$/i;

function cleanedStyle(
  value: string,
  preserveFinalSemicolon: boolean,
): string | null {
  const declarations = value.split(";");
  const kept = declarations.filter((part) => !OUTLOOK_ALT.test(part));
  if (kept.length === declarations.length) return null;
  let style = kept.join(";");
  const removedLast =
    kept.length > 0 && OUTLOOK_ALT.test(declarations.at(-1) ?? "");
  if (removedLast && preserveFinalSemicolon && !style.endsWith(";")) {
    style += ";";
  }
  return style;
}

function stripTagStyle(tag: string, preserveFinalSemicolon: boolean): string {
  let output = "";
  let copied = 0;
  let i = 1;
  while (i < tag.length && !SPACE.test(tag[i]) && tag[i] !== ">") i++;
  while (i < tag.length) {
    const whitespaceStart = i;
    while (i < tag.length && SPACE.test(tag[i])) i++;
    if (tag[i] === ">" || tag[i] === "/") break;
    const nameStart = i;
    while (
      i < tag.length &&
      !SPACE.test(tag[i]) &&
      tag[i] !== "=" &&
      tag[i] !== ">"
    )
      i++;
    if (i === nameStart) break;
    const name = tag.slice(nameStart, i).toLowerCase();
    while (i < tag.length && SPACE.test(tag[i])) i++;
    if (tag[i] !== "=") continue;
    i++;
    while (i < tag.length && SPACE.test(tag[i])) i++;
    const quote = tag[i];
    if (quote !== '"' && quote !== "'") {
      while (i < tag.length && !SPACE.test(tag[i]) && tag[i] !== ">") i++;
      continue;
    }
    const valueStart = i + 1;
    const valueEnd = tag.indexOf(quote, valueStart);
    if (valueEnd === -1) break;
    if (name === "style") {
      const style = cleanedStyle(
        tag.slice(valueStart, valueEnd),
        preserveFinalSemicolon,
      );
      if (style !== null) {
        output += tag.slice(copied, whitespaceStart);
        if (style !== "") output += " style=" + quote + style + quote;
        copied = valueEnd + 1;
      }
    }
    i = valueEnd + 1;
  }
  return output + tag.slice(copied);
}

/** Keep Word-only export declarations out of editable rich text. */
export function stripOutlookLineHeight(
  html: string,
  preserveFinalSemicolon = false,
): string {
  let output = "";
  let copied = 0;
  let open = html.indexOf("<");
  while (open !== -1) {
    const end = findOpenTagEnd(html, open + 1);
    if (end === -1) break;
    const tag = html.slice(open, end + 1);
    const cleaned = /^<(?:p|li|h[1-6])(?:\s|>)/i.test(tag)
      ? stripTagStyle(tag, preserveFinalSemicolon)
      : tag;
    if (cleaned !== tag) {
      output += html.slice(copied, open) + cleaned;
      copied = end + 1;
    }
    open = html.indexOf("<", end + 1);
  }
  return output + html.slice(copied);
}
