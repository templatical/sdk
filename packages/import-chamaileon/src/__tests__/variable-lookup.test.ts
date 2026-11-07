import { describe, expect, it } from "vitest";
import { unwrapValue } from "../normalize";
import type { ChamaileonVariable } from "../types";

describe("variable references", () => {
  it("resolves to the first variable with the name", () => {
    const variables: ChamaileonVariable[] = [
      { name: "brand", value: "#111111" },
      { name: "brand", value: "#222222" },
      { value: "#333333" },
    ];
    expect(unwrapValue({ reference: "brand" }, variables)).toBe("#111111");
    expect(unwrapValue({ reference: "missing" }, variables)).toBeUndefined();
  });

  it("skips a variable whose name is not a string", () => {
    const variables = [
      { name: 1, value: "#111111" },
    ] as unknown as ChamaileonVariable[];
    expect(unwrapValue({ reference: "1" }, variables)).toBeUndefined();
  });

  it("keeps an unset first match unresolved, as before", () => {
    const variables: ChamaileonVariable[] = [
      { name: "brand", value: "" },
      { name: "brand", value: "#222222" },
    ];
    expect(unwrapValue({ reference: "brand" }, variables)).toBeUndefined();
  });

  it("reads each variable once for any number of references", () => {
    // Counting index reads instead of timing keeps this deterministic under
    // coverage instrumentation. A search per reference reads n² entries.
    let reads = 0;
    const n = 1_000;
    const variables = new Proxy<ChamaileonVariable[]>(
      Array.from({ length: n }, (_, i) => ({ name: `v${i}`, value: `#${i}` })),
      {
        get(target, key, receiver) {
          if (typeof key === "string" && /^\d+$/.test(key)) reads++;
          return Reflect.get(target, key, receiver);
        },
      },
    );
    for (let i = 0; i < n; i++) {
      expect(
        unwrapValue({ reference: `missing${i}` }, variables),
      ).toBeUndefined();
    }
    expect(unwrapValue({ reference: "v7" }, variables)).toBe("#7");
    expect(reads).toBe(n);
  });
});
