import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import { savedBlocksCapability } from "../src/config/capabilities/saved-blocks";
import { capabilityById } from "../src/config/capabilities";

const impl = {
  list: vi.fn(async () => []),
  create: vi.fn(async () => ({ id: "1", name: "x", content: [] })),
  update: vi.fn(async () => ({ id: "1", name: "x", content: [] })),
  delete: vi.fn(async () => {}),
};

describe("savedBlocksCapability", () => {
  it("supplies every mutation when all controls are on", () => {
    const config = buildCapabilityConfig(savedBlocksCapability, { __impl: impl });
    expect(config.savedBlocks).toEqual({
      list: impl.list,
      create: impl.create,
      update: impl.update,
      delete: impl.delete,
    });
  });

  it("withholds a mutation as literal false when its control is off", () => {
    const config = buildCapabilityConfig(savedBlocksCapability, {
      __impl: impl,
      "savedBlocks.update": false,
      "savedBlocks.delete": false,
    });
    expect(config.savedBlocks).toEqual({
      list: impl.list,
      create: impl.create,
      update: false,
      delete: false,
    });
  });

  it("never withholds list — the feature would have nothing to show", () => {
    const paths = savedBlocksCapability.controls.map((c) => c.path);
    expect(paths).not.toContain("savedBlocks.list");
    expect(paths).toEqual([
      "savedBlocks.create",
      "savedBlocks.update",
      "savedBlocks.delete",
      "savedBlocks.listDelayMs",
    ]);
  });

  it("is registered and findable by id", () => {
    expect(capabilityById("saved-blocks")).toBe(savedBlocksCapability);
  });
});

describe("savedBlocks list delay", () => {
  it("exposes a delay control that defaults to no delay", () => {
    const control = savedBlocksCapability.controls.find(
      (c) => c.path === "savedBlocks.listDelayMs",
    );
    expect(control).toEqual({
      kind: "number",
      path: "savedBlocks.listDelayMs",
      label: "list() latency (ms)",
      help: "Stands in for a slow backend so the browser's first-open skeleton is reachable. localStorage answers instantly, which is the one latency profile that cannot reproduce it.",
      min: 0,
      max: 5000,
      default: 0,
    });
    expect(
      buildCapabilityConfig(savedBlocksCapability, { __impl: impl }),
    ).toEqual({
      savedBlocks: {
        list: impl.list,
        create: impl.create,
        update: impl.update,
        delete: impl.delete,
      },
    });
  });
});

describe("savedBlocks list delay wrapping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes impl.list through by reference when the delay is 0", () => {
    const config = buildCapabilityConfig(savedBlocksCapability, {
      __impl: impl,
      "savedBlocks.listDelayMs": 0,
    });
    expect(config.savedBlocks?.list).toBe(impl.list);
  });

  it("wraps list in a different function that still resolves to impl.list's value when the delay is above 0", async () => {
    const config = buildCapabilityConfig(savedBlocksCapability, {
      __impl: impl,
      "savedBlocks.listDelayMs": 500,
    });
    const wrapped = config.savedBlocks?.list;
    expect(wrapped).not.toBe(impl.list);

    const callCountBefore = impl.list.mock.calls.length;
    const pending = wrapped?.();
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toEqual([]);
    expect(impl.list.mock.calls.length).toBe(callCountBefore + 1);
  });
});
