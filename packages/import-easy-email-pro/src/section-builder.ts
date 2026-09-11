import { createImageBlock, createSectionBlock } from "@templatical/types";
import type {
  Block,
  BlockVisibility,
  SectionBlock,
  SectionWrapper,
} from "@templatical/types";
import {
  parseColor,
  parsePercent,
  parsePx,
  readPadding,
} from "./attribute-parser";
import { convertLeaf, type Converted, type MapContext } from "./block-mapper";
import { COLUMN_COUNT, matchColumnLayout } from "./column-layout";
import { isUnset, readAttr } from "./normalize";
import type {
  ConversionStatus,
  EasyEmailProNode,
  EasyEmailProTextNode,
  ImportReportEntry,
} from "./types";

export function buildTopLevel(
  node: EasyEmailProNode,
  map: MapContext,
): Converted {
  switch (node.type) {
    case "standard-wrapper":
      return buildWrapper(node, map);
    case "standard-hero":
      return buildHero(node, map);
    case "standard-section":
      return buildSection(node, map);
    default:
      return empty();
  }
}

function buildSection(node: EasyEmailProNode, map: MapContext): Converted {
  const plan = collectSlots(node);
  const leftover = convertFlow(plan.leftovers, map);
  const rawWidths = plan.columns.map((column) =>
    readAttr(column, "width", map.resolve),
  );
  const { layout, exact } = matchColumnLayout(
    rawWidths.map((width) => parsePercent(width)),
  );
  const slots = COLUMN_COUNT[layout];
  const children: Block[][] = Array.from({ length: slots }, () => []);
  if (leftover.blocks.length > 0) {
    children[0].push(...leftover.blocks);
  }

  const entries = leftover.entries;
  plan.columns.forEach((column, index) => {
    const slot = Math.min(index, slots - 1);
    const inner = convertFlow(column.children ?? [], map);
    children[slot].push(...inner.blocks);
    for (const entry of inner.entries) entries.push(entry);
  });

  const reasons: string[] = [];
  if (plan.mixed) {
    reasons.push(
      "Section mixed columns and groups; flattened into the column flow.",
    );
  }
  if (!exact) {
    if (plan.columns.length > slots) {
      reasons.push(
        `${plan.columns.length}-column layout has no exact Templatical equivalent; folded onto "${layout}".`,
      );
    } else {
      const shown = rawWidths
        .map((width) =>
          typeof width === "string" && !isUnset(width) ? width : "auto",
        )
        .join(", ");
      reasons.push(
        `Column widths ${shown} have no exact Templatical layout; resolved to "${layout}".`,
      );
    }
  }

  const section = createSectionBlock();
  section.columns = layout;
  section.children = children;
  paintSection(section, node, map, {
    stackOnMobile: plan.grouped ? false : undefined,
  });
  entries.unshift(
    sectionEntry(
      node,
      reasons.length > 0 ? "approximated" : "converted",
      reasons.length > 0 ? reasons.join(" ") : undefined,
    ),
  );
  return { blocks: [section], entries };
}

function buildHero(node: EasyEmailProNode, map: MapContext): Converted {
  const slot: Block[] = [];
  const entries: ImportReportEntry[] = [];
  const url = readAttr(node, "background-url", map.resolve);
  if (typeof url === "string" && !isUnset(url)) {
    slot.push(createImageBlock({ src: url }));
    entries.push({
      sourceTag: "standard-hero",
      templaticalBlockType: "image",
      status: "approximated",
      note: "hero background-url stacked as a leading image (overlay is the loss)",
    });
  }
  const inner = convertFlow(node.children ?? [], map);
  slot.push(...inner.blocks);
  for (const entry of inner.entries) entries.push(entry);

  const section = createSectionBlock();
  section.columns = "1";
  section.children = [slot];
  paintSection(section, node, map);
  entries.unshift({
    sourceTag: "standard-hero",
    templaticalBlockType: "section",
    status: "approximated",
    note: "standard-hero overlay is stacked as a 1-column section; background-url becomes a leading image.",
  });
  return { blocks: [section], entries };
}

function buildWrapper(node: EasyEmailProNode, map: MapContext): Converted {
  const blocks: Block[] = [];
  const entries: ImportReportEntry[] = [];
  for (const child of elements(node)) {
    if (child.type === "placeholder") continue;
    const inner = buildTopLevel(child, map);
    for (const block of inner.blocks) blocks.push(block);
    for (const entry of inner.entries) entries.push(entry);
  }

  const sections = blocks.filter(
    (block): block is SectionBlock => block.type === "section",
  );
  if (sections.length === 0) {
    return {
      blocks: [],
      entries: [
        {
          sourceTag: "standard-wrapper",
          templaticalBlockType: null,
          status: "skipped",
          note: "An empty standard-wrapper produces nothing.",
        },
      ],
    };
  }

  const wrapper = readWrapper(node, map);
  for (const section of sections) {
    section.wrapper = { ...wrapper };
  }
  if (sections.length > 1) {
    const note = `standard-wrapper holding ${sections.length} sections was applied to each of them — Templatical has no multi-section band.`;
    for (const entry of entries) {
      if (entry.templaticalBlockType !== "section") continue;
      if (entry.status !== "converted") continue;
      entry.status = "approximated";
      entry.note = note;
    }
  }
  return { blocks, entries };
}

