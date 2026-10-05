import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const md = readFileSync(resolve(import.meta.dirname, "../reference/custom-block.md"), "utf8");

// The playbook's safety rules are agent behaviour no CLI test can reach;
// these pin the sentences that carry them.
describe("custom-block playbook", () => {
  it("triages saved blocks before authoring", () => {
    expect(md).toMatch(/saved block[\s\S]{0,400}\[providers\.md\]\(providers\.md\)/i);
  });
  it("asks for the env var's name, never the secret", () => {
    expect(md).toContain("${env:");
    expect(md).toMatch(/never (ask for|paste|write) (the|its) (secret|value|token)/i);
  });
  it("validates before every live reload", () => {
    expect(md).toMatch(/custom-block validate[\s\S]{0,300}live reload/);
  });
  it("warns that renaming a field key breaks saved content", () => {
    expect(md).toMatch(/renam[\s\S]{0,200}field key[\s\S]{0,300}saved/i);
  });
  it("writes back property by property, never regenerating the module", () => {
    expect(md).toMatch(/only the properties that changed/i);
  });
});
