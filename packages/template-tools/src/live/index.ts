// The local live-preview bridge.
//
// It serves live/index.html (which loads the REAL Templatical editor from the
// CDN), streams agent-driven template updates to the page over Server-Sent
// Events, and buffers the page's hand-edits so the caller can detect divergence
// (a user edit in the browser) before overwriting.
//
// This package's own `live` CLI command drives it today, over localhost HTTP.
// It stays side-effect free at import time and writes nothing to stdout so
// that a future stdio-based caller — an MCP server reserving stdout for
// JSON-RPC — can be added without auditing this module first: a stray write
// here would corrupt that protocol. Keep all human-facing output in the
// callers (cli/output.ts is the CLI's own single writer;
// tests/cli-output-discipline.test.ts enforces that no other module under
// src/ touches stdout).

import { createServer, type Server, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// The CDN editor version the live harness loads. It is PINNED to this package's
// schema version: schema.json is generated from @templatical/types, and types +
// editor bump in lockstep (changesets fixed group), so the editor at this
// version has the same block model the schema describes.
//
// Kept in step automatically by scripts/sync-pins.mjs at release time.
// tests/cdn-pin.test.ts is the safety net that fails CI if it ever drifts.
export const EDITOR_VERSION = "0.30.0";

export const DEFAULT_PORT = 4747;
export const WORKING_DIR = ".templatical";
export const PID_FILE = join(WORKING_DIR, "live-server.pid");

// Resolved from this module rather than the cwd so it works identically from
// src/live/ (tests) and dist/live/ (published) — both sit two levels under the
// package root, where live/index.html ships.
const HARNESS_FILE = resolve(here, "../../live/index.html");

// --------------------------------------------------------------------------
// Pure helpers
// --------------------------------------------------------------------------

/** Order-insensitive structural equality for parsed-JSON template content. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const aArr = Array.isArray(a);
  if (aArr !== Array.isArray(b)) return false;
  if (aArr) {
    const aList = a as unknown[];
    const bList = b as unknown[];
    if (aList.length !== bList.length) return false;
    for (let i = 0; i < aList.length; i++) {
      if (!deepEqual(aList[i], bList[i])) return false;
    }
    return true;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const ak = Object.keys(aObj);
  const bk = Object.keys(bObj);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(bObj, k)) return false;
    if (!deepEqual(aObj[k], bObj[k])) return false;
  }
  return true;
}

/** Read + parse the working file, or return null when it is absent/unparseable. */
export function readWorkingFile(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** List the working templates in a project's `.templatical/` folder, by name. */
export function listWorkingFiles(cwd: string): string[] {
  const dir = resolve(cwd, WORKING_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

async function readJsonBody(req: NodeJS.ReadableStream): Promise<
  | {
      content?: unknown;
      baseline?: boolean;
      blockId?: string;
      text?: string;
    }
  | undefined
> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

/**
 * Open a URL in the user's default browser — best-effort and cross-platform.
 * A silent no-op where there's no browser (headless / CI / sandbox); callers
 * always surface the URL too, so nothing is lost when this does nothing.
 */
export function openBrowser(url: string): void {
  const [cmd, cmdArgs]: [string, string[]] =
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
    /* ignore — the URL is surfaced by the caller regardless */
  }
}

// --------------------------------------------------------------------------
// Pidfile helpers (used by this package's own `live` CLI command; a future
// stdio-based MCP server would own its process lifecycle directly and would
// not need them)
// --------------------------------------------------------------------------

export interface PidfileInfo {
  pid: number;
  port: number;
}

export function pidfilePath(cwd: string): string {
  return resolve(cwd, PID_FILE);
}

export function readPidfile(cwd: string): PidfileInfo | null {
  const p = pidfilePath(cwd);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as PidfileInfo;
  } catch {
    return null;
  }
}

export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * A note the user left in the browser, against a block or the template as a
 * whole. Delivered on GET /content - the call the agent already makes before
 * every change - so notes need no polling and no separate endpoint to drain.
 */
export interface Annotation {
  id: string;
  /** null for a note about the template rather than one block. */
  blockId: string | null;
  text: string;
  createdAt: number;
}

// --------------------------------------------------------------------------
// Bridge server
// --------------------------------------------------------------------------

export interface BridgeHandle {
  server: Server;
  port: number;
  url: string;
  /** The absolute path of the working file this bridge is serving. */
  workingPath: string;
  /** The page's latest state, for callers that drive the bridge in-process. */
  getEditorState: () => {
    divergent: boolean;
    content: unknown;
    annotations: Annotation[];
  };
  /** Re-read the working file and push it to every connected page. */
  reload: () => { ok: boolean; clients: number };
  close: () => Promise<void>;
}

export interface StartBridgeOptions {
  cwd?: string;
  port?: number;
  file?: string;
  harnessFile?: string;
}

/**
 * Start the bridge HTTP server. Pure server + in-memory sync state; callers own
 * process lifecycle. Resolves once listening.
 *
 * The returned handle exposes `getEditorState` and `reload` directly, so an
 * in-process caller (the MCP server) never has to make an HTTP request to its
 * own bridge — that is the whole reason live mode can work inside a sandboxed
 * agent. The equivalent HTTP endpoints stay for the skill's out-of-process CLI.
 */
export function startBridge({
  cwd = process.cwd(),
  port = 0,
  file = join(WORKING_DIR, "template.json"),
  harnessFile = HARNESS_FILE,
}: StartBridgeOptions = {}): Promise<BridgeHandle> {
  const workingPath = isAbsolute(file) ? file : resolve(cwd, file);

  // Sync state. `baseline` is the editor's NORMALIZED view of the caller's last
  // content (captured by the page right after it applies an update), so the
  // editor's own load-time normalization never reads as a user edit.
  // `editorCurrent` is the page's latest getContent(); `divergent` is true when
  // it structurally differs from `baseline` — i.e. the user hand-edited.
  const state: {
    baseline: unknown;
    editorCurrent: unknown;
    divergent: boolean;
    annotations: Annotation[];
  } = {
    baseline: null,
    editorCurrent: null,
    divergent: false,
    annotations: [],
  };
  const clients = new Set<ServerResponse>();

  function broadcastTemplate(content: unknown): void {
    const payload = `event: template\ndata: ${JSON.stringify(content)}\n\n`;
    for (const res of clients) res.write(payload);
  }

  function getEditorState(): {
    divergent: boolean;
    content: unknown;
    annotations: Annotation[];
  } {
    return {
      divergent: state.divergent,
      content: state.editorCurrent,
      annotations: state.annotations,
    };
  }

  function reload(): { ok: boolean; clients: number } {
    // The caller wrote the working file; re-read and push it to the page. The
    // freshly-written file is the new baseline, so any pending user edit is
    // superseded — reset the divergence tracker.
    const content = readWorkingFile(workingPath);
    state.baseline = null;
    state.editorCurrent = null;
    state.divergent = false;
    // The caller has read these by the time it writes and reloads, so reload is
    // the resolve step: no separate protocol, and a note is never acted on twice.
    state.annotations = [];
    if (content !== null) broadcastTemplate(content);
    return { ok: true, clients: clients.size };
  }

  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
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
          // caller's content, not a user edit.
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
        res.end(JSON.stringify(getEditorState()));
        return;
      }

      if (method === "POST" && pathname === "/annotations") {
        const body = await readJsonBody(req);
        const text = typeof body?.text === "string" ? body.text.trim() : "";
        if (!text) {
          res.writeHead(400, { "content-type": "text/plain" });
          res.end("An annotation needs non-empty `text`.");
          return;
        }
        const annotation: Annotation = {
          id: `a${state.annotations.length + 1}-${Date.now().toString(36)}`,
          blockId: typeof body?.blockId === "string" ? body.blockId : null,
          text,
          createdAt: Date.now(),
        };
        state.annotations.push(annotation);
        res.writeHead(201, { "content-type": "application/json" });
        res.end(JSON.stringify(annotation));
        return;
      }

      if (method === "POST" && pathname === "/reload") {
        const result = reload();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
        return;
      }

      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    } catch (err) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end(`Bad request: ${(err as Error).message}`);
    }
  });

  return new Promise((resolvePromise, rejectPromise) => {
    // listen() reports failures (e.g. EADDRINUSE) as an 'error' event, not a
    // throw — without this the error would be unhandled and crash the process.
    const onListenError = (err: Error) => rejectPromise(err);
    server.once("error", onListenError);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", onListenError);
      const address = server.address();
      const actualPort =
        typeof address === "object" && address !== null ? address.port : port;
      resolvePromise({
        server,
        port: actualPort,
        url: `http://localhost:${actualPort}/`,
        workingPath,
        getEditorState,
        reload,
        close: () =>
          new Promise<void>((r) => {
            for (const c of clients) c.end();
            clients.clear();
            server.close(() => r());
          }),
      });
    });
  });
}

export interface PreferringHandle extends BridgeHandle {
  fellBack: boolean;
  preferredPort?: number;
}

/**
 * Start the bridge on `preferredPort`, falling back to an OS-assigned free port
 * when that one is occupied — so a busy port never fails the launch. The page
 * uses relative URLs, so the actual port is discovered, not assumed. The
 * returned handle carries `fellBack: true` when it landed on a different port.
 */
export async function startBridgePreferring({
  preferredPort = DEFAULT_PORT,
  ...opts
}: StartBridgeOptions & {
  preferredPort?: number;
} = {}): Promise<PreferringHandle> {
  try {
    const handle = await startBridge({ ...opts, port: preferredPort });
    return { ...handle, fellBack: false };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "EADDRINUSE") throw err;
    const handle = await startBridge({ ...opts, port: 0 });
    return { ...handle, fellBack: true, preferredPort };
  }
}
