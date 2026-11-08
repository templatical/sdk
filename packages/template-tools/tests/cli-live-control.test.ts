import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const live = vi.hoisted(() => ({
  readPidfile: vi.fn(),
  processAlive: vi.fn(),
  verifyLiveServer: vi.fn(),
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
    verifyLiveServer: live.verifyLiveServer,
    startBridgePreferring: live.startBridgePreferring,
    openBrowser: live.openBrowser,
  };
});

import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { UsageError } from "../src/cli/io";
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
  live.verifyLiveServer.mockReset().mockResolvedValue("verified");
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
      "http://127.0.0.1:5151/reload",
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
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:5151/reload", {
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
        "The custom block definition is missing or invalid. Nothing was pushed.",
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
          error:
            "The --host template is missing or invalid. Run `templatical validate` on it.",
        }),
      })),
    );
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir]))).toBe(1);
    expect(stdout.join("")).toBe(
      "The --host template is missing or invalid. Run `templatical validate` on it. Nothing was pushed.\n",
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
      lastFetch: () => null,
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

  it("passes a shutdown callback that closes the bridge, removes the pidfile and exits", async () => {
    live.readPidfile.mockReturnValue(null);
    const close = vi.fn(async () => {});
    live.startBridgePreferring.mockResolvedValue({
      port: 4848,
      url: "http://localhost:4848/",
      workingPath: join(dir, "a.json"),
      fellBack: false,
      lastFetch: () => null,
      close,
    });
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const before = { int: process.listeners("SIGINT"), term: process.listeners("SIGTERM") };
    void runLive(parseArgs(["live", "--custom-block", "a.json", "--no-open", "--cwd", dir]));
    const pid = join(dir, ".templatical", "live-server.pid");
    await vi.waitFor(() => expect(existsSync(pid)).toBe(true));
    for (const l of process.listeners("SIGINT")) if (!before.int.includes(l)) process.removeListener("SIGINT", l);
    for (const l of process.listeners("SIGTERM")) if (!before.term.includes(l)) process.removeListener("SIGTERM", l);
    const { onShutdown } = live.startBridgePreferring.mock.calls[0][0] as { onShutdown: () => void };
    onShutdown();
    expect(existsSync(pid)).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    // A replacement server writes its own pidfile; a second signal must not remove it.
    writeFileSync(pid, "{}", "utf8");
    onShutdown();
    expect(existsSync(pid)).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps a pidfile that a replacement server wrote while stopping", async () => {
    mkdirSync(join(dir, ".templatical"), { recursive: true });
    const pid = join(dir, ".templatical", "live-server.pid");
    writeFileSync(pid, JSON.stringify({ pid: 5555, port: 4848 }), "utf8");
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    expect(await runLive(parseArgs(["live", "stop", "--cwd", dir]))).toBe(0);
    expect(JSON.parse(readFileSync(pid, "utf8"))).toEqual({ pid: 5555, port: 4848 });
  });

  it("stops a live pid and removes the pidfile", async () => {
    mkdirSync(join(dir, ".templatical"), { recursive: true });
    writeFileSync(join(dir, ".templatical", "live-server.pid"), JSON.stringify({ pid: 4242, port: 4747 }), "utf8");
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747 });
    live.processAlive.mockReturnValue(true);
    const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    setJsonMode(true);
    expect(
      await runLive(parseArgs(["live", "stop", "--cwd", dir, "--json"])),
    ).toBe(0);
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:4747/shutdown", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(kill).not.toHaveBeenCalled();
    expect(JSON.parse(stdout.join(""))).toEqual({ stopped: true });
    expect(existsSync(join(dir, ".templatical", "live-server.pid"))).toBe(false);
  });

  it.each([
    ["answers an error", vi.fn(async () => ({ ok: false, status: 500 })), "it answered 500"],
    ["cannot be reached", vi.fn(async () => { throw new Error("fetch failed"); }), "fetch failed"],
    ["rejects with a non-Error", vi.fn(async () => { throw "socket hang up"; }), "socket hang up"],
  ])("sends no signal and keeps the pidfile when the shutdown route %s", async (_label, shutdown, reason) => {
    mkdirSync(join(dir, ".templatical"), { recursive: true });
    const pid = join(dir, ".templatical", "live-server.pid");
    writeFileSync(pid, "{}", "utf8");
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal("fetch", shutdown);
    const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    await expect(runLive(parseArgs(["live", "stop", "--cwd", dir]))).rejects.toThrow(
      new UsageError(`The live server (pid 4242) did not stop: POST /shutdown failed (${reason}). Stop that process yourself, then delete .templatical/live-server.pid.`),
    );
    expect(kill).not.toHaveBeenCalled();
    expect(existsSync(pid)).toBe(true);
  });

});

