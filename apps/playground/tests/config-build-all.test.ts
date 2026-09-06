import { describe, expect, it } from "vitest";
import {
  buildAllCapabilityConfig,
  capabilities,
} from "../src/config/capabilities";

describe("buildAllCapabilityConfig", () => {
  it("folds every registered capability into one config object", () => {
    const config = buildAllCapabilityConfig({});
    expect(Object.keys(config).sort()).toEqual([
      "comments",
      "savedBlocks",
      "templates",
      "versionHistory",
    ]);
  });

  it("gives every registered capability an implFor", () => {
    const missing = capabilities
      .filter((c) => typeof c.implFor !== "function")
      .map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it("applies control state to the capability it belongs to", () => {
    const config = buildAllCapabilityConfig({ "templates.save": false });
    expect(config.templates?.save).toBe(false);
    expect(config.comments?.create).not.toBe(false);
  });

  it("resolves each capability's own defaults when state is empty", () => {
    const config = buildAllCapabilityConfig({});
    expect(config.templates?.autoSave).toBe(false);
    expect(typeof config.savedBlocks?.list).toBe("function");
    expect(typeof config.comments?.setResolved).toBe("function");
  });
});

/**
 * The drawer's Events tab is fed by the capabilities themselves: each attaches
 * the provider's own lifecycle handlers inside `build()` and writes its own
 * summary, because only it knows what its payload means.
 *
 * The recorder arrives already bound to the capability's id, so a capability
 * cannot report under another's name and the feed's grouping stays honest.
 */
describe("buildAllCapabilityConfig recorder", () => {
  it("hands every capability a recorder bound to its own id", () => {
    const seen: Array<{ id: string; handler: string }> = [];
    buildAllCapabilityConfig({}, undefined, (id, event) =>
      seen.push({ id, handler: event.handler }),
    );
    // Nothing fires at build time — a recorder is wired, not called.
    expect(seen).toEqual([]);
  });

  it("builds a working config when no recorder is supplied at all", () => {
    // Headless callers (and every existing test) pass two arguments. The
    // handlers must still be present and inert rather than throwing on the
    // absent recorder.
    const config = buildAllCapabilityConfig({});
    config.savedBlocks?.onCreated?.({
      id: "b1",
      name: "Hero",
      content: [],
    });
    expect(typeof config.savedBlocks?.onCreated).toBe("function");
  });

  it("routes a savedBlocks create through the recorder with its own id", () => {
    const seen: Array<{ id: string; handler: string; summary: string }> = [];
    const config = buildAllCapabilityConfig({}, undefined, (id, event) =>
      seen.push({ id, handler: event.handler, summary: event.summary }),
    );
    config.savedBlocks?.onCreated?.({
      id: "b1",
      name: "Hero",
      content: [],
    });

    expect(seen).toEqual([
      { id: "saved-blocks", handler: "onCreated", summary: "Hero" },
    ]);
  });

  it("routes savedBlocks update and delete too, each under its own handler", () => {
    const seen: Array<{ handler: string; summary: string }> = [];
    const config = buildAllCapabilityConfig({}, undefined, (_id, event) =>
      seen.push({ handler: event.handler, summary: event.summary }),
    );
    config.savedBlocks?.onUpdated?.({
      id: "b1",
      name: "Renamed",
      content: [],
    });
    // The contract hands back the removed entry rather than an id, which is
    // what lets the feed name what went.
    config.savedBlocks?.onDeleted?.({
      id: "b1",
      name: "Renamed",
      content: [],
    });

    expect(seen).toEqual([
      { handler: "onUpdated", summary: "Renamed" },
      { handler: "onDeleted", summary: "Renamed" },
    ]);
  });

  it("carries the block itself as the payload, not a summary of it", () => {
    const payloads: unknown[] = [];
    const config = buildAllCapabilityConfig({}, undefined, (_id, event) =>
      payloads.push(event.payload),
    );
    const block = { id: "b1", name: "Hero", content: [] };
    config.savedBlocks?.onCreated?.(block);

    expect(payloads).toEqual([block]);
  });
});

/**
 * Templates and version-history attach their own lifecycle handlers the same
 * way saved blocks does above: each writes its own summary inside `build()`,
 * because only it knows what its payload means.
 */
describe("templates and version-history recorder wiring", () => {
  const template = {
    id: "t1",
    name: "Launch Email",
    content: { blocks: [], settings: {} },
  };

  it("routes templates.onSaved through the recorder, naming the trigger", () => {
    const seen: Array<{ id: string; handler: string; summary: string }> = [];
    const config = buildAllCapabilityConfig({}, undefined, (id, event) =>
      seen.push({ id, handler: event.handler, summary: event.summary }),
    );
    config.templates?.onSaved?.(template, { trigger: "manual" });

    // The trigger distinguishes a pressed Save from autosave, which is what a
    // reader of the feed wants — it rides in the summary, not only the payload.
    expect(seen).toEqual([
      {
        id: "templates",
        handler: "onSaved",
        summary: "Launch Email (manual)",
      },
    ]);
  });

  it("routes templates.onCreated and onLoaded, each naming the template", () => {
    const seen: Array<{ handler: string; summary: string }> = [];
    const config = buildAllCapabilityConfig({}, undefined, (_id, event) =>
      seen.push({ handler: event.handler, summary: event.summary }),
    );
    config.templates?.onCreated?.(template);
    config.templates?.onLoaded?.(template);

    expect(seen).toEqual([
      { handler: "onCreated", summary: "Launch Email" },
      { handler: "onLoaded", summary: "Launch Email" },
    ]);
  });

  it("routes versionHistory.onCreated, falling back to the version's id when it has no label", () => {
    const seen: Array<{ handler: string; summary: string }> = [];
    const config = buildAllCapabilityConfig({}, undefined, (_id, event) =>
      seen.push({ handler: event.handler, summary: event.summary }),
    );
    config.versionHistory?.onCreated?.({
      id: "v1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    config.versionHistory?.onCreated?.({
      id: "v2",
      createdAt: "2026-01-01T00:00:00.000Z",
      label: "Before rewrite",
    });

    expect(seen).toEqual([
      { handler: "onCreated", summary: "v1" },
      { handler: "onCreated", summary: "Before rewrite" },
    ]);
  });

  it("routes versionHistory.onRestored with its own id, carrying the resulting template", () => {
    const seen: Array<{ id: string; handler: string; summary: string }> = [];
    const config = buildAllCapabilityConfig({}, undefined, (id, event) =>
      seen.push({ id, handler: event.handler, summary: event.summary }),
    );
    config.versionHistory?.onRestored?.(template);

    expect(seen).toEqual([
      {
        id: "version-history",
        handler: "onRestored",
        summary: "Launch Email",
      },
    ]);
  });
});
