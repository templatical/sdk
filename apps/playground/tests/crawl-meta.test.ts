import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const APP = join(import.meta.dirname, "..");

describe("playground crawl metadata", () => {
  it("declares no canonical: one fixed URL folds every scene into the home page", () => {
    expect(readFileSync(join(APP, "index.html"), "utf8")).not.toMatch(/rel="canonical"/);
  });

  it("declares no og:url: sharers read it as the canonical, so one fixed value merges every scene and share link", () => {
    expect(readFileSync(join(APP, "index.html"), "utf8")).not.toMatch(
      /<meta[^>]*og:url/,
    );
  });

  it("allows pages and keeps the share API out of crawlers", () => {
    expect(readFileSync(join(APP, "public/robots.txt"), "utf8")).toBe(
      "User-agent: *\nAllow: /\nDisallow: /api/\n",
    );
  });

  it("serves /robots.txt from the static assets", async () => {
    const url = new URL("../public/_worker.js", import.meta.url).href;
    const worker = (await import(/* @vite-ignore */ url)).default;
    const fetch = vi.fn(async (_request: Request) => new Response("ok"));
    await worker.fetch(new Request("https://play.templatical.com/robots.txt"), {
      ASSETS: { fetch },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(fetch.mock.calls[0][0].url).pathname).toBe("/robots.txt");
  });
});
