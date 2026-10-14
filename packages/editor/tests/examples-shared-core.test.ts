import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EXAMPLES = join(import.meta.dirname, "../../../examples");

// Where each shared core file lives in each full-stack example. The paths differ
// because every framework keeps server-only code in its own place: SvelteKit's
// $lib/server, React Router's .server.ts suffix, Nuxt's server/. The contents
// must not differ: a fix applied to one copy and missed in the others would
// leave the examples teaching different code under the same name.
const CORE: Record<string, Record<string, string>> = {
  "store.ts": {
    nextjs: "lib/templatical/server/store.ts",
    nuxt: "server/utils/templatical/store.ts",
    sveltekit: "src/lib/server/templatical/store.ts",
    "react-router": "app/lib/templatical/store.server.ts",
  },
  "render.ts": {
    nextjs: "lib/templatical/server/render.ts",
    nuxt: "server/utils/templatical/render.ts",
    sveltekit: "src/lib/server/templatical/render.ts",
    "react-router": "app/lib/templatical/render.server.ts",
  },
  "outbox.ts": {
    nextjs: "lib/templatical/server/outbox.ts",
    nuxt: "server/utils/templatical/outbox.ts",
    sveltekit: "src/lib/server/templatical/outbox.ts",
    "react-router": "app/lib/templatical/outbox.server.ts",
  },
  "providers.ts": {
    nextjs: "lib/templatical/providers.ts",
    nuxt: "app/utils/templatical/providers.ts",
    sveltekit: "src/lib/templatical/providers.ts",
    "react-router": "app/lib/templatical/providers.ts",
  },
};

// The one example without a backend, so without the shared core.
const NO_BACKEND = new Set(["react-vite"]);

const read = (example: string, rel: string) =>
  readFileSync(join(EXAMPLES, example, rel), "utf8");

describe("the full-stack examples' shared core", () => {
  it("classifies every example on disk as full-stack or backend-free", () => {
    const onDisk = readdirSync(EXAMPLES)
      .filter((name) => statSync(join(EXAMPLES, name)).isDirectory())
      .sort();
    const fullStack = Object.keys(CORE["store.ts"]);
    expect(onDisk).toEqual([...fullStack, ...NO_BACKEND].sort());
    for (const paths of Object.values(CORE)) {
      expect(Object.keys(paths)).toEqual(fullStack);
    }
  });

  it.each(Object.entries(CORE))(
    "%s is byte-identical in every full-stack example",
    (_file, paths) => {
      const reference = read("nextjs", paths.nextjs);
      for (const [example, rel] of Object.entries(paths)) {
        expect(
          read(example, rel),
          `examples/${example}/${rel} differs from examples/nextjs/${paths.nextjs}`,
        ).toBe(reference);
      }
    },
  );

  it.each(Object.entries(CORE))(
    "%s imports only Node built-ins, @templatical packages and mjml",
    (_file, paths) => {
      // A relative import between core files would have to name a different
      // path in React Router (store.server.ts, not store.ts), which breaks the
      // byte identity above; a framework alias ($lib, ~/, @/) resolves in one
      // framework only.
      // `… from "x"` (imports and re-exports), side-effect `import "x";`,
      // dynamic `import("x")` and `require("x")`.
      const specifiers = [
        ...read("nextjs", paths.nextjs).matchAll(
          /(?:^\s*import\s+|\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/gm,
        ),
      ].map(([, specifier]) => specifier);
      expect(specifiers.length).toBeGreaterThan(0);
      expect(
        specifiers.filter(
          (specifier) =>
            !/^node:/.test(specifier) &&
            !specifier.startsWith("@templatical/") &&
            specifier !== "mjml",
        ),
      ).toEqual([]);
    },
  );
});
