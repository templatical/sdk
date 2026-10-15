// Accessibility over a custom block's rendered HTML, on every specimen state.
// Built-in blocks get @templatical/quality's rules from structured fields; a
// custom block is opaque HTML, so these read the markup itself. All are
// warnings: they read inline markup only, and a block's colours or table use
// can come from context they can't see.

import { Parser } from "htmlparser2";
import {
  getContrastRatio,
  isOpaqueHex,
  lintAccessibility,
} from "@templatical/quality";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
} from "@templatical/types";
import type { RenderedState } from "./render";
import { declarations } from "./safety";
import type { CustomBlockIssue } from "./types";

const HEX = /#[0-9a-f]{3,8}\b/i;
const PX = /^\s*(\d+(?:\.\d+)?)px/i;

interface Frame {
  color?: string;
  background?: string;
  fontSize?: number;
}

/** The colours and font size an element sets inline, over its parent's. */
function frameFor(attrs: Record<string, string>, parent: Frame): Frame {
  const frame: Frame = { ...parent };
  if (attrs.bgcolor && isOpaqueHex(attrs.bgcolor))
    frame.background = attrs.bgcolor;
  for (const [prop, raw] of declarations(attrs.style ?? "")) {
    const value = raw.replace(/!important/i, "").trim();
    if (prop === "color" && isOpaqueHex(value)) frame.color = value;
    if (prop === "background-color" && isOpaqueHex(value))
      frame.background = value;
    if (prop === "background") {
      const hex = value.replace(/url\([^)]*\)/gi, "").match(HEX)?.[0];
      if (hex && isOpaqueHex(hex)) frame.background = hex;
    }
    if (prop === "font-size") {
      const px = value.match(PX)?.[1];
      if (px) frame.fontSize = Number(px);
    }
  }
  return frame;
}

/** quality's own vague-link rule, run over the HTML as if it were a paragraph. */
function vagueLinkMessages(html: string): string[] {
  const content = createDefaultTemplateContent();
  content.blocks = [createParagraphBlock({ content: html })];
  return lintAccessibility(content)
    .filter((i) => i.ruleId === "a11y.link-vague-text")
    .map((i) => i.message);
}

export function checkAccessibility(
  rendered: RenderedState[],
): CustomBlockIssue[] {
  const issues: CustomBlockIssue[] = [];
  const add = (ruleId: string, message: string) =>
    issues.push({ ruleId, severity: "warning", message });

  for (const { state, html } of rendered) {
    for (const message of vagueLinkMessages(html)) {
      add("a11y.link-vague-text", message);
    }

    const frames: Frame[] = [{}];
    const tables: { presentation: boolean; hasHeader: boolean }[] = [];
    let link: { named: boolean } | null = null;

    const parser = new Parser(
      {
        onopentag(name, attrs) {
          frames.push(frameFor(attrs, frames[frames.length - 1]));
          if (name === "table") {
            const role = (attrs.role ?? "").toLowerCase();
            tables.push({
              presentation: role === "presentation" || role === "none",
              hasHeader: false,
            });
          }
          if (name === "th" && tables.length > 0) {
            tables[tables.length - 1].hasHeader = true;
          }
          if (name === "a") {
            link = {
              named:
                (attrs["aria-label"] ?? "").trim() !== "" ||
                (attrs.title ?? "").trim() !== "",
            };
          }
          if (name === "img" && link && (attrs.alt ?? "").trim() !== "") {
            link.named = true;
          }
        },
        ontext(text) {
          const trimmed = text.trim();
          if (trimmed === "") return;
          if (link) link.named = true;
          const { color, background, fontSize } = frames[frames.length - 1];
          if (!color || !background) return;
          const required = (fontSize ?? 0) >= 24 ? 3 : 4.5;
          const ratio = getContrastRatio(color, background);
          if (Number.isNaN(ratio) || ratio >= required) return;
          add(
            "a11y.contrast",
            `Text in ${color} on ${background} has ${ratio.toFixed(2)}:1 contrast; it needs ${required}:1.`,
          );
        },
        onclosetag(name) {
          frames.pop();
          if (name === "table") {
            const table = tables.pop();
            if (table && !table.presentation && !table.hasHeader) {
              add(
                "a11y.table-role",
                'A layout `<table>` needs `role="presentation"`, or screen readers read it as a data table, cell by cell. A data table needs `<th>` headers instead.',
              );
            }
          }
          if (name === "a" && link) {
            if (!link.named) {
              add(
                "a11y.link-no-name",
                `A link has no text, \`aria-label\` or image \`alt\` in the "${state}" state, so a screen reader announces only "link".`,
              );
            }
            link = null;
          }
        },
      },
      { decodeEntities: true },
    );
    parser.write(html);
    parser.end();
  }

  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.ruleId}\0${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
