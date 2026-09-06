import { load } from "cheerio";
import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";
import {
  createMenuBlock,
  createParagraphBlock,
  createTableBlock,
  createTitleBlock,
  generateId,
  RICH_TEXT_SPACING,
} from "@templatical/types";
import type {
  HeadingLevel,
  MenuItemData,
  TableRowData,
} from "@templatical/types";
import {
  parseAlignment,
  parseColor,
  parseFontFamily,
  parsePxValue,
} from "./attribute-parser";
import {
  ownAttr,
  readParagraphGap,
  type Attrs,
  type AttributeCascade,
} from "./attribute-resolver";
import { baseFields, type ConvertContext, type Converted } from "./block-base";

/**
 * Re-parse an `mj-text`'s inner markup into its own document.
 *
 * The surrounding document already parses void elements correctly (`br`,
 * `img`, … stay void under `converter.ts`'s `xmlMode: false`), so this reparse
 * isn't compensating for a different parser here. It gives each
 * shape-detection helper (title / table / menu) an isolated, freshly
 * queryable document scoped to just this block's own markup — so
 * `$inner("tr")` can only match rows that belong to this table, and
 * `$inner("body")` has a real root to enumerate top-level nodes from. A
 * paragraph's markup needs none of that structure-probing, so it is passed
 * through verbatim and never reparsed.
 */
function parseInner(html: string) {
  return load(`<body>${html}</body>`);
}

function rootElements(html: string): { tag: string; count: number } {
  const $inner = parseInner(html);
  const kids = $inner("body").children().toArray();
  return {
    tag: kids.length > 0 ? (kids[0].tagName?.toLowerCase() ?? "") : "",
    count: kids.length,
  };
}

const HEADING_LEVELS: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

