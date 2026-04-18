import { describe, expect, it, vi } from "vitest";
import {
  resolveBlockComponent,
  getBlockWrapperStyle,
} from "../src/utils/blockComponentResolver";
import type { Block } from "@templatical/types";
import {
  createTitleBlock,
  createImageBlock,
  createButtonBlock,
  createDividerBlock,
} from "@templatical/types";
import type { UseBlockRegistryReturn } from "../src/composables/useBlockRegistry";
import { markRaw, type Component } from "vue";

const FakeTitle = markRaw({ name: "FakeTitle" }) as unknown as Component;
const FakeImage = markRaw({ name: "FakeImage" }) as unknown as Component;
const FakeRegistered = markRaw({
  name: "FakeRegistered",
}) as unknown as Component;

const componentMap: Record<string, Component> = {
  title: FakeTitle,
  image: FakeImage,
};

describe("resolveBlockComponent", () => {
  it("returns component from map when registry is null", () => {
    const block = createTitleBlock();
    const result = resolveBlockComponent(block, null, componentMap);
    expect(result).toBe(FakeTitle);
  });

  it("returns component from map when registry is undefined", () => {
    const block = createImageBlock();
    const result = resolveBlockComponent(block, undefined, componentMap);
    expect(result).toBe(FakeImage);
  });

  it("returns null for unknown block type", () => {
    const block = createButtonBlock();
    const result = resolveBlockComponent(block, null, componentMap);
    expect(result).toBeNull();
  });

  it("checks registry first before falling back to map", () => {
    const block = createTitleBlock();
    const registry = {
      getComponent: vi.fn().mockReturnValue(FakeRegistered),
    } as unknown as UseBlockRegistryReturn;

    const result = resolveBlockComponent(block, registry, componentMap);
    expect(result).toBe(FakeRegistered);
    expect(registry.getComponent).toHaveBeenCalledWith(block);
  });

  it("falls back to map when registry returns undefined", () => {
    const block = createTitleBlock();
    const registry = {
      getComponent: vi.fn().mockReturnValue(undefined),
    } as unknown as UseBlockRegistryReturn;

    const result = resolveBlockComponent(block, registry, componentMap);
    expect(result).toBe(FakeTitle);
  });

  it("returns null when both registry and map miss", () => {
    const block = createDividerBlock();
    const registry = {
      getComponent: vi.fn().mockReturnValue(undefined),
    } as unknown as UseBlockRegistryReturn;

    const result = resolveBlockComponent(block, registry, componentMap);
    expect(result).toBeNull();
  });
});

describe("getBlockWrapperStyle", () => {
  it("computes padding, margin, and background from block styles", () => {
    const block = createTitleBlock();
    block.styles = {
      padding: { top: 10, right: 20, bottom: 30, left: 40 },
      margin: { top: 5, right: 10, bottom: 15, left: 20 },
      backgroundColor: "#ff0000",
    };

    const style = getBlockWrapperStyle(block);
    expect(style.padding).toBe("10px 20px 30px 40px");
    expect(style.margin).toBe("5px 10px 15px 20px");
    expect(style.backgroundColor).toBe("#ff0000");
  });

  it("defaults backgroundColor to transparent when empty", () => {
    const block = createTitleBlock();
    block.styles = {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      backgroundColor: "",
    };

    const style = getBlockWrapperStyle(block);
    expect(style.backgroundColor).toBe("transparent");
  });

  it("handles zero padding and margin", () => {
    const block = createTitleBlock();
    block.styles = {
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      backgroundColor: "#fff",
    };

    const style = getBlockWrapperStyle(block);
    expect(style.padding).toBe("0px 0px 0px 0px");
    expect(style.margin).toBe("0px 0px 0px 0px");
  });
});
