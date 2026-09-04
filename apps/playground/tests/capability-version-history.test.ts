import { describe, expect, it, vi } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import { versionHistoryCapability } from "../src/config/capabilities/version-history";
import { TEMPLATES_SAVE_PATH } from "../src/config/capabilities/templates";
import { capabilityById } from "../src/config/capabilities";
import type { VersionHistoryProvider } from "@templatical/types";

function makeImpl(): VersionHistoryProvider {
  return {
    list: vi.fn(async () => ({ versions: [] })),
    get: vi.fn(async () => ({ blocks: [], settings: {} })),
    create: vi.fn(async () => ({
      id: "v1",
      createdAt: "2026-01-01T00:00:00.000Z",
      isAutomatic: false,
    })),
    restore: vi.fn(async () => ({ id: "t1", name: "Demo" })),
  } as unknown as VersionHistoryProvider;
}

describe("versionHistoryCapability", () => {
  it("supplies restore when the control is on", () => {
    const impl = makeImpl();
    const config = buildCapabilityConfig(versionHistoryCapability, {}, impl);
    expect(config.versionHistory).toEqual({
      list: impl.list,
      get: impl.get,
      create: impl.create,
      restore: impl.restore,
    });
  });

  it("withholds restore as literal false when its control is off", () => {
    const impl = makeImpl();
    const config = buildCapabilityConfig(
      versionHistoryCapability,
      { "versionHistory.restore": false },
      impl,
    );
    expect(config.versionHistory).toEqual({
      list: impl.list,
      get: impl.get,
      create: impl.create,
      restore: false,
    });
  });

  it("gates only restore — browsing and previewing stay available", () => {
    expect(versionHistoryCapability.controls.map((c) => c.path)).toEqual([
      "versionHistory.restore",
    ]);
  });

  it("is registered and findable by id", () => {
    expect(capabilityById("version-history")).toBe(versionHistoryCapability);
  });
});

/**
 * The demo's `restore()` (`@/providers/version-history`) composes onto the
 * templates store's own `save` — there is no atomic restore endpoint, so it
 * reads the old content and saves it. A store that refuses `save` therefore
 * has nothing `restore` can write to, even though `versionHistory.restore` is
 * its own, separately-gated control on a different capability.
 */
describe("versionHistoryCapability and the templates store", () => {
  it("withholds restore when templates.save is off, though its own control was never touched", () => {
    const impl = makeImpl();
    const config = buildCapabilityConfig(
      versionHistoryCapability,
      { [TEMPLATES_SAVE_PATH]: false },
      impl,
    );
    expect(config.versionHistory).toEqual({
      list: impl.list,
      get: impl.get,
      create: impl.create,
      restore: false,
    });
  });

  it("templates.save being off overrides an explicit versionHistory.restore: true", () => {
    const impl = makeImpl();
    const config = buildCapabilityConfig(
      versionHistoryCapability,
      { [TEMPLATES_SAVE_PATH]: false, "versionHistory.restore": true },
      impl,
    );
    expect(config.versionHistory?.restore).toBe(false);
  });

  it("declares templates.save as what forces restore off, so a drawer can say why", () => {
    const restoreControl = versionHistoryCapability.controls.find(
      (c) => c.path === "versionHistory.restore",
    )!;
    expect(restoreControl.forcedBy).toEqual({
      path: TEMPLATES_SAVE_PATH,
      when: false,
      to: false,
      reason:
        "templates.save is off, so restore has nothing to write the old content to.",
    });
  });
});
