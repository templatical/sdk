import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(__dirname, "../src/components/Sidebar.vue"),
  "utf-8",
);

describe("Sidebar.vue icon rendering", () => {
  it("imports blockTypeIcons from utils", () => {
    expect(src).toContain(
      'import { blockTypeIcons } from "../utils/blockTypeIcons"',
    );
  });

  it("uses dynamic component with blockTypeIcons lookup", () => {
    expect(src).toContain(':is="blockTypeIcons[blockType.type]"');
  });

  it("does not have a long v-if/v-else-if chain for icons", () => {
    expect(src).not.toContain('v-if="blockType.type === \'image\'"');
    expect(src).not.toContain('v-else-if="blockType.type === \'title\'"');
    expect(src).not.toContain('v-else-if="blockType.type === \'paragraph\'"');
  });

  it("still handles custom block icons as fallback", () => {
    expect(src).toContain("<CustomBlockIcon");
    expect(src).toContain('v-else-if="blockType.isCustom"');
  });

  it("no longer imports individual Lucide icons that are in the map", () => {
    // Uses blockTypeIcons map for all built-in icons
    expect(src).toContain('import { blockTypeIcons } from "../utils/blockTypeIcons"');
    expect(src).not.toContain("Heading,");
    expect(src).not.toContain("Pilcrow,");
    expect(src).not.toContain("RectangleHorizontal,");
  });
});

describe("Sidebar.vue block creation function", () => {
  it("uses createBlockFromItem (not cloneBlock) as the draggable clone handler", () => {
    expect(src).toContain("function createBlockFromItem(item: BlockTypeItem)");
    expect(src).toContain(":clone=\"createBlockFromItem\"");
    expect(src).not.toContain("function cloneBlock");
  });
});

describe("Sidebar.vue keyboard accessibility", () => {
  it("renders palette items as buttons with type=button", () => {
    const itemSlot = src.slice(
      src.indexOf("#item=\"{ element: blockType }\""),
    );
    expect(itemSlot).toContain("<button");
    expect(itemSlot).toContain('type="button"');
  });

  it("palette items have localized aria-label via sidebarNav.insertBlock", () => {
    expect(src).toContain(
      'format(t.sidebarNav.insertBlock, { block: blockType.label })',
    );
  });

  it("click and keydown on palette item insert the block", () => {
    expect(src).toContain('@click="insertBlockFromItem(blockType)"');
    expect(src).toContain('@keydown="handlePaletteKeydown($event, blockType)"');
  });

  it("keyboard handler activates on Enter and Space", () => {
    expect(src).toContain('event.key === "Enter"');
    expect(src).toContain('event.key === " "');
  });

  it("insert uses EDITOR_KEY addBlock + selectBlock", () => {
    expect(src).toContain("EDITOR_KEY");
    expect(src).toContain("editor.addBlock(block)");
    expect(src).toContain("editor.selectBlock(block.id)");
  });
});

describe("Sidebar.vue aria semantics", () => {
  it("uses aria-label for the palette landmark instead of aria-expanded", () => {
    expect(src).toContain(':aria-label="t.sidebarNav.palette"');
    expect(src).not.toContain(':aria-expanded="isExpanded"');
  });

  it("drops the misleading expandSidebar label on the aside", () => {
    // aside landmark should describe what it is, not what happens on hover
    const asideOpen = src.indexOf("<aside");
    const asideClose = src.indexOf(">", asideOpen);
    const asideTag = src.slice(asideOpen, asideClose);
    expect(asideTag).not.toContain("expandSidebar");
  });
});
