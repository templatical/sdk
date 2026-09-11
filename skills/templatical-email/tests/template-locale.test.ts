import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

// The live-mode half of this guarantee — that the harness passes a locale to
// init() at all — lives with the harness, in
// packages/template-tools/tests/live-locale.test.ts. What is asserted here is
// the instruction the agent follows when it writes a template, which is this
// skill's own content and stays with it.
describe("generated templates declare their own language", () => {
  // Every few-shot example carries `"locale": "en"`, so a model asked for a
  // German email copies that and stamps `<html lang="en">` onto German copy —
  // wrong for every screen reader that opens it. The examples are themselves
  // English, so the fix is an instruction, not a fixture change.
  it("tells the model to match settings.locale to the copy's language", () => {
    const skill = read("../SKILL.md");
    const locale = /`locale`[^\n]*\n?[^\n]*/g;
    const mentions = skill.match(locale) ?? [];
    expect(mentions.length).toBeGreaterThan(0);

    // Not merely "include a locale" — it has to say which value.
    expect(skill).toMatch(
      /locale[\s\S]{0,400}?(language of the (copy|content|email)|copy's own language|language you (are )?writing)/i,
    );
  });

  it("keeps the requirement next to the other settings rules", () => {
    const skill = read("../SKILL.md");
    const settings = /\*\*Settings\*\*[\s\S]{0,600}/.exec(skill)?.[0];
    expect(settings).toBeDefined();
    expect(settings).toContain("locale");
  });
});
