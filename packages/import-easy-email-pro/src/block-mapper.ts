import {
  createButtonBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  createTitleBlock,
  createVideoBlock,
  findOpenTagEnd,
  generateId,
} from "@templatical/types";
import type {
  Block,
  BlockStyles,
  BlockVisibility,
  ButtonBlock,
  HeadingLevel,
  MenuItemData,
  SocialIcon,
  SocialPlatform,
  TableCellData,
  TableRowData,
} from "@templatical/types";
import { parseColor, parsePx, readPadding } from "./attribute-parser";
import { isUnset, readAttr, type ResolveContext } from "./normalize";
import { serialiseChildren } from "./rich-text";
import type {
  ConversionStatus,
  EasyEmailProNode,
  EasyEmailProTextNode,
  ImportReportEntry,
} from "./types";

export interface MapContext {
  resolve: ResolveContext;
  warnings: string[];
}

export interface Converted {
  blocks: Block[];
  entries: ImportReportEntry[];
}

const LEAF_TYPES = new Set([
  "standard-paragraph",
  "standard-h1",
  "standard-h2",
  "standard-h3",
  "standard-h4",
  "standard-button",
  "standard-image",
  "standard-divider",
  "standard-spacer",
  "standard-navbar",
  "standard-social",
  "standard-table2",
  "marketing-countdown",
  "placeholder",
  "common-video",
]);

const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "whatsapp",
  "telegram",
  "github",
] as const satisfies ReadonlyArray<SocialPlatform>;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

const COUNTDOWN_NOTE =
  "marketing-countdown GIF is the timer; Templatical countdown is Cloud-only";

export function isLeafType(type: string | undefined): boolean {
  if (typeof type !== "string") return false;
  if (LEAF_TYPES.has(type)) return true;
  return headingLevelFromType(type) !== null;
}

export function convertLeaf(
  node: EasyEmailProNode,
  map: MapContext,
): Converted {
  const type = node.type;
  if (type === "placeholder") return empty();
  if (type === "standard-paragraph") return convertParagraph(node, map);

  const heading = typeof type === "string" ? headingLevelFromType(type) : null;
  if (heading) return convertHeading(node, map, heading);

  switch (type) {
    case "standard-button":
      return convertButton(node, map);
    case "standard-image":
      return convertImage(node, map);
    case "standard-divider":
      return convertDivider(node, map);
    case "standard-spacer":
      return convertSpacer(node, map);
    case "standard-navbar":
      return convertNavbar(node, map);
    case "standard-social":
      return convertSocial(node, map);
    case "standard-table2":
      return convertTable(node, map);
    case "marketing-countdown":
      return convertCountdown(node, map);
    case "common-video":
      return convertVideo(node, map);
    default:
      return convertUnknown(node, map);
  }
}

function convertParagraph(node: EasyEmailProNode, map: MapContext): Converted {
  return finish(
    createParagraphBlock({
      content: serialiseChildren(node.children),
      ...leafStyles(node, map),
    }),
    node,
    report("standard-paragraph", "paragraph", "converted"),
  );
}

function convertHeading(
  node: EasyEmailProNode,
  map: MapContext,
  heading: { level: HeadingLevel; source: number },
): Converted {
  const color = parseColor(readAttr(node, "color", map.resolve));
  const align = parseAlign(readAttr(node, "align", map.resolve));
  const clamped = heading.source > 4;
  return finish(
    createTitleBlock({
      content: serialiseChildren(node.children),
      level: heading.level,
      ...(color ? { color } : {}),
      ...(align ? { textAlign: align } : {}),
      ...leafStyles(node, map),
    }),
    node,
    clamped
      ? report(
          node.type ?? "standard-h4",
          "title",
          "approximated",
          `Heading level h${heading.source} clamped to 4 — Templatical titles support h1-h4.`,
        )
      : report(node.type ?? "standard-h1", "title", "converted"),
  );
}

