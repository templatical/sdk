import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(import.meta.dirname, "../live/index.html"), "utf8");
const initCall = html.slice(
  html.indexOf("editor = await init({"),
  html.indexOf("});", html.indexOf("editor = await init({")),
);

describe("live harness custom-block mode", () => {
  it("passes customBlocks into init", () => {
    expect(initCall).toContain("customBlocks: customBlocksConfig()");
  });
  it("loads the definition at boot and remounts on a custom-block event", () => {
    expect(html).toContain('fetch("/custom-block")');
    expect(html).toMatch(/addEventListener\("custom-block",[\s\S]*?mountEditor\(/);
  });
  it("routes onFetch through the bridge with fieldValues only", () => {
    expect(html).toContain('fetch("/data-source/fetch"');
    expect(html).toContain("JSON.stringify({ fieldValues })");
    expect(html).not.toMatch(/data-source\/fetch[\s\S]{0,200}headers:\s*\{[^}]*Authorization/);
  });
});
