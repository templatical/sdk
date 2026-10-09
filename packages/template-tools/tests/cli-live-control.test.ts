import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
      expect.objectContaining({ method: "POST", body: undefined }),
    );
    expect(JSON.parse(stdout.join(""))).toEqual({
      reloaded: true,
      ok: true,
      clients: 2,
      consumed: false,
    });
  });

  it("posts consumeAnnotations when the flag is set", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 5151 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ ok: true, clients: 1, consumed: true }),
      })),
    );
    setJsonMode(true);
    expect(
      await runLive(
        parseArgs([
          "live",
          "reload",
          "--consume-annotations",
          "--cwd",
          dir,
          "--json",
        ]),
      ),
    ).toBe(0);
    expect(fetch).toHaveBeenCalledWith("http://localhost:5151/reload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ consumeAnnotations: true }),
    });
    expect(JSON.parse(stdout.join(""))).toEqual({
      reloaded: true,
      ok: true,
      clients: 1,
      consumed: true,
    });
  });

  it("exits 1 and pushes nothing when a custom-block reload fails", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 5151 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          ok: false,
          clients: 1,
          consumed: false,
          mode: "custom-block",
          error: "The custom block definition is missing or invalid.",
        }),
      })),
    );
    setJsonMode(true);
    expect(
      await runLive(parseArgs(["live", "reload", "--cwd", dir, "--json"])),
    ).toBe(1);
    expect(JSON.parse(stdout.join(""))).toEqual({
      reloaded: false,
      ok: false,
      clients: 1,
      consumed: false,
      error:
        "The custom block definition is missing or invalid; nothing was pushed. Run `templatical custom-block validate`.",
    });
  });

  it("names the --host template when that is what failed", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 5151 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          ok: false,
          clients: 0,
          consumed: false,
          mode: "custom-block",
          error: "The --host template is missing or invalid.",
        }),
      })),
    );
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir]))).toBe(1);
    expect(stdout.join("")).toBe(
      "The --host template is missing or invalid; nothing was pushed. Run `templatical validate` on it.\n",
    );
  });

  it("words a custom-block reload's success line for the block", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 5151 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ ok: true, clients: 3, consumed: false, mode: "custom-block" }),
      })),
    );
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir]))).toBe(0);
    expect(stdout.join("")).toBe("Pushed the custom block to 3 page(s).\n");
  });

  it("refuses to start a custom-block server while a template server runs", async () => {
    live.readPidfile.mockReturnValue({
      pid: 4242,
      port: 4747,
      mode: "template",
      path: join(dir, ".templatical", "template.json"),
    });
    live.processAlive.mockReturnValue(true);
    await expect(
      runLive(parseArgs(["live", "--custom-block", "q.json", "--cwd", dir])),
    ).rejects.toThrow(
      `A live server is already running for ${join(dir, ".templatical", "template.json")} (template). Run \`templatical live stop\` first.`,
    );
    expect(live.startBridgePreferring).not.toHaveBeenCalled();
  });

  it("refuses a different custom block, and treats a mode-less pidfile as template mode", async () => {
    live.processAlive.mockReturnValue(true);
    live.readPidfile.mockReturnValue({
      pid: 4242,
      port: 4747,
      mode: "custom-block",
      path: join(dir, "a.json"),
    });
    await expect(
      runLive(parseArgs(["live", "--custom-block", "b.json", "--cwd", dir])),
    ).rejects.toThrow(`A live server is already running for ${join(dir, "a.json")} (custom-block).`);
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747 });
    await expect(
      runLive(parseArgs(["live", "--custom-block", "b.json", "--cwd", dir])),
    ).rejects.toThrow("(template). Run `templatical live stop` first.");
  });

  it("reports alreadyRunning for the same custom block", async () => {
    live.readPidfile.mockReturnValue({
      pid: 4242,
      port: 4747,
      mode: "custom-block",
      path: join(dir, "a.json"),
    });
    live.processAlive.mockReturnValue(true);
    setJsonMode(true);
    expect(
      await runLive(parseArgs(["live", "--custom-block", "a.json", "--cwd", dir, "--json"])),
    ).toBe(0);
    expect(JSON.parse(stdout.join(""))).toMatchObject({ alreadyRunning: true, pid: 4242 });
  });

  it("records the mode and served path in the pidfile", async () => {
    live.readPidfile.mockReturnValue(null);
    live.startBridgePreferring.mockResolvedValue({
      port: 4848,
      url: "http://localhost:4848/",
      workingPath: join(dir, "a.json"),
      fellBack: false,
      close: async () => {},
    });
    const before = { int: process.listeners("SIGINT"), term: process.listeners("SIGTERM") };
    void runLive(parseArgs(["live", "--custom-block", "a.json", "--no-open", "--cwd", dir]));
    const pid = join(dir, ".templatical", "live-server.pid");
    await vi.waitFor(() => expect(existsSync(pid)).toBe(true));
    for (const l of process.listeners("SIGINT")) if (!before.int.includes(l)) process.removeListener("SIGINT", l);
    for (const l of process.listeners("SIGTERM")) if (!before.term.includes(l)) process.removeListener("SIGTERM", l);
    expect(JSON.parse(readFileSync(pid, "utf8"))).toEqual({
      pid: process.pid,
      port: 4848,
      mode: "custom-block",
      path: join(dir, "a.json"),
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

describe("live start for a custom block", () => {
  const bridge = (over: Record<string, unknown> = {}) => ({
    port: 4848,
    url: "http://localhost:4848/",
    workingPath: join(dir, "a.json"),
    fellBack: false,
    close: async () => {},
    ...over,
  });
  // runLive blocks forever once started; drop the signal handlers it adds so
  // the test process keeps its own.
  const startDetached = async (argv: string[]) => {
    const before = { int: process.listeners("SIGINT"), term: process.listeners("SIGTERM") };
    void runLive(parseArgs(argv));
    await vi.waitFor(() => expect(existsSync(join(dir, ".templatical", "live-server.pid"))).toBe(true));
    for (const l of process.listeners("SIGINT")) if (!before.int.includes(l)) process.removeListener("SIGINT", l);
    for (const l of process.listeners("SIGTERM")) if (!before.term.includes(l)) process.removeListener("SIGTERM", l);
  };

  it("rejects --file together with --custom-block", async () => {
    await expect(
      runLive(parseArgs(["live", "--custom-block", "a.json", "--file", "t.json", "--cwd", dir])),
    ).rejects.toThrow("Pass either --file or --custom-block, not both.");
  });

  it("rejects --host without --custom-block", async () => {
    await expect(
      runLive(parseArgs(["live", "--host", "t.json", "--cwd", dir])),
    ).rejects.toThrow("--host only applies with --custom-block.");
  });

  it("refuses the same block when it was started with a different --host", async () => {
    live.readPidfile.mockReturnValue({
      pid: 4242,
      port: 4747,
      mode: "custom-block",
      path: join(dir, "a.json"),
      host: join(dir, "h1.json"),
    });
    live.processAlive.mockReturnValue(true);
    await expect(
      runLive(parseArgs(["live", "--custom-block", "a.json", "--host", "h2.json", "--cwd", dir])),
    ).rejects.toThrow(`A live server is already running for ${join(dir, "a.json")} (custom-block).`);
  });

  it("words the already-running line for humans", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747, mode: "custom-block", path: join(dir, "a.json") });
    live.processAlive.mockReturnValue(true);
    expect(await runLive(parseArgs(["live", "--custom-block", "a.json", "--cwd", dir]))).toBe(0);
    expect(stdout.join("")).toBe("Live server already running (pid 4242) at http://localhost:4747/\n");
  });

  it("records the absolute --host path in the pidfile and clears a stale pidfile first", async () => {
    mkdirSync(join(dir, ".templatical"), { recursive: true });
    writeFileSync(join(dir, ".templatical", "live-server.pid"), "{}", "utf8");
    live.readPidfile.mockReturnValue({ pid: 999999, port: 1 });
    live.processAlive.mockReturnValue(false);
    live.startBridgePreferring.mockResolvedValue(bridge());
    await startDetached(["live", "--custom-block", "a.json", "--host", "h.json", "--no-open", "--cwd", dir]);
    expect(JSON.parse(readFileSync(join(dir, ".templatical", "live-server.pid"), "utf8"))).toEqual({
      pid: process.pid,
      port: 4848,
      mode: "custom-block",
      path: join(dir, "a.json"),
      host: join(dir, "h.json"),
    });
    expect(live.startBridgePreferring).toHaveBeenCalledWith(
      expect.objectContaining({ customBlock: "a.json", host: "h.json" }),
    );
  });

  it("prints the custom block path, the port fallback and opens the browser", async () => {
    live.readPidfile.mockReturnValue(null);
    live.startBridgePreferring.mockResolvedValue(bridge({ port: 4849, url: "http://localhost:4849/", fellBack: true }));
    await startDetached(["live", "--custom-block", "a.json", "--cwd", dir]);
    expect(stdout.join("")).toBe(
      [
        "Templatical live preview running at http://localhost:4849/",
        "(port 4747 was busy - using 4849)",
        `Custom block: ${join(dir, "a.json")}`,
        "",
      ].join("\n"),
    );
    expect(live.openBrowser).toHaveBeenCalledWith("http://localhost:4849/");
  });
});

describe("live reload failure wording", () => {
  const failing = (error?: string) => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 5151 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ json: async () => ({ ok: false, clients: 0, consumed: false, error }) })),
    );
  };

  it("falls back to the custom block line when the bridge names no error", async () => {
    failing(undefined);
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir]))).toBe(1);
    expect(stdout.join("")).toBe(
      "The custom block definition is missing or invalid; nothing was pushed. Run `templatical custom-block validate`.\n",
    );
  });

  it("passes any other bridge error through with the nothing-pushed note", async () => {
    failing("The working file is not valid JSON.");
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir]))).toBe(1);
    expect(stdout.join("")).toBe("The working file is not valid JSON. Nothing was pushed.\n");
  });
});


