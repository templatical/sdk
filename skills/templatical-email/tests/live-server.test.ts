import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// The bridge is what live mode actually runs; import it as-is.
import {
  deepEqual,
  EDITOR_VERSION,
  readWorkingFile,
  startBridge,
  startBridgePreferring,
} from "../scripts/live-server.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(here, "../scripts/live-server.mjs");

const TEMPLATE_A = {
  blocks: [
    {
      id: "title_1",
      type: "title",
      content: "Hello",
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    },
  ],
  settings: { width: 600, locale: "en" },
};
const TEMPLATE_B = {
  ...TEMPLATE_A,
  blocks: [{ ...TEMPLATE_A.blocks[0], content: "Changed" }],
};

// --------------------------------------------------------------------------
// Pure helpers
// --------------------------------------------------------------------------

describe("deepEqual", () => {
  it("is order-insensitive across object keys", () => {
    expect(deepEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
  });
  it("distinguishes changed scalar values", () => {
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
  it("distinguishes arrays of different length", () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });
  it("recurses into nested structures", () => {
    expect(deepEqual({ a: { x: [1] } }, { a: { x: [1] } })).toBe(true);
    expect(deepEqual({ a: { x: [1] } }, { a: { x: [2] } })).toBe(false);
  });
  it("treats null and object as unequal", () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
  });
  it("treats a missing key as unequal even when counts match", () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
  });
});

describe("readWorkingFile", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tpl-rwf-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when the file is absent", () => {
    expect(readWorkingFile(join(dir, "nope.json"))).toBe(null);
  });
  it("returns null when the file is not valid JSON", () => {
    const p = join(dir, "bad.json");
    writeFileSync(p, "{ not json");
    expect(readWorkingFile(p)).toBe(null);
  });
  it("returns the parsed content when present and valid", () => {
    const p = join(dir, "ok.json");
    writeFileSync(p, JSON.stringify(TEMPLATE_A));
    expect(readWorkingFile(p)).toEqual(TEMPLATE_A);
  });
});

// --------------------------------------------------------------------------
// Bridge endpoints (real server on an ephemeral port)
// --------------------------------------------------------------------------

