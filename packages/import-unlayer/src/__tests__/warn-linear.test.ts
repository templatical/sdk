import { describe, expect, it } from "vitest";
import { warn } from "../localization";

describe("import warnings", () => {
  it("adds a message once, counting messages pushed directly", () => {
    const warnings = ["first"];
    warn(warnings, "second");
    warnings.push("pushed");
    warn(warnings, "pushed");
    warn(warnings, "first");
    warn(warnings, "third");
    warn(warnings, "second");
    expect(warnings).toEqual(["first", "second", "pushed", "third"]);
  });

  it("starts over when the list is shortened", () => {
    const warnings: string[] = [];
    warn(warnings, "a");
    warnings.length = 0;
    warn(warnings, "a");
    expect(warnings).toEqual(["a"]);
  });

  it("reads each earlier warning once, not once per new warning", () => {
    // Counting index reads instead of timing keeps this deterministic under
    // coverage instrumentation. A search per warning reads n²/2 entries.
    let reads = 0;
    const warnings = new Proxy<string[]>([], {
      get(target, key, receiver) {
        if (typeof key === "string" && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver);
      },
    });
    const n = 2_000;
    for (let i = 0; i < n; i++) warn(warnings, `Dropped language "x${i}".`);
    expect(warnings).toHaveLength(n);
    expect(reads).toBeLessThanOrEqual(n);
  });
});
