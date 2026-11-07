import { describe, expect, it } from "vitest";
import { matchesHostGlob } from "../../src/links/rules/localhost-or-staging";
import { expectLinear } from "../helpers/expectLinear";

function oldGlobMatch(pattern: string, host: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`, "i").test(host);
}

describe("non-production host glob", () => {
  it.each([
    ["*.staging.*", "app.staging.example.com", true],
    ["*.staging.*", "staging.example.com", false],
    ["*.local", "a.b.local", true],
    ["*.local", "local", false],
    ["localhost", "localhost", true],
    ["localhost", "localhost.example", false],
    ["*", "", true],
    ["**", "anything.example", true],
    ["a*", "a", true],
    ["*a", "ba", true],
    ["a**b", "ab", true],
    ["a**b", "acb", true],
    ["a+b.com", "a+b.com", true],
    ["a+b.com", "ab.com", false],
    ["[x]", "[x]", true],
    ["[x]", "x", false],
    ["*.LOCAL", "mail.local", true],
    ["", "", true],
    ["", "a", false],
  ])("matches %s against %s exactly", (pattern, host, expected) => {
    expect(matchesHostGlob(pattern, host)).toBe(expected);
  });

  it("agrees with the previous regex over seeded patterns and hosts", () => {
    let seed = 0x12345678;
    const next = () =>
      ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) >>> 16) & 3;
    const alphabet = "ab.*";
    for (let i = 0; i < 2_000; i++) {
      const pattern = Array.from(
        { length: next() + next() + 1 },
        () => alphabet[next()],
      ).join("");
      const host = Array.from(
        { length: next() + next() },
        () => alphabet[next()],
      ).join("");
      expect(matchesHostGlob(pattern, host)).toBe(oldGlobMatch(pattern, host));
    }
  });

  it("scales a failing wildcard host linearly", () => {
    expectLinear(
      (n) => {
        const url = `https://${"a".repeat(n)}c/`;
        return () => matchesHostGlob("*a*b*c", new URL(url).hostname);
      },
      1_000,
      100,
    );
  }, 30_000);
});
