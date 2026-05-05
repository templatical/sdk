import { Parser } from "htmlparser2";

export interface AnchorInfo {
  href: string;
  text: string;
  target: string | null;
  rel: string | null;
  /** True if the anchor wraps an image with non-empty alt. */
  hasImageWithAlt: boolean;
}

/**
 * Extract every anchor from a TipTap-style HTML fragment. Used by
 * link-* rules. Doesn't try to be a full DOM — only the data the rules
 * need.
 */
export function extractAnchors(html: string): AnchorInfo[] {
  const anchors: AnchorInfo[] = [];
  // Each open anchor owns its own text buffer so a nested `<a>` (invalid
  // HTML but parsed permissively) doesn't truncate the outer anchor's text.
  const stack: { anchor: AnchorInfo; buffer: string }[] = [];

  const parser = new Parser({
    onopentag(name, attribs) {
      if (name === "a") {
        const anchor: AnchorInfo = {
          href: attribs.href ?? "",
          text: "",
          target: attribs.target ?? null,
          rel: attribs.rel ?? null,
          hasImageWithAlt: false,
        };
        stack.push({ anchor, buffer: "" });
        return;
      }

      if (name === "img" && stack.length > 0) {
        const alt = (attribs.alt ?? "").trim();
        if (alt !== "") {
          stack[stack.length - 1].anchor.hasImageWithAlt = true;
        }
      }
    },
    ontext(text) {
      for (const frame of stack) {
        frame.buffer += text;
      }
    },
    onclosetag(name) {
      if (name === "a" && stack.length > 0) {
        const frame = stack.pop()!;
        frame.anchor.text = frame.buffer.trim();
        anchors.push(frame.anchor);
      }
    },
  });

  parser.write(html);
  parser.end();

  return anchors;
}

/**
 * Strip tags and return the visible text content of an HTML fragment.
 * Used by heading-empty and other text-presence rules.
 */
export function extractText(html: string): string {
  let text = "";
  const parser = new Parser({
    ontext(chunk) {
      text += chunk;
    },
  });
  parser.write(html);
  parser.end();
  return text.trim();
}
