import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

// The companion half — that rules.md tells the agent to match
// settings.locale to the copy's own language — asserts this skill's
// content, so it lives with it:
// skills/templatical/tests/template-locale.test.ts.
describe("live-mode locale", () => {
  const html = read("../live/index.html");

  it("passes a locale to init()", () => {
    const call = /init\(\{([\s\S]*?)\n\s*\}\);/.exec(html)?.[1];
    expect(call).toBeDefined();
    expect(call).toContain("locale: readLocale()");
  });

  // Nothing stored: the browser that opens the harness belongs to the person
  // hand-editing in it. A hardcoded tag would be wrong for everyone but one
  // audience. A stored tpl-live-locale overrides that, from the settings menu.
  it("falls back to the viewer's browser language", () => {
    const start = html.indexOf("function readLocale");
    expect(start).toBeGreaterThan(-1);
    const fn = html.slice(start, start + 800);
    expect(fn).toMatch(/navigator\?\.language \|\| undefined/);
    expect(fn).toContain("tpl-live-locale");
  });

  it("offers every editor locale and system, light, and dark", () => {
    expect(html).toContain("getSupportedLocales");
    expect(html).toContain("Intl.DisplayNames");
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('id="live-locale"');
    expect(html).toContain('value="auto"');
    expect(html).toContain('value="light"');
    expect(html).toContain('value="dark"');
    expect(html).not.toContain('id="btn-theme"');
  });
});