/**
 * Direct columns become slots. A sole `standard-group` of columns becomes
 * those slots with `stackOnMobile: false`. Mixed group + columns flatten
 * into the slot list and are approximated.
 */
function collectSlots(section: EasyEmailProNode): {
  columns: EasyEmailProNode[];
  leftovers: EasyEmailProNode[];
  grouped: boolean;
  mixed: boolean;
} {
  const kids = structuralChildren(section);

  if (kids.every((kid) => kid.type === "standard-column")) {
    return { columns: kids, leftovers: [], grouped: false, mixed: false };
  }

  if (kids.length === 1 && kids[0].type === "standard-group") {
    const groupKids = structuralChildren(kids[0]);
    if (groupKids.every((kid) => kid.type === "standard-column")) {
      return {
        columns: groupKids,
        leftovers: [],
        grouped: true,
        mixed: false,
      };
    }
  }

  const columns: EasyEmailProNode[] = [];
  const leftovers: EasyEmailProNode[] = [];
  let grouped = false;
  for (const kid of kids) {
    if (kid.type === "standard-column") {
      columns.push(kid);
      continue;
    }
    if (kid.type === "standard-group") {
      grouped = true;
      for (const inner of structuralChildren(kid)) {
        if (inner.type === "standard-column") columns.push(inner);
        else leftovers.push(inner);
      }
      continue;
    }
    leftovers.push(kid);
  }
  return { columns, leftovers, grouped, mixed: true };
}

function convertFlow(
  nodes: Array<EasyEmailProNode | EasyEmailProTextNode> | undefined,
  map: MapContext,
): Converted {
  const blocks: Block[] = [];
  const entries: ImportReportEntry[] = [];
  for (const child of nodes ?? []) {
    if (!isElement(child)) continue;
    if (child.type === "placeholder") continue;
    if (child.type === "standard-group") {
      const innerColumns = structuralChildren(child).filter(
        (node) => node.type === "standard-column",
      );
      entries.push({
        sourceTag: "standard-group",
        templaticalBlockType: null,
        status: "approximated",
        note: `nested group flattened (${innerColumns.length} columns)`,
      });
      for (const column of innerColumns) {
        const inner = convertFlow(column.children, map);
        for (const block of inner.blocks) blocks.push(block);
        for (const entry of inner.entries) entries.push(entry);
      }
      continue;
    }
    if (child.type === "standard-column") {
      const inner = convertFlow(child.children, map);
      for (const block of inner.blocks) blocks.push(block);
      for (const entry of inner.entries) entries.push(entry);
      continue;
    }
    const converted = convertLeaf(child, map);
    for (const block of converted.blocks) blocks.push(block);
    for (const entry of converted.entries) entries.push(entry);
  }
  return { blocks, entries };
}

/** `createSectionBlock()` first, then mutate fill — never a partial `styles`. */
function paintSection(
  section: SectionBlock,
  node: EasyEmailProNode,
  map: MapContext,
  extras?: { stackOnMobile?: boolean },
): void {
  section.styles.padding = readPadding((key) =>
    readAttr(node, key, map.resolve),
  );
  const fill = sectionFill(node, map);
  if (fill) section.styles.backgroundColor = fill;
  const radius = parsePx(readAttr(node, "border-radius", map.resolve));
  if (radius !== undefined && radius > 0) section.borderRadius = radius;
  if (extras?.stackOnMobile === false) section.stackOnMobile = false;
  const visibility = readVisibility(node);
  if (visibility) section.visibility = visibility;
}

function sectionFill(
  node: EasyEmailProNode,
  map: MapContext,
): string | undefined {
  const own = parseColor(readAttr(node, "background-color", map.resolve));
  if (own) return own;
  return parseColor(
    readAttr(map.resolve.page, "content-background-color", map.resolve),
  );
}

function readWrapper(node: EasyEmailProNode, map: MapContext): SectionWrapper {
  const backgroundColor = parseColor(
    readAttr(node, "background-color", map.resolve),
  );
  const padding = readPadding((key) => readAttr(node, key, map.resolve));
  const radius = parsePx(readAttr(node, "border-radius", map.resolve));
  return {
    ...(backgroundColor ? { backgroundColor } : {}),
    padding,
    ...(radius !== undefined && radius > 0 ? { borderRadius: radius } : {}),
  };
}

function sectionEntry(
  node: EasyEmailProNode,
  status: ConversionStatus,
  note?: string,
): ImportReportEntry {
  return {
    sourceTag: node.type ?? "standard-section",
    templaticalBlockType: "section",
    status,
    ...(note ? { note } : {}),
  };
}

function readVisibility(node: EasyEmailProNode): BlockVisibility | undefined {
  if (node.visible === "desktop") return { desktop: true, mobile: false };
  if (node.visible === "mobile") return { desktop: false, mobile: true };
  return undefined;
}

function structuralChildren(node: EasyEmailProNode): EasyEmailProNode[] {
  return elements(node).filter((child) => child.type !== "placeholder");
}

function elements(node: EasyEmailProNode): EasyEmailProNode[] {
  const out: EasyEmailProNode[] = [];
  for (const child of node.children ?? []) {
    if (isElement(child)) out.push(child);
  }
  return out;
}

function isElement(
  node: EasyEmailProNode | EasyEmailProTextNode,
): node is EasyEmailProNode {
  return typeof node.type === "string" && node.type !== "";
}

function empty(): Converted {
  return { blocks: [], entries: [] };
}