describe("live start for a custom block", () => {
  const bridge = (over: Record<string, unknown> = {}) => ({
    port: 4848,
    url: "http://localhost:4848/",
    workingPath: join(dir, "a.json"),
    fellBack: false,
    lastFetch: () => null,
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

  it("asks to try again, and keeps the pidfile, when a live pid's server does not answer in time", async () => {
    mkdirSync(join(dir, ".templatical"), { recursive: true });
    const pid = join(dir, ".templatical", "live-server.pid");
    writeFileSync(pid, JSON.stringify({ pid: 4242, port: 4747 }), "utf8");
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747 });
    live.processAlive.mockReturnValue(true);
    live.verifyLiveServer.mockResolvedValue("no-answer");
    const busy = new UsageError("The live server (pid 4242) did not answer on port 4747 within 3 s. If it is busy, try again; if it is not a live server, delete .templatical/live-server.pid.");
    await expect(runLive(parseArgs(["live", "--custom-block", "a.json", "--no-open", "--cwd", dir]))).rejects.toThrow(busy);
    await expect(runLive(parseArgs(["live", "reload", "--cwd", dir]))).rejects.toThrow(busy);
    await expect(runLive(parseArgs(["live", "stop", "--cwd", dir]))).rejects.toThrow(busy);
    expect(live.startBridgePreferring).not.toHaveBeenCalled();
    expect(JSON.parse(readFileSync(pid, "utf8"))).toEqual({ pid: 4242, port: 4747 });
  });

  it("refuses, and keeps the pidfile, when a live pid does not answer as this workspace's server", async () => {
    mkdirSync(join(dir, ".templatical"), { recursive: true });
    const pid = join(dir, ".templatical", "live-server.pid");
    writeFileSync(pid, JSON.stringify({ pid: 4242, port: 4747 }), "utf8");
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747, mode: "custom-block", path: join(dir, "a.json") });
    live.processAlive.mockReturnValue(true);
    live.verifyLiveServer.mockResolvedValue("mismatch");
    await expect(runLive(parseArgs(["live", "--custom-block", "a.json", "--no-open", "--cwd", dir]))).rejects.toThrow(
      new UsageError("Process 4242 from .templatical/live-server.pid is running but does not answer as this workspace's live server. If it is a live server, stop it; otherwise delete .templatical/live-server.pid. Then run `templatical live` again."),
    );
    expect(live.verifyLiveServer).toHaveBeenCalledWith(dir, { pid: 4242, port: 4747, mode: "custom-block", path: join(dir, "a.json") });
    expect(live.startBridgePreferring).not.toHaveBeenCalled();
    expect(JSON.parse(readFileSync(pid, "utf8"))).toEqual({ pid: 4242, port: 4747 });
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

  it("rejects --fetch without --custom-block, and --values without --fetch", async () => {
    await expect(runLive(parseArgs(["live", "--fetch", "--cwd", dir]))).rejects.toThrow(
      new UsageError("--fetch only applies with --custom-block."),
    );
    await expect(
      runLive(parseArgs(["live", "--custom-block", "a.json", "--values", '{"id":"7"}', "--cwd", dir])),
    ).rejects.toThrow(new UsageError("--values only applies with --fetch."));
  });

  it("passes --fetch values to the bridge, records them, and prints the first fetch", async () => {
    live.readPidfile.mockReturnValue(null);
    live.startBridgePreferring.mockResolvedValue(
      bridge({ lastFetch: () => ({ ok: false, error: "GET https://x.test/p/7 returned 500: down" }) }),
    );
    await startDetached(["live", "--custom-block", "a.json", "--fetch", "--values", '{"id":"7"}', "--no-open", "--cwd", dir]);
    expect(live.startBridgePreferring).toHaveBeenCalledWith(
      expect.objectContaining({ customBlock: "a.json", fetch: { values: { id: "7" } } }),
    );
    expect(JSON.parse(readFileSync(join(dir, ".templatical", "live-server.pid"), "utf8")).fetch).toEqual({ id: "7" });
    expect(stdout.join("")).toContain("Fetched state: the request failed. GET https://x.test/p/7 returned 500: down\n");
  });

  it("refuses a running block started with different --fetch values", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 4747, mode: "custom-block", path: join(dir, "a.json"), fetch: { id: "7" } });
    live.processAlive.mockReturnValue(true);
    await expect(
      runLive(parseArgs(["live", "--custom-block", "a.json", "--fetch", "--values", '{"id":"8"}', "--cwd", dir])),
    ).rejects.toThrow(`A live server is already running for ${join(dir, "a.json")} (custom-block).`);
    await expect(
      runLive(parseArgs(["live", "--custom-block", "a.json", "--cwd", dir])),
    ).rejects.toThrow(`A live server is already running for ${join(dir, "a.json")} (custom-block).`);
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

describe("live reload with a fetched state", () => {
  it("adds the fetch outcome to the reload line and the JSON", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 5151 });
    live.processAlive.mockReturnValue(true);
    const fetch = { ok: true, unmapped: ["price"] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ status: 200, json: async () => ({ ok: true, clients: 1, consumed: false, mode: "custom-block", fetch }) })),
    );
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir]))).toBe(0);
    expect(stdout.join("")).toBe(
      "Pushed the custom block to 1 page(s).\nFetched state: filled from the API; not in the response: price.\n",
    );
    stdout.length = 0;
    setJsonMode(true);
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir, "--json"]))).toBe(0);
    expect(JSON.parse(stdout.join(""))).toEqual({ reloaded: true, ok: true, clients: 1, consumed: false, fetch });
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

  it("says a failure happened when the bridge names no error", async () => {
    failing(undefined);
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir]))).toBe(1);
    expect(stdout.join("")).toBe(
      "The live server reported a failed reload. Nothing was pushed.\n",
    );
  });

  it("treats a refused request as a failure, not a reload to no pages", async () => {
    live.readPidfile.mockReturnValue({ pid: 4242, port: 5151 });
    live.processAlive.mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 403,
        json: async () => {
          throw new SyntaxError("Unexpected token F");
        },
      })),
    );
    expect(await runLive(parseArgs(["live", "reload", "--cwd", dir]))).toBe(1);
    expect(stdout.join("")).toBe(
      "The live server refused the reload (403). Nothing was pushed.\n",
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
      lastFetch: () => null,
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
