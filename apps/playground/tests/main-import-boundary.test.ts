import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MAIN_TS = join(import.meta.dirname, "../src/main.ts");

/**
 * `main.ts` is the app's eager entry — everything it imports statically
 * ships in the entry chunk before any route resolves, unlike
 * `CapabilityShell.vue`, which is only ever fetched behind the
 * `defineAsyncComponent` call in `main.ts` itself. Both
 * `./shell/useCapabilityRoute` and `@/config/capabilities` reach the same
 * barrel: the route module's own top-level import pulls in every
 * capability's title, blurb, controls and provider factories. `main.ts`
 * needs only the `"#capabilities"` string to key its route table, so it
 * hardcodes the literal (matching how `"#cloud"` and `"#multi"` are already
 * plain literals) instead of importing `CAPABILITY_ROUTE`. Importing either
 * module here would drag the whole registry back into the eager chunk with
 * no signal until someone diffs a production build — a build-output
 * assertion would catch that too, but a real build is too slow and too
 * environment-dependent to run on every test pass, so this source-level
 * check is the fast guard that runs instead.
 *
 * Match the module specifier itself, never the keyword that introduces it —
 * a bare side-effect import (`import "@/config/capabilities"`) has no
 * `from` at all, so anchoring on `from` is a guard with a hole in it. The
 * anchor is what follows the path instead: an optional `/index`, an
 * optional `.ts`/`.js` extension, then the closing quote.
 */
const FORBIDDEN = [
  /\.\/shell\/useCapabilityRoute(?:\.(?:ts|js))?["']/,
  /@\/config\/capabilities(?:\/index)?(?:\.(?:ts|js))?["']/,
];

describe("main.ts import boundary", () => {
  const source = readFileSync(MAIN_TS, "utf8");

  it("reads the real entry file", () => {
    expect(source).toContain('app.mount("#app")');
  });

  it("does not import the capability route module or the capability barrel", () => {
    const offenders = FORBIDDEN.filter((pattern) => pattern.test(source));
    expect(offenders).toEqual([]);
  });
});

/**
 * Pattern coverage, the same discipline as `e2e-import-boundary.test.ts`'s
 * table: each row is a source line a contributor could plausibly write, and
 * `caught` is what `FORBIDDEN` must say about it — so the regex is proven
 * independent of whatever `main.ts` happens to contain today.
 */
describe("FORBIDDEN pattern coverage", () => {
  const specimens: [name: string, source: string, caught: boolean][] = [
    [
      "named import of the route module",
      'import { CAPABILITY_ROUTE } from "./shell/useCapabilityRoute";',
      true,
    ],
    [
      "named import of the route module with a .ts extension",
      'import { CAPABILITY_ROUTE } from "./shell/useCapabilityRoute.ts";',
      true,
    ],
    [
      "single-quoted import of the route module",
      "import { CAPABILITY_ROUTE } from './shell/useCapabilityRoute';",
      true,
    ],
    [
      "side-effect import of the barrel",
      'import "@/config/capabilities";',
      true,
    ],
    [
      "named import of the barrel's explicit index",
      'import { capabilities } from "@/config/capabilities/index";',
      true,
    ],
    [
      "type-only import of the barrel",
      'import type { Capability } from "@/config/capabilities";',
      true,
    ],
    [
      "lazy import of the shell component is unaffected",
      'const CapabilityShell = defineAsyncComponent(() => import("./shell/CapabilityShell.vue"));',
      false,
    ],
    [
      "import of an unrelated shell module",
      'import CapabilityRail from "./shell/CapabilityRail.vue";',
      false,
    ],
  ];

  it.each(specimens)("%s", (_name, source, caught) => {
    expect(FORBIDDEN.some((pattern) => pattern.test(source))).toBe(caught);
  });
});
