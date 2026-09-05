import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { runList, runLive } from "../src/cli/commands/live";
import { UsageError } from "../src/cli/io";

let dir: string;
let stdout: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tt-live-"));
  mkdirSync(join(dir, ".templatical"), { recursive: true });
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((c) => {
    stdout.push(String(c));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  setJsonMode(false);
  vi.restoreAllMocks();
});

describe("list command", () => {
  it("lists the working files with a title hint", () => {
    writeFileSync(
      join(dir, ".templatical", "misty-copper-otter.json"),
      JSON.stringify({
        blocks: [{ id: "t", type: "title", content: "Spring Sale", level: 1 }],
        settings: {},
      }),
    );
    writeFileSync(
      join(dir, ".templatical", "quiet-amber-fox.json"),
      JSON.stringify({ blocks: [], settings: {} }),
    );
    setJsonMode(true);
    expect(runList(parseArgs(["list", "--cwd", dir, "--json"]))).toBe(0);
    const out = JSON.parse(stdout.join(""));
    expect(out.templates.map((t: { name: string }) => t.name)).toEqual([
      "misty-copper-otter.json",
      "quiet-amber-fox.json",
    ]);
    expect(out.templates[0].title).toBe("Spring Sale");
    expect(out.templates[1].title).toBeNull();
  });

  it("reports an empty list when there is no working directory", () => {
    const empty = mkdtempSync(join(tmpdir(), "tt-none-"));
    setJsonMode(true);
    expect(runList(parseArgs(["list", "--cwd", empty, "--json"]))).toBe(0);
    expect(JSON.parse(stdout.join("")).templates).toEqual([]);
  });

  it("finds a title nested inside a section's column", () => {
    writeFileSync(
      join(dir, ".templatical", "field-notes.json"),
      JSON.stringify({
        blocks: [
          {
            id: "sec_1",
            type: "section",
            columns: "1",
            styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
            children: [
              [
                {
                  id: "t",
                  type: "title",
                  content: "Field Notes: October",
                  level: 1,
                },
              ],
            ],
          },
        ],
        settings: {},
      }),
    );
    setJsonMode(true);
    expect(runList(parseArgs(["list", "--cwd", dir, "--json"]))).toBe(0);
    const out = JSON.parse(stdout.join(""));
    expect(out.templates[0].title).toBe("Field Notes: October");
  });
});

describe("live reload / stop without a running server", () => {
  it("reload reports that nothing is running", async () => {
    await expect(
      runLive(parseArgs(["live", "reload", "--cwd", dir])),
    ).rejects.toThrow(/no live server/i);
  });

  it("stop reports that nothing is running", async () => {
    await expect(
      runLive(parseArgs(["live", "stop", "--cwd", dir])),
    ).rejects.toThrow(/no live server/i);
  });

  it("treats a pidfile whose process is gone as absent", async () => {
    // A crashed run leaves a stale pidfile; it must not make reload look live.
    writeFileSync(
      join(dir, ".templatical", "live-server.pid"),
      JSON.stringify({ pid: 999999, port: 4747 }),
    );
    await expect(
      runLive(parseArgs(["live", "reload", "--cwd", dir])),
    ).rejects.toThrow(/no live server/i);
  });

  it("rejects an unknown subcommand", async () => {
    await expect(
      runLive(parseArgs(["live", "restart", "--cwd", dir])),
    ).rejects.toThrow(UsageError);
  });
});

// `runLive`'s "start" path blocks forever (it resolves only on SIGINT/SIGTERM,
// via a `new Promise<number>(() => {})`) and its cleanup calls
// `process.exit()` — calling it in-process would hang or kill this test
// worker. The single-instance guard and stop lifecycle can only be exercised
// by spawning the real built CLI as a subprocess, the way a user actually
// runs `live`. That needs dist/bin.js: skipped when this package hasn't been
// built yet (CI builds every package before running tests, so this runs
// there), mirroring the optional-converter skip in the "real fixtures" group
// in cli-import.test.ts.
const BIN = resolve(import.meta.dirname, "../dist/bin.js");

describe.skipIf(!existsSync(BIN))("live daemon lifecycle (spawned CLI)", () => {
  let cwd: string;
  // Every subprocess this suite spawns — the long-running server AND every
  // one-shot `runCli` invocation — is tracked here so afterEach can kill
  // whatever is still alive. Tracking only the long-running server misses the
  // case a `runCli` call itself never exits (e.g. a "start" invocation that
  // slips past a broken already-running guard and blocks forever): that
  // process has no other reference once its own promise stops being awaited,
  // and it would otherwise keep listening on a real port after the test ends.
  let children: ReturnType<typeof spawn>[] = [];

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "tt-live-cli-"));
    children = [];
  });

  afterEach(() => {
    // Never leave a listening port behind, whether the test passed, failed,
    // or the "stop" step didn't actually terminate a child.
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }
    children = [];
    rmSync(cwd, { recursive: true, force: true });
  });

  const pidPath = () => join(cwd, ".templatical", "live-server.pid");

  const poll = async (
    predicate: () => boolean,
    timeoutMs = 4000,
  ): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };

  const spawnServer = (args: string[]): ReturnType<typeof spawn> => {
    const p = spawn(process.execPath, [BIN, ...args], { cwd, stdio: "ignore" });
    children.push(p);
    return p;
  };

  const runCli = (
    args: string[],
  ): Promise<{ code: number | null; out: string }> =>
    new Promise((res) => {
      const p = spawn(process.execPath, [BIN, ...args], { cwd });
      children.push(p);
      let out = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (out += d));
      p.on("close", (code) => res({ code, out }));
    });

  it(
    "refuses a second instance and stops cleanly via the pidfile",
    async () => {
      // Start a long-running bridge on an ephemeral port so the test doesn't
      // fight over a fixed one.
      const server = spawnServer(["live", "--port", "0", "--no-open"]);
      expect(await poll(() => existsSync(pidPath()))).toBe(true);

      // A second start in the same cwd detects the running instance instead
      // of trying (and failing) to bind its own port.
      const second = await runCli(["live", "--port", "0"]);
      expect(second.code).toBe(0);
      expect(second.out).toContain("already running");

      // stop terminates it and removes the pidfile.
      const stop = await runCli(["live", "stop"]);
      expect(stop.code).toBe(0);
      expect(stop.out).toContain("Stopped the live server");
      expect(await poll(() => !existsSync(pidPath()))).toBe(true);
      expect(await poll(() => server.exitCode !== null)).toBe(true);
    },
    // Three real subprocess spawns plus polling — comfortably under 3s with
    // nothing else competing (measured), but the default 5000ms leaves too
    // little headroom under load. A generous per-test timeout here is not
    // masking flakiness: afterEach still force-kills a lingering server
    // regardless of whether this test times out, so a slow run fails loudly
    // rather than leaking a process either way.
    15000,
  );
});
