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
    const config = buildCapabilityConfig(savedBlocksCapability, {}, impl);
    expect(config.savedBlocks).toEqual({
      list: impl.list,
      create: impl.create,
      update: impl.update,
      delete: impl.delete,
      // Attached by the capability itself, not carried in from `impl`: the
      // drawer's Events tab is fed from inside `build()`, so the provider the
      // editor is handed reports three lifecycle events the demo backend
      // never declared. Matched by shape rather than identity — which
      // function each one is belongs to `config-build-all.test.ts`, while
      // this exhaustive comparison is what stops a fourth key appearing
      // unnoticed.
      onCreated: expect.any(Function),
      onUpdated: expect.any(Function),
      onDeleted: expect.any(Function),
    });
  });

  it("withholds a mutation as literal false when its control is off", () => {
    const config = buildCapabilityConfig(
      savedBlocksCapability,
      { "savedBlocks.update": false, "savedBlocks.delete": false },
      impl,
    );
    expect(config.savedBlocks).toEqual({
      list: impl.list,
      create: impl.create,
      update: false,
      delete: false,
      // Reporting is independent of permission: a store that forbids updates
      // still tells the feed when one it does allow lands.
      onCreated: expect.any(Function),
      onUpdated: expect.any(Function),
      onDeleted: expect.any(Function),
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
    expect(buildCapabilityConfig(savedBlocksCapability, {}, impl)).toEqual({
      savedBlocks: {
        list: impl.list,
        create: impl.create,
        update: impl.update,
        delete: impl.delete,
        onCreated: expect.any(Function),
        onUpdated: expect.any(Function),
        onDeleted: expect.any(Function),
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
    const config = buildCapabilityConfig(
      savedBlocksCapability,
      { "savedBlocks.listDelayMs": 0 },
      impl,
    );
    expect(config.savedBlocks?.list).toBe(impl.list);
  });

  it("wraps list in a different function that still resolves to impl.list's value when the delay is above 0", async () => {
    const config = buildCapabilityConfig(
      savedBlocksCapability,
      { "savedBlocks.listDelayMs": 500 },
      impl,
    );
    const wrapped = config.savedBlocks?.list;
    expect(wrapped).not.toBe(impl.list);

    const callCountBefore = impl.list.mock.calls.length;
    const pending = wrapped?.();
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toEqual([]);
    expect(impl.list.mock.calls.length).toBe(callCountBefore + 1);
  });
});
