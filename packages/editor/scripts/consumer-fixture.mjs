/**
 * Materialize an `e2e-fixtures/*` consumer project: build and pack every
 * workspace `@templatical/*` package the fixture pulls in, install the tarballs,
 * and pin the transitive ones so nothing is resolved from the registry.
 *
 * Every published package except the editor leaves `@templatical/types`
 * external — `core`, `quality`, `media-library`, `renderer` and the three
 * `import-*` converters all declare it as a runtime dependency, and only the
 * editor bundles it. So any fixture that installs one of them resolves types
 * itself, and `pnpm pack` rewrites the `workspace:*` spec to the current
 * version, which npm then fetches from the registry. A symbol added to types in
 * the same PR is missing from that published copy, and the harness fails with
 * `export 'x' was not found` on the PR that introduces it and nowhere else.
 * Hence the synthesized `overrides`: the closure is derived from the workspace
 * graph rather than named, so pointing a fixture at another package costs
 * nothing and cannot reintroduce that failure.
 *
 * The packages ship as one changesets `fixed` group, so a real install never
 * pairs a new dependent with an older dependency — only this harness can
 * manufacture that pairing. If they ever stop being one group, these overrides
 * start hiding a genuine range-resolution failure and the fix moves to the
 * package boundary instead (issue #549).
 */

import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const SCOPE = "@templatical/";

/**
 * `@templatical/import-beefree` -> `IMPORT_BEEFREE_TARBALL_PLACEHOLDER`.
 *
 * Fixtures write the token instead of a version so the manifest stays readable
 * as a consumer manifest; deriving it from the name in both directions is what
 * keeps a fixture from inventing a spelling the script never substitutes.
 */
export function tarballPlaceholder(pkgName) {
  return `${pkgName.slice(SCOPE.length).replace(/-/g, "_").toUpperCase()}_TARBALL_PLACEHOLDER`;
}

/** Read every workspace package under `packages/` into a name -> manifest map. */
export function readWorkspacePackages(repoRoot) {
  const packagesDir = join(repoRoot, "packages");
  const manifests = new Map();
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(packagesDir, entry.name, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifests.set(manifest.name, {
      ...manifest,
      dir: join(packagesDir, entry.name),
    });
  }
  return manifests;
}

function scopedKeys(manifest, field) {
  return Object.keys(manifest?.[field] ?? {}).filter((name) =>
    name.startsWith(SCOPE),
  );
}

/**
 * The `@templatical/*` packages a fixture declares directly, in declaration
 * order. Throws when a dependency's spec isn't the placeholder this script
 * substitutes — a typo would otherwise install whatever the registry has.
 */
export function readFixtureRoots(fixtureManifest) {
  const roots = [];
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of scopedKeys(fixtureManifest, field)) {
      const spec = fixtureManifest[field][name];
      const expected = tarballPlaceholder(name);
      if (spec !== expected) {
        throw new Error(
          `fixture declares ${name}: "${spec}" — expected the placeholder "${expected}"`,
        );
      }
      roots.push(name);
    }
  }
  return roots;
}

/**
 * Walk `dependencies` from the fixture's direct packages to everything npm
 * would resolve transitively. `peerDependencies` are deliberately not followed:
 * the editor's three are optional, so npm never installs them, and a fixture
 * that wants one declares it directly.
 */
export function resolveWorkspaceClosure(roots, manifests) {
  const closure = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.shift();
    if (closure.has(name)) continue;
    const manifest = manifests.get(name);
    if (!manifest) {
      throw new Error(`${name} is not a workspace package under packages/`);
    }
    closure.add(name);
    queue.push(...scopedKeys(manifest, "dependencies"));
  }
  const rootSet = new Set(roots);
  return {
    closure: [...closure].sort(),
    transitive: [...closure].filter((name) => !rootSet.has(name)).sort(),
  };
}

/**
 * Build order for a closure. Edges are `dependencies` + `peerDependencies`,
 * because a package's `dist/` must exist before a dependent's `vue-tsc` /
 * api-extractor step resolves it through the workspace symlink — and the editor
 * reaches `renderer` and `quality` only as peers. That edge set is acyclic
 * across the whole workspace; `devDependencies` are excluded because types
 * dev-depends on media-library, which is the one documented cycle.
 */
