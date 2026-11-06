import { describe, expect, it } from "vitest";
import { createTitleBlock, safeClone } from "../src";
import type { DisplayCondition, DisplayConditionsConfig } from "../src";

describe("DisplayCondition", () => {
  it("allows a config that only sets onRequest", () => {
    const config: DisplayConditionsConfig = {
      onRequest: async () => null,
    };

    expect(config.conditions).toBeUndefined();
    expect(config.allowCustom).toBeUndefined();
  });

  it("round-trips data through safeClone on the condition and the block", () => {
    const data = { tier: "vip", nested: { n: 1 } };
    const condition: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      data,
    };

    expect(safeClone(condition).data).toEqual({ tier: "vip", nested: { n: 1 } });

    const block = createTitleBlock({ id: "title", displayCondition: condition });
    const stored = safeClone(block).displayCondition?.data as {
      tier: string;
      nested: { n: number };
    };

    expect(stored).toEqual({ tier: "vip", nested: { n: 1 } });
    expect(stored.nested.n).toBe(1);
  });
});
