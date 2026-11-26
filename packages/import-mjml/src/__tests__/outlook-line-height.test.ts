import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { stripOutlookLineHeight } from "../outlook-line-height";

describe("stripOutlookLineHeight", () => {
  it("stops at an unterminated open tag", () => {
    const input = '<p style="mso-line-height-alt:21px';
    const moduleUrl = pathToFileURL(resolve("src/outlook-line-height.ts")).href;
    const script = `import { stripOutlookLineHeight } from ${JSON.stringify(moduleUrl)}; process.stdout.write(stripOutlookLineHeight(${JSON.stringify(input)}));`;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 1_000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(input);
  });

  it.each([
    [
      '<li style="a:b;mso-line-height-alt:1px;c:d">X</li>',
      '<li style="a:b;c:d">X</li>',
    ],
    [
      '<h2 style="mso-line-height-alt:1px;c:d">X</h2>',
      '<h2 style="c:d">X</h2>',
    ],
  ])("strips the alternate on a foreign block element", (input, expected) => {
    expect(stripOutlookLineHeight(input)).toBe(expected);
  });
});
