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
  it("sends chrome that is on every email to init({ layout }), ahead of saved blocks", () => {
    const triage = md.slice(md.indexOf("## 1. Triage"), md.indexOf("## 2."));
    expect(triage).toMatch(/every email[\s\S]{0,300}init\(\{ layout \}\)[\s\S]{0,200}\[rules\.md\]\(rules\.md\)/);
    expect(triage.indexOf("init({ layout })")).toBeLessThan(triage.indexOf("saved block"));
  });
  it("passes definitions to the renderer for server-side rendering", () => {
    const handoff = md.slice(md.indexOf("## 6. Handoff"));
    expect(handoff).toContain("renderToMjml(content, { customBlocks: definitions })");
    expect(handoff).toContain("liquidjs");
    expect(handoff).toMatch(/saved JSON holds field values, not HTML/);
  });
  it("escapes JSON body values with `| json` and keeps templates to one string", () => {
    expect(md).toContain("{{ key | json }}");
    expect(md).toMatch(/no `\{% include %\}`, `\{% render %\}` or\s+`\{% layout %\}`/);
  });
  it("guards optional fields with `!= blank`, since Liquid treats an empty string as true", () => {
    expect(md).toContain("{% if <key> != blank %}");
    expect(md).not.toMatch(/Wrap every optional field in `\{% if <key> %\}`/);
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
