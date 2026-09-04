import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
