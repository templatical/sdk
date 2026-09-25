import { beforeAll, describe, expect, it } from "vitest";

interface PagesAssets {
  fetch(request: Request): Promise<Response>;
}

interface PagesWorker {
  fetch(request: Request, env: { ASSETS: PagesAssets }): Promise<Response>;
}

/**
 * The asset server as Cloudflare Pages behaves for this site: an explicit
 * /index.html is a 308 to /, and with no top-level 404.html any path without
 * a file gets the app shell, which is the SPA fallback for /scenes/<id>.
 */
function pagesAssets() {
  const requested: string[] = [];
  const assets: PagesAssets = {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      requested.push(pathname);
      if (pathname === "/index.html") {
        return new Response(null, { status: 308, headers: { location: "/" } });
      }
      if (pathname.endsWith(".md")) {
        return new Response("# scene", {
          headers: { "content-type": "text/markdown; charset=utf-8" },
        });
      }
      return new Response("<!doctype html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  };
  return { assets, requested };
}

let worker: PagesWorker;

beforeAll(async () => {
  // Plain JS deployed as-is, so it has no declarations to import statically.
  const url = new URL("../public/_worker.js", import.meta.url).href;
  worker = (await import(/* @vite-ignore */ url)).default;
});

function get(path: string, assets: PagesAssets): Promise<Response> {
  return worker.fetch(new Request(`https://playground.pages.dev${path}`), {
    ASSETS: assets,
  });
}

describe("playground Pages worker", () => {
  it.each(["/", "/scenes/minimum", "/scenes/does-not-exist"])(
    "serves the app for %s without a redirect",
    async (path) => {
      const { assets } = pagesAssets();
      const response = await get(path, assets);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/html; charset=utf-8",
      );
    },
  );

  it("hands page requests to Pages at their own path", async () => {
    const { assets, requested } = pagesAssets();
    await get("/scenes/minimum?shadowDom=0", assets);
    expect(requested).toEqual(["/scenes/minimum"]);
  });

  it("serves a scene's markdown twin as-is", async () => {
    const { assets, requested } = pagesAssets();
    const response = await get("/scenes/minimum.md", assets);
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(requested).toEqual(["/scenes/minimum.md"]);
  });
});
