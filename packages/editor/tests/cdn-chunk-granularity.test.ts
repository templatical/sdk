import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, posix } from "node:path";
import { init as initLexer, parse } from "es-module-lexer";

/**
 * Guards the CDN bundle's lazy-loading contract.
 *
 * `bundle-topology.test.ts` deliberately skips `dist/cdn/`, so for a long time
 * nothing checked the CDN build's chunk graph at all — which is how the former
 * `features` manual chunk went unnoticed. That entry forced six
 * `defineAsyncComponent` cloud panels (AiChatSidebar, CommentsSidebar,
 * DesignReferenceSidebar, TemplateScoringPanel, TestEmailModal, SnapshotHistory)
 * into one chunk that became statically reachable from the entry. Every Cloud
 * session downloaded all 66.5 KB gzip of it whether or not the user opened a
 * single panel: `defineAsyncComponent` was fully defeated, silently, for years.
 *
 * The invariant here is the one that actually matters to a consumer: **a
 * component the source lazy-loads must not be in the entry's static-import
 * closure.** That is deliberately phrased in terms of reachability rather than
 * chunk names or sizes, because the failure mode moves around — removing only
 * the `features` group promoted `media-library` to eager instead, and removing
 * that promoted `quality`. Any `manualChunks` rule over first-party source can
 * create the bridge, so the test checks the property, not a blocklist.
 *
 * Requires the CDN build. The editor's `build:all` runs both vite configs and
 * the root `build` calls it, so `dist/cdn/` exists in CI's build and test jobs.
 */

const PKG = join(import.meta.dirname, "..");
const CDN = join(PKG, "dist", "cdn");
const SRC = join(PKG, "src");
const ENTRY = "editor.js";

/** Every `.js` chunk in the CDN output, as paths relative to `dist/cdn`. */
function listChunks(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listChunks(abs, relPath));
    else if (entry.name.endsWith(".js")) out.push(relPath);
  }
  return out;
}

/** Recursively collect `.vue` / `.ts` source files under `src/`. */
function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSources(abs));
    else if (/\.(vue|ts)$/.test(entry.name)) out.push(abs);
  }
  return out;
}

/**
 * Component basenames the source lazy-loads, e.g. `TestEmailModal`.
 *
 * Read from source rather than hard-coded so a newly added lazy dialog is
 * covered the moment it lands — the point is that nobody has to remember to
 * update this test.
 */
