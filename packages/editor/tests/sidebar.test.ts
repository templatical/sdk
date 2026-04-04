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
    expect(src).not.toContain("Heading,");
    expect(src).not.toContain("Pilcrow,");
    expect(src).not.toContain("RectangleHorizontal,");
  });
});