function convertButton(node: EasyEmailProNode, map: MapContext): Converted {
  const fill = parseColor(readAttr(node, "background-color", map.resolve));
  const textColor = parseColor(readAttr(node, "color", map.resolve));
  const href = readAttr(node, "href", map.resolve);
  const width = buttonWidth(readAttr(node, "width", map.resolve));
  const align = parseAlign(readAttr(node, "align", map.resolve));
  const outlined =
    isBorderEnabled(readAttr(node, "border-enabled", map.resolve)) &&
    isUnset(readAttr(node, "background-color", map.resolve));

  const block: ButtonBlock = createButtonBlock({
    text: stripTags(serialiseChildren(node.children)),
    url: setString(href) ?? "",
    ...(fill ? { backgroundColor: fill } : {}),
    ...(textColor ? { textColor } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(align ? { align } : {}),
    ...leafStyles(node, map),
  });
  // createButtonBlock defaults fill to #333333; an unset Pro fill with
  // border-enabled is an outlined button, which has no Templatical equivalent.
  if (outlined) block.backgroundColor = "#ffffff";

  return finish(
    block,
    node,
    outlined
      ? report(
          "standard-button",
          "button",
          "approximated",
          "outlined button has no Templatical equivalent",
        )
      : report("standard-button", "button", "converted"),
  );
}

function convertImage(node: EasyEmailProNode, map: MapContext): Converted {
  const src = setString(readAttr(node, "src", map.resolve)) ?? "";
  const alt = setString(readAttr(node, "alt", map.resolve)) ?? "";
  const href = readAttr(node, "href", map.resolve);
  const linkUrl = setString(href);
  const radius = parsePx(readAttr(node, "border-radius", map.resolve));
  const align = parseAlign(readAttr(node, "align", map.resolve));
  const target = setString(readAttr(node, "target", map.resolve));

  return finish(
    createImageBlock({
      src,
      alt,
      ...(align ? { align } : {}),
      ...(radius !== undefined && radius > 0 ? { borderRadius: radius } : {}),
      ...(linkUrl ? { linkUrl } : {}),
      ...(linkUrl && target === "_blank" ? { linkOpenInNewTab: true } : {}),
      ...leafStyles(node, map),
    }),
    node,
    report("standard-image", "image", "converted"),
  );
}

function convertDivider(node: EasyEmailProNode, map: MapContext): Converted {
  const color = parseColor(readAttr(node, "border-color", map.resolve));
  const thickness = parsePx(readAttr(node, "border-width", map.resolve));
  const lineStyle = asLineStyle(readAttr(node, "border-style", map.resolve));
  return finish(
    createDividerBlock({
      ...(color ? { color } : {}),
      ...(thickness !== undefined ? { thickness } : {}),
      ...(lineStyle ? { lineStyle } : {}),
      ...leafStyles(node, map),
    }),
    node,
    report("standard-divider", "divider", "converted"),
  );
}

function convertSpacer(node: EasyEmailProNode, map: MapContext): Converted {
  const height = parsePx(readAttr(node, "height", map.resolve));
  return finish(
    createSpacerBlock({
      ...(height !== undefined ? { height } : {}),
      ...leafStyles(node, map),
    }),
    node,
    report("standard-spacer", "spacer", "converted"),
  );
}

function convertNavbar(node: EasyEmailProNode, map: MapContext): Converted {
  const items: MenuItemData[] = [];
  for (const child of node.children ?? []) {
    if (!isElement(child) || child.type !== "standard-navbar-link") continue;
    const href = readAttr(child, "href", map.resolve);
    const target = setString(readAttr(child, "target", map.resolve));
    const color = parseColor(readAttr(child, "color", map.resolve));
    const weight = setString(readAttr(child, "font-weight", map.resolve));
    const deco = setString(readAttr(child, "text-decoration", map.resolve));
    items.push({
      id: generateId(),
      text: stripTags(serialiseChildren(child.children)),
      url: setString(href) ?? "",
      openInNewTab: target === "_blank",
      bold: weight === "bold" || weight === "700",
      underline: deco !== undefined && deco.includes("underline"),
      ...(color ? { color } : {}),
    });
  }
  if (items.length === 0) return empty();

  const align = parseAlign(readAttr(node, "align", map.resolve));
  return finish(
    createMenuBlock({
      items,
      ...(align ? { textAlign: align } : {}),
      ...leafStyles(node, map),
    }),
    node,
    report("standard-navbar", "menu", "converted"),
  );
}

function convertSocial(node: EasyEmailProNode, map: MapContext): Converted {
  const icons: SocialIcon[] = [];
  let customSrc = false;
  for (const child of node.children ?? []) {
    if (!isElement(child) || child.type !== "standard-social-element") continue;
    const href = readAttr(child, "href", map.resolve);
    const src = readAttr(child, "src", map.resolve);
    if (typeof src === "string" && !isUnset(src)) customSrc = true;
    icons.push({
      id: generateId(),
      platform: inferPlatform(href, src),
      url: setString(href) ?? "",
    });
  }
  if (icons.length === 0) return empty();

  const align = parseAlign(readAttr(node, "align", map.resolve));
  return finish(
    createSocialIconsBlock({
      icons,
      ...(align ? { align } : {}),
      ...leafStyles(node, map),
    }),
    node,
    customSrc
      ? report(
          "standard-social",
          "social",
          "approximated",
          "custom src was present; SocialIconsBlock has no custom PNG",
        )
      : report("standard-social", "social", "converted"),
  );
}

function convertTable(node: EasyEmailProNode, map: MapContext): Converted {
  const rows: TableRowData[] = [];
  let hasHeaderRow = false;
  let first = true;
  for (const row of collectRows(node)) {
    const cells: TableCellData[] = [];
    let rowHasTh = false;
    for (const cell of row.children ?? []) {
      if (!isElement(cell)) continue;
      if (cell.type !== "td" && cell.type !== "th") continue;
      if (cell.type === "th") rowHasTh = true;
      cells.push({
        id: generateId(),
        content: serialiseChildren(cell.children),
      });
    }
    if (cells.length === 0) continue;
    if (first) {
      hasHeaderRow = rowHasTh;
      first = false;
    }
    rows.push({ id: generateId(), cells });
  }
  if (rows.length === 0) return empty();

  const align = parseAlign(readAttr(node, "align", map.resolve));
  const color = parseColor(readAttr(node, "color", map.resolve));
  return finish(
    createTableBlock({
      rows,
      hasHeaderRow,
      ...(align ? { textAlign: align } : {}),
      ...(color ? { color } : {}),
      ...leafStyles(node, map),
    }),
    node,
    report("standard-table2", "table", "converted"),
  );
}

function convertCountdown(node: EasyEmailProNode, map: MapContext): Converted {
  const blocks: Block[] = [];
  const entries: ImportReportEntry[] = [];

  for (const child of node.children ?? []) {
    if (!isElement(child)) continue;
    const remapped = remapOverlay(child);
    if (!remapped) continue;
    const inner = convertLeaf(remapped, map);
    for (const block of inner.blocks) blocks.push(block);
    for (const entry of inner.entries) {
      entries.push({
        sourceTag: "marketing-countdown",
        templaticalBlockType: entry.templaticalBlockType,
        status: "approximated",
        note: entry.note ? `${entry.note} marketing-countdown` : COUNTDOWN_NOTE,
      });
    }
  }

  const src = readAttr(node, "src", map.resolve);
  if (typeof src === "string" && !isUnset(src)) {
    const image = createImageBlock({
      src,
      ...leafStyles(node, map),
    });
    const visibility = readVisibility(node);
    if (visibility) image.visibility = visibility;
    blocks.push(image);
    entries.push({
      sourceTag: "marketing-countdown",
      templaticalBlockType: "image",
      status: "approximated",
      note: COUNTDOWN_NOTE,
    });
  }

  return { blocks, entries };
}

function convertVideo(node: EasyEmailProNode, map: MapContext): Converted {
  const url = firstUrl(node, map);
  if (!url) return convertUnknown(node, map);
  return finish(
    createVideoBlock({
      url,
      ...leafStyles(node, map),
    }),
    node,
    report("common-video", "video", "converted"),
  );
}

function convertUnknown(node: EasyEmailProNode, map: MapContext): Converted {
  const sourceTag = node.type ?? "unknown";
  return finish(
    createHtmlBlock({
      content: JSON.stringify(node),
      ...leafStyles(node, map),
    }),
    node,
    report(
      sourceTag,
      "html",
      "html-fallback",
      `Unknown Easy Email Pro type "${sourceTag}"; preserved as HTML.`,
    ),
  );
}

function remapOverlay(child: EasyEmailProNode): EasyEmailProNode | null {
  if (child.type === "text") {
    return { ...child, type: "standard-paragraph" };
  }
  if (child.type === "standard-paragraph") return child;
  if (typeof child.type === "string" && headingLevelFromType(child.type)) {
    return child;
  }
  return null;
}

function collectRows(node: EasyEmailProNode): EasyEmailProNode[] {
  const rows: EasyEmailProNode[] = [];
  for (const child of node.children ?? []) {
    if (!isElement(child)) continue;
    if (child.type === "tr") {
      rows.push(child);
      continue;
    }
    for (const inner of child.children ?? []) {
      if (isElement(inner) && inner.type === "tr") rows.push(inner);
    }
  }
  return rows;
}

function firstUrl(node: EasyEmailProNode, map: MapContext): string | undefined {
  for (const key of ["src", "href", "url"] as const) {
    const value = readAttr(node, key, map.resolve);
    if (typeof value === "string" && !isUnset(value)) return value;
  }
  return undefined;
}

function inferPlatform(href: unknown, src: unknown): SocialPlatform {
  const host = hostname(typeof href === "string" ? href : "");
  for (const platform of SOCIAL_PLATFORMS) {
    if (host.includes(platform)) return platform;
  }
  const path = pathOf(typeof src === "string" ? src : "");
  for (const platform of SOCIAL_PLATFORMS) {
    if (path.includes(platform)) return platform;
  }
  return "website";
}

function hostname(href: string): string {
  const lower = href.toLowerCase();
  const scheme = lower.indexOf("://");
  const rest = scheme === -1 ? lower : lower.slice(scheme + 3);
  const slash = rest.indexOf("/");
  const hostport = slash === -1 ? rest : rest.slice(0, slash);
  const colon = hostport.indexOf(":");
  return colon === -1 ? hostport : hostport.slice(0, colon);
}

function pathOf(src: string): string {
  const lower = src.toLowerCase();
  const scheme = lower.indexOf("://");
  const rest = scheme === -1 ? lower : lower.slice(scheme + 3);
  const slash = rest.indexOf("/");
  return slash === -1 ? rest : rest.slice(slash);
}

function headingLevelFromType(
  type: string,
): { level: HeadingLevel; source: number } | null {
  if (!type.startsWith("standard-h")) return null;
  const raw = type.slice("standard-h".length);
  if (raw.length === 0) return null;
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 48 || code > 57) return null;
  }
  const source = Number(raw);
  if (!Number.isFinite(source) || source < 1) return null;
  const level = (source > 4 ? 4 : source) as HeadingLevel;
  return { level, source };
}

