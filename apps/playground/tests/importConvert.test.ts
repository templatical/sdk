import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convertImportSource } from "../src/host/importConvert";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../e2e/fixtures",
);

describe("convertImportSource", () => {
  it("converts Unlayer saveDesign JSON into TemplateContent", async () => {
    const raw = readFileSync(
      join(fixturesDir, "unlayer-template.json"),
      "utf8",
    );
    const content = await convertImportSource("unlayer", raw);
    expect(JSON.stringify(content)).toContain("Hello from Unlayer");
  });

  it("throws on Unlayer JSON that is missing body.rows", async () => {
    await expect(convertImportSource("unlayer", '{"body":{}}')).rejects.toThrow(
      /body|rows/i,
    );
  });
});
