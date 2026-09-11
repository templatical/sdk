import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

// The companion half — that SKILL.md tells the agent to match
// settings.locale to the copy's own language — asserts this skill's
// content, so it lives with it:
// skills/templatical-email/tests/template-locale.test.ts.
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
