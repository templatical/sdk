import { describe, expect, it } from "vitest";
import {
  CAPABILITY_GROUP_ORDER,
  capabilities,
  capabilityGroups,
} from "../src/config/capabilities";

describe("capabilityGroups", () => {
  it("orders groups the way the rail reads them", () => {
    expect(CAPABILITY_GROUP_ORDER).toEqual([
      "backend",
      "authoring",
      "appearance",
      "cloud",
    ]);
  });

  it("omits a group with no capabilities rather than rendering it empty", () => {
    expect(capabilityGroups().map((g) => g.group)).toEqual(["backend"]);
  });

  it("carries every registered capability exactly once", () => {
    const grouped = capabilityGroups().flatMap((g) => g.capabilities);
    expect(grouped.map((c) => c.id).sort()).toEqual(
      capabilities.map((c) => c.id).sort(),
    );
    expect(grouped).toHaveLength(capabilities.length);
  });

  it("gives every group a human title", () => {
    expect(capabilityGroups().map((g) => g.title)).toEqual(["Backend & data"]);
  });
});
