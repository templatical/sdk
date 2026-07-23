// Zero-dependency Node bridge for the templatical-email skill's LIVE mode.
//
// It serves live/index.html (which loads the REAL Templatical editor from the
// CDN), streams agent-driven template updates to the page over Server-Sent
// Events, and buffers the page's hand-edits so the agent can detect divergence
// (a user edit in the browser) before overwriting.
//
// No npm dependencies — Node built-ins only. Build mode stays ajv-only; these
// live assets are inert until live mode starts this server.
//
// The shared working file (.templatical/template.json by default) is the single
// source of truth both modes operate on. The agent writes it with its normal
// file tools, then runs `reload` to push it to the page. This keeps the working
// file authoritative and reviewable, and the page transport a pure push.
//
// Usage:
//   node scripts/live-server.mjs [--port 4747] [--cwd .] [--file .templatical/template.json]
//   node scripts/live-server.mjs reload   # tell the running bridge to re-read the working file and push it
//   node scripts/live-server.mjs stop     # stop the running bridge (reads the pidfile)
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);

// The CDN editor version the live harness loads. It is PINNED to the skill's
// schema version: reference/schema.json is generated from @templatical/types,
// and types + editor bump in lockstep (changesets fixed group), so the editor
// at this version has the same block model the schema describes.
//
// Kept in step automatically: scripts/sync-editor-version.mjs rewrites this
// line from packages/editor/package.json at release time (the root
// `changeset:version` step), so no manual bump per release. tests/cdn-pin.test.ts
// is the safety net that fails CI if it ever drifts from the editor version.
export const EDITOR_VERSION = "0.17.1";

export const DEFAULT_PORT = 4747;
const WORKING_FILE = join(".templatical", "template.json");
const PID_FILE = join(".templatical", "live-server.pid");
const HARNESS_FILE = resolve(here, "../live/index.html");

// --------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// --------------------------------------------------------------------------

/** Order-insensitive structural equality for parsed-JSON template content. */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const aArr = Array.isArray(a);
  if (aArr !== Array.isArray(b)) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

/** Read + parse the working file, or return null when it is absent/unparseable. */
export function readWorkingFile(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

// --------------------------------------------------------------------------
// Bridge server (no pidfile / signal handling — that lives in main())
// --------------------------------------------------------------------------

/**
 * Start the bridge HTTP server. Pure server + in-memory sync state; callers own
 * process lifecycle. Resolves once listening.
 *
 * @param {{ cwd?: string, port?: number, file?: string, harnessFile?: string }} opts
 * @returns {Promise<{ server: import('node:http').Server, port: number, url: string, close: () => Promise<void> }>}
 */
export function startBridge({
  cwd = process.cwd(),
  port = 0,
  file = WORKING_FILE,
  harnessFile = HARNESS_FILE,
} = {}) {
  const workingPath = isAbsolute(file) ? file : resolve(cwd, file);

  // Sync state. `baseline` is the editor's NORMALIZED view of the agent's last
  // content (captured by the page right after it applies an update), so the
  // editor's own load-time normalization never reads as a user edit.
  // `editorCurrent` is the page's latest getContent(); `divergent` is true when
  // it structurally differs from `baseline` — i.e. the user hand-edited.
  const state = {
    baseline: null,
    editorCurrent: null,
    divergent: false,
  };
  /** @type {Set<import('node:http').ServerResponse>} */
  const clients = new Set();

  function broadcastTemplate(content) {
    const payload = `event: template\ndata: ${JSON.stringify(content)}\n\n`;
    for (const res of clients) res.write(payload);
  }

  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url, "http://localhost");
    const method = req.method ?? "GET";

    try {
      if (
        method === "GET" &&
        (pathname === "/" || pathname === "/index.html")
      ) {
        const html = readFileSync(harnessFile, "utf8").replaceAll(
          "{{EDITOR_VERSION}}",
          EDITOR_VERSION,
        );
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }

      if (method === "GET" && pathname === "/template") {
        const content = readWorkingFile(workingPath);
        if (content === null) {
          res.writeHead(204).end(); // no working file yet — page inits empty
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(content));
        return;
      }

      if (method === "GET" && pathname === "/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write("event: ready\ndata: {}\n\n");
        clients.add(res);
        const ping = setInterval(() => res.write(": ping\n\n"), 15000);
        req.on("close", () => {
          clearInterval(ping);
          clients.delete(res);
        });
        return;
      }

      if (method === "POST" && pathname === "/content") {
        const body = await readJsonBody(req);
        const content = body?.content;
        if (body?.baseline) {
          // Post-apply snapshot: this is the editor's normalized view of the
          // agent's content, not a user edit.
          state.baseline = content ?? null;
          state.editorCurrent = content ?? null;
          state.divergent = false;
        } else {
          state.editorCurrent = content ?? null;
          state.divergent =
            state.baseline !== null && !deepEqual(content, state.baseline);
        }
        res.writeHead(204).end();
        return;
      }

      if (method === "GET" && pathname === "/content") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            divergent: state.divergent,
            content: state.editorCurrent,
          }),
        );
        return;
      }

      if (method === "POST" && pathname === "/reload") {
        // The agent wrote the working file; re-read and push it to the page.
        // The freshly-written file is the new baseline, so any pending user
        // edit is superseded — reset the divergence tracker.
        const content = readWorkingFile(workingPath);
        state.baseline = null;
        state.editorCurrent = null;
        state.divergent = false;
        if (content !== null) broadcastTemplate(content);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, clients: clients.size }));
        return;
      }

      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    } catch (err) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end(`Bad request: ${err.message}`);
    }
  });

  return new Promise((resolvePromise, rejectPromise) => {
    // listen() reports failures (e.g. EADDRINUSE) as an 'error' event, not a
    // throw — without this the error would be unhandled and crash the process.
    const onListenError = (err) => rejectPromise(err);
    server.once("error", onListenError);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", onListenError);
      const actualPort = server.address().port;
      resolvePromise({
        server,
        port: actualPort,
        url: `http://localhost:${actualPort}/`,
        close: () =>
          new Promise((r) => {
            for (const c of clients) c.end();
            clients.clear();
            server.close(() => r());
          }),
      });
    });
  });
}

