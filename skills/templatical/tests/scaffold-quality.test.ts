import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("scaffold quality installation", () => {
  it("proposes quality with the editor as direct app dependencies", () => {
    const scaffold = readFileSync(
      new URL("../reference/scaffold.md", import.meta.url),
      "utf8",
    );
    const detect = scaffold.split("2. **Propose")[0];
    expect(detect).toMatch(
      /Install[\s\S]*`@templatical\/editor`[\s\S]*`@templatical\/quality`[\s\S]*direct dependencies/,
    );
    expect(scaffold).toContain("Issues panel and lint badges");
  });
});
