import { findOpenTagEnd } from "@templatical/types";

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
      ? tag.replace(
          /\sstyle=(['"])(.*?)\1/gi,
          (attribute, quote: string, value: string) => {
            const declarations = value.split(";");
            const kept = declarations.filter(
              (part) =>
                !/^\s*mso-line-height-alt\s*:\s*[\d.]+px\s*$/i.test(part),
            );
            if (kept.length === declarations.length) return attribute;
            let style = kept.join(";");
            const removedLast =
              kept.length > 0 &&
              /^\s*mso-line-height-alt\s*:\s*[\d.]+px\s*$/i.test(
                declarations.at(-1) ?? "",
              );
            if (removedLast && preserveFinalSemicolon && !style.endsWith(";")) {
              style += ";";
            }
            return style === "" ? "" : ` style=${quote}${style}${quote}`;
          },
        )
      : tag;
    if (cleaned !== tag) {
      output += html.slice(copied, open) + cleaned;
      copied = end + 1;
    }
    open = html.indexOf("<", end + 1);
  }
  return output + html.slice(copied);
}