describe("bridge endpoints", () => {
  let cwd: string;
  let bridge: Awaited<ReturnType<typeof startBridge>>;
  let base: string;

  const workingPath = () => join(cwd, ".templatical", "template.json");
  const writeWorking = (content: unknown) => {
    mkdirSync(join(cwd, ".templatical"), { recursive: true });
    writeFileSync(workingPath(), JSON.stringify(content));
  };

  beforeEach(async () => {
    cwd = mkdtempSync(join(tmpdir(), "tpl-live-"));
    bridge = await startBridge({ cwd, port: 0 });
    base = bridge.url;
  });
  afterEach(async () => {
    await bridge.close();
    rmSync(cwd, { recursive: true, force: true });
  });

  it("GET / serves the harness with the pinned editor version injected", async () => {
    const html = await (await fetch(base)).text();
    expect(html).toContain(
      `@templatical/editor@${EDITOR_VERSION}/dist/cdn/editor.js`,
    );
    expect(html).not.toContain("{{EDITOR_VERSION}}");
  });

  it("GET /template returns 204 when no working file exists yet", async () => {
    const res = await fetch(`${base}template`);
    expect(res.status).toBe(204);
  });

  it("GET /template returns the working file when present", async () => {
    writeWorking(TEMPLATE_A);
    const res = await fetch(`${base}template`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(TEMPLATE_A);
  });

  it("is not divergent before any baseline is set", async () => {
    await fetch(`${base}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: TEMPLATE_B, baseline: false }),
    });
    const got = await (await fetch(`${base}content`)).json();
    expect(got.divergent).toBe(false);
  });

  it("stays not divergent when the page echoes the baseline content", async () => {
    await fetch(`${base}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: TEMPLATE_A, baseline: true }),
    });
    await fetch(`${base}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: TEMPLATE_A, baseline: false }),
    });
    const got = await (await fetch(`${base}content`)).json();
    expect(got.divergent).toBe(false);
    expect(got.content).toEqual(TEMPLATE_A);
  });

  it("becomes divergent when the page reports content differing from the baseline", async () => {
    await fetch(`${base}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: TEMPLATE_A, baseline: true }),
    });
    await fetch(`${base}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: TEMPLATE_B, baseline: false }),
    });
    const got = await (await fetch(`${base}content`)).json();
    expect(got.divergent).toBe(true);
    expect(got.content).toEqual(TEMPLATE_B);
  });

  it("POST /reload resets divergence and reports the connected client count", async () => {
    writeWorking(TEMPLATE_A);
    await fetch(`${base}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: TEMPLATE_A, baseline: true }),
    });
    await fetch(`${base}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: TEMPLATE_B, baseline: false }),
    });
    const reload = await (
      await fetch(`${base}reload`, { method: "POST" })
    ).json();
    expect(reload).toEqual({ ok: true, clients: 0 });
    const got = await (await fetch(`${base}content`)).json();
    expect(got.divergent).toBe(false);
    expect(got.content).toBe(null);
  });

  it("pushes the working file to SSE clients on reload", async () => {
    writeWorking(TEMPLATE_B);
    const frames = await collectSse(`${base}events`, async () => {
      await fetch(`${base}reload`, { method: "POST" });
    });
    const templateFrame = frames.find((f) => f.startsWith("event: template"));
    expect(
      templateFrame,
      "expected a `template` SSE frame after reload",
    ).toBeTruthy();
    const data = templateFrame!
      .split("\n")
      .find((l) => l.startsWith("data: "))!;
    expect(JSON.parse(data.slice("data: ".length))).toEqual(TEMPLATE_B);
  });

  it("returns 404 for an unknown route", async () => {
    const res = await fetch(`${base}nope`);
    expect(res.status).toBe(404);
  });
});

/**
 * Connect to the SSE endpoint, run `trigger`, and collect the raw frames that
 * arrive within a short window. Aborts the stream before returning.
 */
async function collectSse(
  url: string,
  trigger: () => Promise<void>,
  timeoutMs = 1500,
): Promise<string[]> {
  const ac = new AbortController();
  const res = await fetch(url, { signal: ac.signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const frames: string[] = [];
  let buf = "";
  const pump = (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          frames.push(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
        }
      }
    } catch {
      /* aborted */
    }
  })();
  await new Promise((r) => setTimeout(r, 50));
  await trigger();
  await new Promise((r) => setTimeout(r, Math.min(300, timeoutMs)));
  ac.abort();
  await pump;
  return frames;
}

// --------------------------------------------------------------------------
// Port selection: prefer the requested port, fall back when it's busy
// --------------------------------------------------------------------------

describe("startBridgePreferring", () => {
  let cwd: string;
  let blocker: Awaited<ReturnType<typeof startBridge>> | null = null;
  let handle: Awaited<ReturnType<typeof startBridgePreferring>> | null = null;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "tpl-port-"));
  });
  afterEach(async () => {
    if (handle) await handle.close();
    if (blocker) await blocker.close();
    handle = blocker = null;
    rmSync(cwd, { recursive: true, force: true });
  });

  it("uses the preferred port without falling back when it is free", async () => {
    handle = await startBridgePreferring({ cwd, preferredPort: 0 });
    expect(handle.fellBack).toBe(false);
    expect(handle.port).toBeGreaterThan(0);
    const res = await fetch(`${handle.url}template`);
    expect(res.status).toBe(204);
  });

  it("falls back to a free port when the preferred one is occupied", async () => {
    blocker = await startBridge({ cwd, port: 0 });
    const taken = blocker.port;
    handle = await startBridgePreferring({ cwd, preferredPort: taken });
    expect(handle.fellBack).toBe(true);
    expect(handle.port).not.toBe(taken);
    // and it actually serves on the fallback port
    const res = await fetch(`${handle.url}template`);
    expect(res.status).toBe(204);
  });
});

// --------------------------------------------------------------------------
// CLI lifecycle: single-instance guard + stop (spawns the real script)
// --------------------------------------------------------------------------

describe("CLI lifecycle", () => {
  let cwd: string;
  let server: ReturnType<typeof spawn> | null = null;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "tpl-cli-"));
  });
  afterEach(() => {
    if (server && server.exitCode === null) server.kill("SIGKILL");
    server = null;
    rmSync(cwd, { recursive: true, force: true });
  });

  const pidPath = () => join(cwd, ".templatical", "live-server.pid");
  const poll = async (predicate: () => boolean, timeoutMs = 4000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (predicate()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };
  const runCli = (
    args: string[],
  ): Promise<{ code: number | null; out: string }> =>
    new Promise((res) => {
      const p = spawn(process.execPath, [SCRIPT, ...args], { cwd });
      let out = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (out += d));
      p.on("close", (code) => res({ code, out }));
    });

  it("refuses a second instance and stops cleanly via the pidfile", async () => {
    // Start a long-running bridge on an ephemeral port.
    server = spawn(process.execPath, [SCRIPT, "--port", "0"], {
      cwd,
      stdio: "ignore",
    });
    expect(await poll(() => existsSync(pidPath()))).toBe(true);

    // A second start in the same cwd detects the running instance.
    const second = await runCli(["--port", "0"]);
    expect(second.code).toBe(0);
    expect(second.out).toContain("already running");

    // stop terminates it and removes the pidfile.
    const stop = await runCli(["stop"]);
    expect(stop.code).toBe(0);
    expect(stop.out).toContain("Stopped the live server");
    expect(await poll(() => !existsSync(pidPath()))).toBe(true);
    expect(await poll(() => server!.exitCode !== null)).toBe(true);
  });

  it("reports when reload/stop find no running server", async () => {
    const res = await runCli(["reload"]);
    expect(res.code).toBe(1);
    expect(res.out).toContain("No live server is running");
  });
});