function findLazyComponents(): Set<string> {
  const found = new Set<string>();
  // `defineAsyncComponent(() => import("./Foo.vue"))`, with or without a
  // wrapping async arrow, across one or more lines.
  const pattern = /defineAsyncComponent\s*\([\s\S]{0,200}?import\(\s*["']([^"']+\.vue)["']/g;
  for (const file of listSources(SRC)) {
    const src = readFileSync(file, "utf8");
    for (const match of src.matchAll(pattern)) {
      found.add(basename(match[1], ".vue"));
    }
  }
  return found;
}

describe("CDN chunk granularity", () => {
  let chunks: string[];
  /** chunk -> chunks it imports STATICALLY (dynamic imports excluded). */
  let staticImports: Map<string, string[]>;
  /** component basename -> chunk containing it, from the emitted sourcemaps. */
  let owner: Map<string, string>;
  /** Chunks reachable from the entry via static imports only. */
  let eager: Set<string>;
  let lazyComponents: Set<string>;

  beforeAll(async () => {
    if (!existsSync(CDN)) {
      throw new Error(
        `dist/cdn/ not found. Run \`pnpm --filter @templatical/editor run build:cdn\` before running this test.`,
      );
    }
    await initLexer;

    chunks = listChunks(CDN);
    staticImports = new Map();
    owner = new Map();

    for (const rel of chunks) {
      const source = readFileSync(join(CDN, rel), "utf8");
      const [imports] = parse(source, rel);
      staticImports.set(
        rel,
        imports
          // `d === -1` marks a static import. Dynamic imports (`d > -1`) are
          // separate on-demand fetches and must NOT count toward reachability —
          // they are the whole mechanism under test.
          .filter((i) => i.d === -1 && i.n?.startsWith("."))
          .map((i) => posix.normalize(posix.join(posix.dirname(rel), i.n!))),
      );

      // Sourcemaps are the only reliable way to map a component to its chunk:
      // manualChunks renames output files, and most components share only
      // generic `tpl-*` token classes, so filenames and content probes both lie.
      try {
        const map = JSON.parse(readFileSync(join(CDN, `${rel}.map`), "utf8"));
        for (const src of (map.sources ?? []) as string[]) {
          if (!src.endsWith(".vue")) continue;
          const name = basename(src, ".vue");
          if (!owner.has(name)) owner.set(name, rel);
        }
      } catch {
        // No sourcemap for this chunk; other chunks still provide coverage.
      }
    }

    eager = new Set<string>();
    const stack = [ENTRY];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (eager.has(current) || !staticImports.has(current)) continue;
      eager.add(current);
      stack.push(...staticImports.get(current)!);
    }

    lazyComponents = findLazyComponents();
  });

  it("emits the entry chunk and sourcemaps to resolve components against", () => {
    expect(chunks).toContain(ENTRY);
    expect(existsSync(join(CDN, `${ENTRY}.map`))).toBe(true);
    // If the sourcemap->component mapping silently produced nothing, every
    // reachability assertion below would pass vacuously.
    expect(owner.size).toBeGreaterThan(20);
  });

  it("finds the lazy components by reading source, and they resolve to chunks", () => {
    // Sanity-check the source scan itself. Known lazy dialogs across both the
    // OSS and cloud surfaces — if the regex breaks, this fails loudly instead of
    // letting the real assertion pass with an empty set.
    expect(lazyComponents.has("TestEmailModal")).toBe(true);
    expect(lazyComponents.has("SaveBlockDialog")).toBe(true);
    expect(lazyComponents.has("AiChatSidebar")).toBe(true);
    expect(lazyComponents.size).toBeGreaterThanOrEqual(10);
  });

  it("never puts a lazy-loaded component in the entry's static-import closure", () => {
    // Deliberately unconditional: a static import site elsewhere is NOT an excuse.
    // What matters is only whether the component ends up eagerly reachable, and
    // the closure already answers that — a component can be statically imported
    // by a parent that is itself lazy and stay correctly lazy (as
    // `BlockPreviewCanvas` does, shared by the save dialog's preview rows and
    // the browser modal's preview pane). Excusing every component with a static
    // site would have silently stopped covering those.
    const eagerlyShipped: string[] = [];
    for (const name of lazyComponents) {
      const chunk = owner.get(name);
      // Not every lazy component resolves to a chunk (e.g. one gated behind an
      // optional peer that this build externalizes) — those are simply absent.
      if (chunk && eager.has(chunk)) {
        eagerlyShipped.push(`${name} -> ${chunk}`);
      }
    }
    expect(eagerlyShipped).toEqual([]);
  });

  it("keeps each of the six formerly-merged cloud panels in its own chunk", () => {
    // The specific regression: these six shared one `features` chunk, so opening
    // any one of them fetched all six. Asserted as distinct chunks rather than by
    // size so it stays meaningful as the components grow.
    const panels = [
      "AiChatSidebar",
      "CommentsSidebar",
      "DesignReferenceSidebar",
      "TemplateScoringPanel",
      "TestEmailModal",
      "SnapshotHistory",
    ];
    const resolved = panels.map((name) => owner.get(name));
    expect(resolved.every((chunk) => typeof chunk === "string")).toBe(true);
    expect(new Set(resolved).size).toBe(panels.length);
  });

  it("does not group first-party source into a named vendor chunk", () => {
    // `manualChunks` may only group third-party dependencies. A chunk named after
    // one of our own packages or feature areas means a source-grouping rule came
    // back, which is what made lazy chunks eager in the first place.
    const banned = ["features-", "media-library-", "quality-", "renderer-"];
    const offenders = chunks
      .map((chunk) => basename(chunk))
      .filter((name) => banned.some((prefix) => name.startsWith(prefix)));
    expect(offenders).toEqual([]);
  });
});