describe("live template-mode wording and path identity", () => {
  it("words a template reload's success line for the working file", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 5151 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ ok: true, clients: 2, consumed: false, mode: "template" }),
      })),
    );
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir]))).toBe(0);
    expect(stdout.join("")).toBe("Pushed the working file to 2 connected page(s).\n");
  });

  it("starts a template server with the Working file line", async () => {
    live.readPidfile.mockReturnValue(null);
    live.startBridgePreferring.mockResolvedValue({
      port: 4848,
      url: "http://localhost:4848/",
      workingPath: join(dir, "t.json"),
      fellBack: false,
      close: async () => {},
    });
    const before = { int: process.listeners("SIGINT"), term: process.listeners("SIGTERM") };
    void runLive(parseArgs(["live", "--no-open", "--cwd", dir]));
    await vi.waitFor(() => expect(existsSync(join(dir, ".templatical", "live-server.pid"))).toBe(true));
    for (const l of process.listeners("SIGINT")) if (!before.int.includes(l)) process.removeListener("SIGINT", l);
    for (const l of process.listeners("SIGTERM")) if (!before.term.includes(l)) process.removeListener("SIGTERM", l);
    expect(stdout.join("")).toBe(
      ["Templatical live preview running at http://localhost:4848/", `Working file: ${join(dir, "t.json")}`, ""].join("\n"),
    );
  });

  it("treats an absolute and a relative path to the same block as the same server", async () => {
    live.readPidfile.mockReturnValue({
      pid: 4242,
      port: 4747,
      mode: "custom-block",
      path: join(dir, "a.json"),
    });
    live.processAlive.mockReturnValue(true);
    for (const given of ["a.json", join(dir, "a.json")]) {
      stdout.length = 0;
      setJsonMode(true);
      expect(await runLive(parseArgs(["live", "--custom-block", given, "--cwd", dir, "--json"]))).toBe(0);
      expect(JSON.parse(stdout.join(""))).toMatchObject({ alreadyRunning: true, pid: 4242 });
    }
    expect(live.startBridgePreferring).not.toHaveBeenCalled();
  });
});
