import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

describe("live-mode locale", () => {
  // The harness called `init()` with no `locale` at all, so live mode was an
  // English editor no matter who opened it — even while the skill was generating
  // German copy into it.
  it("passes a locale to init()", () => {
    const html = read("../live/index.html");
    const call = /init\(\{([\s\S]*?)\n\s*\}\);/.exec(html)?.[1];
    expect(call).toBeDefined();
    expect(call).toContain("locale:");
  });

  // The browser that opens the harness belongs to the person hand-editing in it,
  // so its language is the right one for the chrome. A hardcoded tag would be
  // wrong for everyone but one audience, and the agent's own conversation
  // language is a proxy at best.
  it("takes it from the viewer's own browser rather than hardcoding one", () => {
    const html = read("../live/index.html");
    const call = /init\(\{([\s\S]*?)\n\s*\}\);/.exec(html)![1];
    const locale = /locale:\s*([^,\n]+)/.exec(call)?.[1];
    expect(locale).toBeDefined();
    // Optional-chained or not — the third case below is what requires the guard.
    expect(locale).toMatch(/navigator\??\.language/);
    expect(locale).not.toMatch(/["'`]/);
  });

  // `navigator.language` is absent in a non-browser context and can be an empty
  // string; the editor treats an unsupported tag as English, but an exception
  // here would abort the whole mount.
  it("tolerates a runtime that exposes no language", () => {
    const html = read("../live/index.html");
    const call = /init\(\{([\s\S]*?)\n\s*\}\);/.exec(html)![1];
    const locale = /locale:\s*([^,\n]+)/.exec(call)![1];
    expect(locale).toMatch(/\?\.|\|\||\?\?/);
  });
});

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