/**
 * Start the bridge on `preferredPort`, falling back to an OS-assigned free port
 * when that one is occupied — so a busy port never fails the launch. The page
 * uses relative URLs and `reload`/`stop` read the port from the pidfile, so the
 * actual port is discovered, not assumed. The returned handle carries
 * `fellBack: true` when it landed on a different port than requested.
 */
export async function startBridgePreferring({
  preferredPort = DEFAULT_PORT,
  ...opts
} = {}) {
  try {
    const handle = await startBridge({ ...opts, port: preferredPort });
    return { ...handle, fellBack: false };
  } catch (err) {
    if (err?.code !== "EADDRINUSE") throw err;
    const handle = await startBridge({ ...opts, port: 0 });
    return { ...handle, fellBack: true, preferredPort };
  }
}

// --------------------------------------------------------------------------
// CLI (start / reload / stop) with pidfile-based single-instance lifecycle
// --------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--cwd") args.cwd = argv[++i];
    else if (a === "--file") args.file = argv[++i];
    else if (a === "--no-open") args.open = false;
    else args._.push(a);
  }
  return args;
}

// Open a URL in the user's default browser — best-effort and cross-platform.
// Fired once when the bridge starts so the preview pops up without the user
// copy-pasting. A silent no-op where there's no browser (headless / CI /
// sandbox); the URL is always printed too, so nothing is lost.
function openBrowser(url) {
  const [cmd, cmdArgs] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, cmdArgs, { stdio: "ignore", detached: true });
    child.on("error", () => {}); // no browser available — ignore
    child.unref();
  } catch {
    /* ignore — the URL is printed regardless */
  }
}

function pidfilePath(cwd) {
  return resolve(cwd, PID_FILE);
}

function readPidfile(cwd) {
  const p = pidfilePath(cwd);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function postTo(port, path) {
  const res = await fetch(`http://localhost:${port}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  return res;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] ?? "start";
  const cwd = resolve(args.cwd ?? process.cwd());

  if (cmd === "reload" || cmd === "stop") {
    const info = readPidfile(cwd);
    if (!info || !processAlive(info.pid)) {
      console.error(
        "No live server is running here (no pidfile at .templatical/live-server.pid).",
      );
      process.exit(1);
    }
    if (cmd === "reload") {
      const res = await postTo(info.port, "/reload");
      const body = await res.json().catch(() => ({}));
      console.log(
        `Pushed working file to ${body.clients ?? 0} connected page(s).`,
      );
      process.exit(0);
    }
    // stop
    try {
      process.kill(info.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
    rmSync(pidfilePath(cwd), { force: true });
    console.log("Stopped the live server.");
    process.exit(0);
  }

  // start — prefer the requested/default port, fall back to a free one if busy
  const preferredPort = args.port ?? DEFAULT_PORT;
  const existing = readPidfile(cwd);
  if (existing && processAlive(existing.pid)) {
    console.log(
      `Live server already running (pid ${existing.pid}) at http://localhost:${existing.port}/`,
    );
    process.exit(0);
  }
  if (existing) rmSync(pidfilePath(cwd), { force: true }); // stale pidfile

  const handle = await startBridgePreferring({
    cwd,
    preferredPort,
    file: args.file,
  });

  mkdirSync(dirname(pidfilePath(cwd)), { recursive: true });
  writeFileSync(
    pidfilePath(cwd),
    JSON.stringify({ pid: process.pid, port: handle.port }),
    "utf8",
  );

  const cleanup = () => {
    rmSync(pidfilePath(cwd), { force: true });
    handle.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  console.log(`Templatical live preview running at ${handle.url}`);
  if (handle.fellBack) {
    console.log(`(port ${preferredPort} was busy — using ${handle.port})`);
  }
  console.log(`Working file: ${resolve(cwd, args.file ?? WORKING_FILE)}`);
  if (args.open === false) {
    console.log(`Open ${handle.url} in a browser.`);
  } else {
    console.log(`Opening ${handle.url} in your default browser…`);
    openBrowser(handle.url);
  }
  console.log(`After writing the working file, run:\n  node ${SELF} reload`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