function leafStyles(
  node: EasyEmailProNode,
  map: MapContext,
): { styles: BlockStyles } {
  return {
    styles: {
      padding: readPadding((key) => readAttr(node, key, map.resolve)),
    },
  };
}

function finish(
  block: Block,
  node: EasyEmailProNode,
  entry: ImportReportEntry,
): Converted {
  const visibility = readVisibility(node);
  if (visibility) block.visibility = visibility;
  return { blocks: [block], entries: [entry] };
}

function readVisibility(node: EasyEmailProNode): BlockVisibility | undefined {
  if (node.visible === "desktop") return { desktop: true, mobile: false };
  if (node.visible === "mobile") return { desktop: false, mobile: true };
  return undefined;
}

function report(
  sourceTag: string,
  templaticalBlockType: string,
  status: ConversionStatus,
  note?: string,
): ImportReportEntry {
  return {
    sourceTag,
    templaticalBlockType,
    status,
    ...(note ? { note } : {}),
  };
}

function empty(): Converted {
  return { blocks: [], entries: [] };
}

function isElement(
  node: EasyEmailProNode | EasyEmailProTextNode,
): node is EasyEmailProNode {
  return typeof node.type === "string" && node.type !== "";
}

function isBorderEnabled(value: unknown): boolean {
  return value === true || value === "true";
}

