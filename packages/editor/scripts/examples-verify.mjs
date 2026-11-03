#!/usr/bin/env node
/**
 * Verify one `examples/<name>` against this checkout's packages. It
 * materializes the example in a temp directory with every @templatical
 * dependency (including the editor's optional quality dependency) pointed at
 * a packed tarball, runs its production build and its
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
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { constants, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { materializeExample, repoRootFrom } from "./consumer-fixture.mjs";

// Ports below Linux's ephemeral range (32768–60999): one inside it can be the
// local port of an outgoing or TIME_WAIT socket when the server starts, and the
// bind fails with EADDRINUSE although nothing listens. tests/ci-ports.test.ts
// holds every port CI binds to this.
export const EXAMPLES = {
  nextjs: {
    port: 21741,
    kind: "fullstack",
    startArgs: (port) => ["--port", String(port)],
  },
  nuxt: { port: 21742, kind: "fullstack", startArgs: () => [] },
  sveltekit: { port: 21743, kind: "fullstack", startArgs: () => [] },
  "react-router": { port: 21744, kind: "fullstack", startArgs: () => [] },
  "react-vite": {
    port: 21745,
    kind: "minimal",
    // vite preview listens on whichever address `localhost` resolves to first,
    // and in CI's Playwright container the probe never reached it. Binding and
    // probing 127.0.0.1 puts both ends on one address.
    host: "127.0.0.1",
    startArgs: (port) => [
      "--port",
      String(port),
      "--strictPort",
      "--host",
      "127.0.0.1",
    ],
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

const TCP_STATES = {
  "01": "ESTABLISHED",
  "02": "SYN_SENT",
  "03": "SYN_RECV",
  "04": "FIN_WAIT1",
  "05": "FIN_WAIT2",
  "06": "TIME_WAIT",
  "07": "CLOSE",
  "08": "CLOSE_WAIT",
  "09": "LAST_ACK",
  "0A": "LISTEN",
  "0B": "CLOSING",
};

/**
 * The sockets whose local port is `port`, from Linux's `/proc/net/tcp` and
 * `tcp6` tables (keyed by path; a missing table is skipped). Addresses stay in
 * the tables' hex; `inode` is `"0"` for a socket no process owns, such as one
 * in TIME_WAIT.
 */
export function socketsOnPort(tables, port) {
  const suffix = `:${port.toString(16).toUpperCase().padStart(4, "0")}`;
  const sockets = [];
  for (const [table, text] of Object.entries(tables)) {
    for (const row of text.split("\n").slice(1)) {
      const fields = row.trim().split(/\s+/);
      if (!fields[1]?.endsWith(suffix)) continue;
      sockets.push({
        table,
        local: fields[1],
        remote: fields[2],
        state: TCP_STATES[fields[3]] ?? fields[3],
        inode: fields[9],
      });
    }
  }
  return sockets;
}

/** The command line of the process that owns each socket inode, best effort. */
function socketOwners() {
  const owners = new Map();
  let pids = [];
  try {
    pids = readdirSync("/proc").filter((entry) => /^\d+$/.test(entry));
  } catch {
    return owners;
  }
  for (const pid of pids) {
    let fds = [];
    try {
      fds = readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      try {
        const inode = /^socket:\[(\d+)\]$/.exec(
          readlinkSync(`/proc/${pid}/fd/${fd}`),
        )?.[1];
        if (inode && !owners.has(inode)) {
          const command = readFileSync(`/proc/${pid}/cmdline`, "utf8")
            .replaceAll("\0", " ")
            .trim();
          owners.set(inode, `${pid} ${command}`);
        }
      } catch {
        // the process or descriptor went away
      }
    }
  }
  return owners;
}

/**
 * Print what holds `port` when a server exits before answering, so a bind
 * failure names its cause. Linux only: elsewhere there's no `/proc/net/tcp`.
 */
function logPortHolders(port) {
  const tables = {};
  for (const path of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    try {
      tables[path] = readFileSync(path, "utf8");
    } catch {
      // not Linux, or no IPv6
    }
  }
  if (Object.keys(tables).length === 0) return;
  const sockets = socketsOnPort(tables, port);
  if (sockets.length === 0) {
    log(`no socket holds port ${port}`);
    return;
  }
  const owners = socketOwners();
  log(`sockets on port ${port}:`);
  for (const socket of sockets) {
    const owner = owners.get(socket.inode) ?? "no owning process";
    log(
      `  ${socket.state} ${socket.local} -> ${socket.remote} (${socket.table}; ${owner})`,
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
    if (server.exitCode !== null || server.signalCode !== null) {
      logPortHolders(example.port);
    }
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
  const url = `http://${example.host ?? "localhost"}:${example.port}`;
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

// Run only as a script: tests/ci-ports.test.ts imports the port table. Both
// sides are realpaths, since import.meta.url resolves symlinks and argv
// doesn't.
function invokedDirectly() {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