export function buildOrder(closure, manifests) {
  const inClosure = new Set(closure);
  const deps = new Map(
    closure.map((name) => [
      name,
      new Set(
        ["dependencies", "peerDependencies"]
          .flatMap((field) => scopedKeys(manifests.get(name), field))
          .filter((dep) => inClosure.has(dep)),
      ),
    ]),
  );

  const ordered = [];
  const remaining = [...closure].sort();
  while (remaining.length > 0) {
    const next = remaining.filter((name) =>
      [...deps.get(name)].every((dep) => ordered.includes(dep)),
    );
    if (next.length === 0) {
      throw new Error(
        `cycle in @templatical build order among: ${remaining.join(", ")}`,
      );
    }
    for (const name of next) {
      ordered.push(name);
      remaining.splice(remaining.indexOf(name), 1);
    }
  }
  return ordered;
}

const OVERRIDES_NOTE =
  "The dependencies above are exactly what a real consumer writes. These " +
  "overrides pin each transitively-resolved @templatical package to its packed " +
  "workspace build; npm would otherwise fetch the last published copy, which " +
  "predates any symbol added this release. Generated by " +
  "packages/editor/scripts/consumer-fixture.mjs — see its header for why.";

/**
 * Build, pack, materialize and `npm install`. Returns the closure it resolved so
 * callers can log what the fixture actually pulled in.
 */
export function materializeConsumer({
  repoRoot,
  fixtureDir,
  consumerDir,
  packDir,
  log = () => {},
}) {
  if (!existsSync(fixtureDir)) {
    throw new Error(`fixture dir not found: ${fixtureDir}`);
  }

  const manifests = readWorkspacePackages(repoRoot);
  const fixtureManifestText = readFileSync(
    join(fixtureDir, "package.json.tpl"),
    "utf8",
  );
  const roots = readFixtureRoots(JSON.parse(fixtureManifestText));
  const { closure, transitive } = resolveWorkspaceClosure(roots, manifests);

  log(`closure: ${closure.join(", ")}`);
  if (transitive.length > 0)
    log(`pinned transitively: ${transitive.join(", ")}`);

  for (const name of buildOrder(closure, manifests)) {
    run(`pnpm --filter ${name} run build`, { cwd: repoRoot }, log);
  }

  const tarballs = new Map();
  for (const name of closure) {
    const { dir } = manifests.get(name);
    run(`pnpm pack --pack-destination "${packDir}"`, { cwd: dir }, log);
    const prefix = `${name.replace("@", "").replace("/", "-")}-`;
    const tarball = readdirSync(packDir).find(
      (file) => file.startsWith(prefix) && file.endsWith(".tgz"),
    );
    if (!tarball) throw new Error(`pnpm pack did not produce a ${name} .tgz`);
    tarballs.set(name, `file:${join(packDir, tarball)}`);
  }

  rmSync(consumerDir, { recursive: true, force: true });
  mkdirSync(consumerDir, { recursive: true });
  cpSync(fixtureDir, consumerDir, { recursive: true });

  // The fixture ships its manifest as `package.json.tpl` so syncpack and pnpm
  // don't treat it as a workspace package.
  rmSync(join(consumerDir, "package.json.tpl"));
  let manifest = JSON.parse(fixtureManifestText);
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of scopedKeys(manifest, field)) {
      manifest[field][name] = tarballs.get(name);
    }
  }
  if (transitive.length > 0) {
    manifest = {
      ...manifest,
      "//overrides": OVERRIDES_NOTE,
      overrides: Object.fromEntries(
        transitive.map((name) => [name, tarballs.get(name)]),
      ),
    };
  }
  const consumerPkgPath = join(consumerDir, "package.json");
  writeFileSync(consumerPkgPath, `${JSON.stringify(manifest, null, 2)}\n`);

  run(`npm install --no-fund --no-audit`, { cwd: consumerDir }, log);

  return { closure, transitive, consumerPkgPath };
}

function run(cmd, opts, log) {
  log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

/** Resolve the repo root from a script in `packages/editor/scripts/`. */
export function repoRootFrom(scriptDir) {
  return resolve(scriptDir, "../../..");
}
