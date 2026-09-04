import { describe, expect, it, vi } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import { versionHistoryCapability } from "../src/config/capabilities/version-history";
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
