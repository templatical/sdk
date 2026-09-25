import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const live = vi.hoisted(() => ({
  readPidfile: vi.fn(),
  processAlive: vi.fn(),
  startBridgePreferring: vi.fn(),
  openBrowser: vi.fn(),
  pidfilePath: (cwd: string) => join(cwd, ".templatical", "live-server.pid"),
}));

vi.mock("../src/live/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/live/index")>();
  return {
    ...actual,
    readPidfile: live.readPidfile,
    processAlive: live.processAlive,
    startBridgePreferring: live.startBridgePreferring,
    openBrowser: live.openBrowser,
  };
});

import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { runLive } from "../src/cli/commands/live";

let dir: string;
let stdout: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tt-live-ctl-"));
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((c) => {
    stdout.push(String(c));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  live.readPidfile.mockReset();
  live.processAlive.mockReset();
  live.startBridgePreferring.mockReset();
  live.openBrowser.mockReset();
});

afterEach(() => {
  setJsonMode(false);
  vi.restoreAllMocks();
});

describe("live already-running / reload / stop", () => {
  it("reports the existing server instead of starting another", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747 });
    live.processAlive.mockReturnValue(true);
    setJsonMode(true);
    expect(await runLive(parseArgs(["live", "--cwd", dir, "--json"]))).toBe(0);
    expect(JSON.parse(stdout.join(""))).toMatchObject({
      url: "http://localhost:4747/",
      pid: 4242,
      alreadyRunning: true,
    });
    expect(live.startBridgePreferring).not.toHaveBeenCalled();
  });

  it("reloads through the pidfile port", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 5151 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ clients: 2 }),
      })),
    );
    setJsonMode(true);
    expect(
      await runLive(parseArgs(["live", "reload", "--cwd", dir, "--json"])),
    ).toBe(0);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:5151/reload",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(stdout.join(""))).toEqual({
      reloaded: true,
      clients: 2,
    });
  });

  it("stops a live pid and removes the pidfile", async () => {
    mkdirSync(join(dir, ".templatical"), { recursive: true });
    writeFileSync(join(dir, ".templatical", "live-server.pid"), "{}", "utf8");
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747 });
    live.processAlive.mockReturnValue(true);
    const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    setJsonMode(true);
    expect(
      await runLive(parseArgs(["live", "stop", "--cwd", dir, "--json"])),
    ).toBe(0);
    expect(kill).toHaveBeenCalledWith(4242, "SIGTERM");
    expect(JSON.parse(stdout.join(""))).toEqual({ stopped: true });
  });
});
