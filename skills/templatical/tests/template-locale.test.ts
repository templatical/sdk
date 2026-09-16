import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
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
  // English few-shots would otherwise stamp `"locale": "en"` onto German copy.
  // rules.md says which value to write; a non-English example is the few-shot
  // that stops the model copying `"en"` by inertia. The router (SKILL.md)
  // names no settings fields itself — reference/rules.md does.
  it("tells the model to match settings.locale to the copy's language", () => {
    const rules = read("../reference/rules.md");
    const locale = /`locale`[^\n]*\n?[^\n]*/g;
    const mentions = rules.match(locale) ?? [];
    expect(mentions.length).toBeGreaterThan(0);

    // Not merely "include a locale" — it has to say which value.
    expect(rules).toMatch(
      /locale[\s\S]{0,400}?(language of the (copy|content|email)|copy's own language|language you (are )?writing)/i,
    );
  });

  it("keeps the requirement next to the other settings rules", () => {
    const rules = read("../reference/rules.md");
    const settings = /\*\*Settings\*\*[\s\S]{0,600}/.exec(rules)?.[0];
    expect(settings).toBeDefined();
    expect(settings).toContain("locale");
  });

  it("includes a few-shot whose locale is not English", () => {
    const dir = resolve(here, "../reference/examples");
    const locales = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const content = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as {
          settings?: { locale?: string };
        };
        return content.settings?.locale;
      });
    expect(locales.some((l) => l && l !== "en")).toBe(true);
  });
});

describe("merge-tag dialect follows the brief", () => {
  it("names Liquid as the default and the other shipped dialects", () => {
    const rules = read("../reference/rules.md");
    expect(rules).toMatch(/`\{\{contact\.field_name\}\}`/);
    expect(rules).toMatch(/\*\|\w+\|\*/);
    expect(rules).toMatch(/Handlebars/);
    expect(rules).toMatch(/AMPScript/);
    expect(rules).toMatch(/do not mix dialects/i);
  });

  it("has an eval that rejects Liquid tokens for a Mailchimp brief", () => {
    const evals = JSON.parse(read("../evals/evals.json")) as {
      evals: { prompt: string; expected_output: string }[];
    };
    const mailchimp = evals.evals.find(
      (e) =>
        /mailchimp/i.test(e.prompt) && /merge tag/i.test(e.prompt),
    );
    expect(mailchimp).toBeDefined();
    expect(mailchimp!.expected_output).toMatch(/\*\|\w+\|\*/);
    expect(mailchimp!.expected_output).not.toMatch(
      /Uses Liquid `\{\{contact/,
    );
  });
});
