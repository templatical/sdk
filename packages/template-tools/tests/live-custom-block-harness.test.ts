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

describe("live harness onFetch", () => {
  // The page's own customBlocksConfig, run against stubbed fetch and toast.
  const source = html.slice(
    html.indexOf("function customBlocksConfig()"),
    html.indexOf("async function mountEditor"),
  );
  const onFetch = (reply: { ok: boolean; body: unknown }, toasts: string[]) =>
    new Function(
      "customBlock",
      "fetch",
      "toast",
      `${source}\nreturn customBlocksConfig()[0].dataSource.onFetch;`,
    )(
      { definition: { type: "p" }, dataSource: { label: "Fetch" } },
      async () => ({ ok: reply.ok, json: async () => reply.body }),
      (m: string) => toasts.push(m),
    ) as (ctx: { fieldValues: object }) => Promise<unknown>;

  it("throws the bridge's error, so the toolbar shows its error state", async () => {
    const toasts: string[] = [];
    const error = "Environment variable SHOP_TOKEN is not set.";
    await expect(
      onFetch({ ok: false, body: { error } }, toasts)({ fieldValues: {} }),
    ).rejects.toThrow(error);
    expect(toasts).toEqual([error]);
  });

  it("returns the mapped values and names the ones the response lacked", async () => {
    const toasts: string[] = [];
    const values = await onFetch(
      { ok: true, body: { values: { name: "Lamp" }, unmapped: ["price"] } },
      toasts,
    )({ fieldValues: {} });
    expect(values).toEqual({ name: "Lamp" });
    expect(toasts).toEqual(["Not in the response: price"]);
  });
});
