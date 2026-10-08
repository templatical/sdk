#!/usr/bin/env node
/**
 * Verify one `examples/<name>` against this checkout's packages. It
 * materializes the example in a temp directory with every @templatical
 * dependency pointed at a packed tarball, runs its production build and its
 * typecheck, serves it, and runs the Playwright smoke spec against it.
 *
 * Usage: node packages/editor/scripts/examples-verify.mjs <name> [--build] [--keep]
 *   --build  build the packages first. CI skips it: the build job's dist is
 *            downloaded.
 *   --keep   keep the temp directory after a passing run too.
 *
 * The nextjs build doubles as the Turbopack consumer check: Next.js 16 builds
 * with Turbopack, which rejects a UMD/AMD `define()` wrapper in the editor
 * bundle with `error TP1200` (issue #67).
 *
 * A failing run keeps its temp directory and prints its path; a passing run
 * removes it unless --keep is given.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { constants, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { materializeExample, repoRootFrom } from "./consumer-fixture.mjs";

const EXAMPLES = {
  nextjs: {
    port: 51741,
    kind: "fullstack",
    startArgs: (port) => ["--port", String(port)],
  },
  nuxt: { port: 51742, kind: "fullstack", startArgs: () => [] },
  sveltekit: { port: 51743, kind: "fullstack", startArgs: () => [] },
  "react-router": { port: 51744, kind: "fullstack", startArgs: () => [] },
  "react-vite": {
    port: 51745,
    kind: "minimal",
    startArgs: (port) => ["--port", String(port), "--strictPort"],
  },
};

const TELEMETRY_OFF = {
  NEXT_TELEMETRY_DISABLED: "1",
  NUXT_TELEMETRY_DISABLED: "1",
};

const log = (line) => console.log(`[examples] ${line}`);

function describeExit(result) {
  if (result.error) return result.error.message;
  return result.signal ? `signal ${result.signal}` : `exit ${result.status}`;
}

function buildExample(consumerDir, name) {
  const result = spawnSync("npm", ["run", "build"], {
    cwd: consumerDir,
    encoding: "utf8",
    env: { ...process.env, ...TELEMETRY_OFF },
    // A framework build can print more than spawnSync's 1 MB default.
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(output);
  if (/error TP1200/.test(output)) {
    throw new Error(
      `${name}: Turbopack rejected the editor bundle (error TP1200, issue #67)`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`${name}: npm run build failed (${describeExit(result)})`);
  }
}

function typecheckExample(consumerDir, name) {
  const result = spawnSync("npm", ["run", "typecheck"], {
    cwd: consumerDir,
    stdio: "inherit",
    env: { ...process.env, ...TELEMETRY_OFF },
  });
  if (result.status !== 0) {
    throw new Error(
      `${name}: npm run typecheck failed (${describeExit(result)})`,
    );
  }
}

/** Whether anything answers HTTP on `url`, whatever the status. */
async function answers(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return true;
  } catch {
    return false;
  }
}

async function assertPortFree(url, name) {
  if (await answers(url)) {
    throw new Error(
      `${url} already answers: stop that server first, or this run would test it instead of ${name}`,
    );
  }
}

/** Resolves once `url` answers 2xx; rejects as soon as `server` exits. */
async function waitForServer(url, server, timeoutMs = 90_000) {
  let exited = null;
  server.once("exit", (code, signal) => {
    exited = signal ? `signal ${signal}` : `exit ${code}`;
  });
  const deadline = Date.now() + timeoutMs;
  let lastStatus = null;
  while (Date.now() < deadline) {
    if (exited)
      throw new Error(`the server stopped before answering (${exited})`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (response.ok) return;
      lastStatus = response.status;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    lastStatus === null
      ? `no answer from ${url} within ${timeoutMs / 1000}s`
      : `${url} still answered ${lastStatus} after ${timeoutMs / 1000}s`,
  );
}

function runPlaywright(repoRoot, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      join(repoRoot, "node_modules", ".bin", "playwright"),
      ["test", "--config", "playwright.examples.config.ts"],
      { cwd: repoRoot, stdio: "inherit", env },
    );
    child.once("error", reject);
    child.once("exit", (code) => resolve(code === 0));
  });
}

/**
 * Serve the built example and run the smoke spec against it. The server gets
 * its own process group so its whole tree stops together, on every exit path
 * and on SIGINT, SIGTERM or SIGHUP: a signal would otherwise end this process
 * without running `finally`.
 */
async function serveAndTest({
  name,
  example,
  url,
  consumerDir,
  dataDir,
  repoRoot,
}) {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(example.port),
    NITRO_PORT: String(example.port),
    TEMPLATICAL_DATA_DIR: dataDir,
  };
  await assertPortFree(url, name);
  const server = spawn(
    "npm",
    ["run", "start", "--", ...example.startArgs(example.port)],
    {
      cwd: consumerDir,
      env,
      stdio: "inherit",
      detached: true,
    },
  );
  const stopServer = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  };
  const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
  const onSignal = (signal) => {
    stopServer();
    process.exit(128 + constants.signals[signal]);
  };
  for (const signal of SIGNALS) process.once(signal, onSignal);

  try {
    await waitForServer(url, server);
    log(`serving ${url}`);
    return await runPlaywright(repoRoot, {
      ...env,
      NODE_ENV: "test",
      EXAMPLE: name,
      EXAMPLE_KIND: example.kind,
      EXAMPLE_URL: url,
    });
  } catch (error) {
    console.error(error.message);
    return false;
  } finally {
    stopServer();
    for (const signal of SIGNALS) process.off(signal, onSignal);
  }
}

async function main() {
  const name = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const example = EXAMPLES[name];
  if (!example) {
    console.error(
      `usage: examples-verify.mjs <${Object.keys(EXAMPLES).join("|")}> [--build] [--keep]`,
    );
    process.exit(2);
  }

  const repoRoot = repoRootFrom(dirname(fileURLToPath(import.meta.url)));
  const url = `http://localhost:${example.port}`;
  // Checked again right before the server starts; this one fails before the
  // build instead of after it.
  await assertPortFree(url, name);

  const work = mkdtempSync(join(tmpdir(), `templatical-example-${name}-`));
  const consumerDir = join(work, "app");
  let passed = false;
  try {
    materializeExample({
      repoRoot,
      exampleDir: join(repoRoot, "examples", name),
      consumerDir,
      packDir: join(work, "packs"),
      build: process.argv.includes("--build"),
      log,
    });
    buildExample(consumerDir, name);
    typecheckExample(consumerDir, name);
    passed = await serveAndTest({
      name,
      example,
      url,
      consumerDir,
      dataDir: join(work, "data"),
      repoRoot,
    });
  } finally {
    if (passed && !process.argv.includes("--keep"))
      rmSync(work, { recursive: true, force: true });
    else log(`kept ${work} for inspection`);
  }
  process.exit(passed ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