function convertTitle(
  html: string,
  attrs: Attrs,
  sourceLevel: number,
  cascade: AttributeCascade,
): Converted {
  const $inner = parseInner(html);
  const $heading = $inner("body").children().first();
  const level = Math.min(sourceLevel, 4) as HeadingLevel;
  // Read via ownAttr, not attrs directly: title.ts emits color/font-family
  // only when the block sets its own, so a value that only reached this
  // element through the document-wide `<mj-attributes>` cascade (§7) is not
  // this title's own and must not be read back onto it.
  const color = parseColor(ownAttr(attrs, "color", "mj-text", cascade));
  const fontFamily = parseFontFamily(
    ownAttr(attrs, "font-family", "mj-text", cascade),
  );

  const block = createTitleBlock({
    content: $heading.html() ?? "",
    level,
    textAlign: parseAlignment(attrs.align, "left"),
    ...(color ? { color } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...baseFields(attrs),
  });

  const clamped = sourceLevel > 4;

  return {
    block,
    entry: {
      sourceTag: "mj-text",
      templaticalBlockType: "title",
      status: clamped ? "approximated" : "converted",
      ...(clamped
        ? {
            note: `Heading level h${sourceLevel} clamped to 4 — Templatical titles support h1-h4.`,
          }
        : {}),
    },
  };
}

function convertTable(
  html: string,
  attrs: Attrs,
  cascade: AttributeCascade,
): Converted {
  const $inner = parseInner(html);
  const $rows = $inner("tr");

  const rows: TableRowData[] = $rows.toArray().map((rowEl) => ({
    id: generateId(),
    cells: $inner(rowEl)
      .children()
      .toArray()
      .map((cellEl) => ({
        id: generateId(),
        content: $inner(cellEl).html() ?? "",
      })),
  }));

  const hasHeaderRow =
    $rows.length > 0 && $inner($rows[0]).children("th").length > 0;

  // ownAttr, not attrs directly — same cascade-vs-own distinction as
  // convertTitle above: table.ts also emits color/font-family only when the
  // block sets its own (renderers/table.ts:34,29).
  const color = parseColor(ownAttr(attrs, "color", "mj-text", cascade));
  const fontSize = parsePxValue(attrs["font-size"]);
  const fontFamily = parseFontFamily(
    ownAttr(attrs, "font-family", "mj-text", cascade),
  );

  const block = createTableBlock({
    rows,
    hasHeaderRow,
    textAlign: parseAlignment(attrs.align, "left"),
    ...(color ? { color } : {}),
    ...(fontSize > 0 ? { fontSize } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...baseFields(attrs),
  });

  return {
    block,
    entry: {
      sourceTag: "mj-text",
      templaticalBlockType: "table",
      status: "converted",
    },
  };
}

/**
 * A menu is top-level anchors with optional `<span>` separators between them —
 * exactly what `renderers/menu.ts` emits, and deliberately not matched when a
 * `<p>` wrapper is present (that is a paragraph containing links).
 */
function looksLikeMenu(html: string): boolean {
  const $inner = parseInner(html);
  const kids = $inner("body").children().toArray();
  if (kids.length === 0) return false;

  let anchors = 0;
  for (const kid of kids) {
    const tag = kid.tagName?.toLowerCase() ?? "";
    if (tag === "a") anchors += 1;
    else if (tag !== "span") return false;
  }

  return anchors > 0;
}

function convertMenu(
  html: string,
  attrs: Attrs,
  cascade: AttributeCascade,
): Converted {
  const $inner = parseInner(html);

  const items: MenuItemData[] = $inner("body")
    .children("a")
    .toArray()
    .map((el) => {
      const $a = $inner(el);
      const itemColor = parseColor(
        $a.attr("style")?.match(/color\s*:\s*([^;]+)/i)?.[1],
      );
      return {
        id: generateId(),
        text: ($a.text() ?? "").trim(),
        url: $a.attr("href") ?? "",
        openInNewTab: ($a.attr("target") ?? "").toLowerCase() === "_blank",
        bold: $a.find("strong, b").length > 0,
        underline: ($a.attr("style") ?? "").includes("underline"),
        ...(itemColor ? { color: itemColor } : {}),
      };
    });

  const $separator = $inner("body").children("span").first();
  const separator = ($separator.text() ?? "").trim();
  const separatorColor = parseColor(
    $separator.attr("style")?.match(/color\s*:\s*([^;]+)/i)?.[1],
  );
  const spacing = parsePxValue(
    $separator.attr("style")?.match(/padding\s*:\s*0\s+([\d.]+px)/i)?.[1],
  );

  // ownAttr, not attrs directly — same cascade-vs-own distinction as
  // convertTitle above: menu.ts also emits color/font-family only when the
  // block sets its own (renderers/menu.ts:29,24).
  const color = parseColor(ownAttr(attrs, "color", "mj-text", cascade));
  const fontSize = parsePxValue(attrs["font-size"]);
  const fontFamily = parseFontFamily(
    ownAttr(attrs, "font-family", "mj-text", cascade),
  );

  const block = createMenuBlock({
    items,
    textAlign: parseAlignment(attrs.align, "center"),
    ...(separator ? { separator } : {}),
    ...(separatorColor ? { separatorColor } : {}),
    ...(spacing > 0 ? { spacing } : {}),
    ...(color ? { color } : {}),
    ...(fontSize > 0 ? { fontSize } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...baseFields(attrs),
  });

  return {
    block,
    entry: {
      sourceTag: "mj-text",
      templaticalBlockType: "menu",
      status: "converted",
    },
  };
}

/**
 * The editor's rich-text blocks assume a block-level wrapper, so bare text gets
 * one. Mirrors `ensureParagraphWrapped` in `@templatical/import-html`.
 */
function ensureParagraphWrapped(html: string): string {
  const trimmed = html.trim();
  if (trimmed === "") return "<p></p>";
  if (/^<(p|h[1-6]|ul|ol|blockquote|div)\b/i.test(trimmed)) return trimmed;
  return `<p>${trimmed}</p>`;
}

function convertParagraph(html: string, attrs: Attrs): Converted {
  // A custom gap round-trips through `css-class` as `tpl-rich-text-<gap>`
  // (`richTextGapClass` in `packages/renderer/src/rich-text.ts`); the default
  // gap round-trips the same way, so it must be excluded here rather than
  // just relying on absence — otherwise every imported paragraph would carry
  // an explicit (if harmless) `paragraphSpacing` equal to the default.
  //
  // Paragraph text colour is document-level (`settings.textColor`) —
  // `ParagraphBlock` has no per-block colour field, so `attrs.color` is not
  // read here.
  const gap = readParagraphGap(attrs);
  const paragraphSpacing =
    gap !== null && gap !== RICH_TEXT_SPACING.paragraphGap ? gap : undefined;

  const block = createParagraphBlock({
    content: ensureParagraphWrapped(html),
    ...(paragraphSpacing !== undefined ? { paragraphSpacing } : {}),
    ...baseFields(attrs),
  });

  return {
    block,
    entry: {
      sourceTag: "mj-text",
      templaticalBlockType: "paragraph",
      status: "converted",
    },
  };
}

/**
 * Resolve an `mj-text` to Title, Table, Menu or Paragraph by the shape of its
 * content — the reverse of the four renderers that all emit `mj-text`.
 *
 * A fifth renderer emits it too: `HtmlBlock` (`renderers/html.ts`), whose
 * content is arbitrary, so it has no shape to match and lands on the Paragraph
 * fallback. That is irreducible — nothing in the output marks a block's type —
 * and narrowing the Title/Table shapes to compensate would break the common
 * case to serve the rare one. See §10 of the design.
 *
 * Paragraph is the terminal arm and always reachable, so this is total.
 */
export function convertTextElement(
  $el: Cheerio<Element>,
  attrs: Attrs,
  ctx: ConvertContext,
): Converted {
  const html = $el.html() ?? "";
  const root = rootElements(html);

  if (root.count === 1 && HEADING_LEVELS[root.tag]) {
    return convertTitle(html, attrs, HEADING_LEVELS[root.tag], ctx.cascade);
  }

  if (root.count === 1 && root.tag === "table") {
    return convertTable(html, attrs, ctx.cascade);
  }

  if (looksLikeMenu(html)) {
    return convertMenu(html, attrs, ctx.cascade);
  }

  return convertParagraph(html, attrs);
}