function buttonWidth(value: unknown): number | "full" | undefined {
  if (isUnset(value)) return undefined;
  if (typeof value === "string" && value.trim() === "100%") return "full";
  return parsePx(value);
}

function parseAlign(value: unknown): "left" | "center" | "right" | undefined {
  if (typeof value !== "string") return undefined;
  const align = value.trim().toLowerCase();
  if (align === "left" || align === "center" || align === "right") return align;
  return undefined;
}

function asLineStyle(
  value: unknown,
): "solid" | "dashed" | "dotted" | undefined {
  if (typeof value !== "string") return undefined;
  const style = value.trim().toLowerCase();
  if (style === "solid" || style === "dashed" || style === "dotted") {
    return style;
  }
  return undefined;
}

function setString(value: unknown): string | undefined {
  if (typeof value !== "string" || isUnset(value)) return undefined;
  return value;
}

/** Button labels are plain text — strip tags the serialiser may have emitted. */
function stripTags(html: string): string {
  if (html === "") return "";
  return decodeEntities(removeTags(html)).trim();
}

function removeTags(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const open = html.indexOf("<", i);
    if (open === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, open);
    const tagEnd = findOpenTagEnd(html, open + 1);
    if (tagEnd === -1) {
      out += html.slice(open);
      break;
    }
    i = tagEnd + 1;
  }
  return out;
}

function decodeEntities(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "&") {
      const semi = text.indexOf(";", i + 1);
      if (semi !== -1 && semi - i <= 6) {
        const mapped = ENTITIES[text.slice(i, semi + 1)];
        if (mapped !== undefined) {
          out += mapped;
          i = semi + 1;
          continue;
        }
      }
    }
    out += text[i];
    i++;
  }
  return out;
}
