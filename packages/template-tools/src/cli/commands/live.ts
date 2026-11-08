import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import { EXIT, resolveFrom, UsageError } from "../io";
import { parseValuesFlag } from "./custom-block";
import {
  DEFAULT_PORT,
  IDENTITY_TIMEOUT_MS,
  listWorkingFiles,
  type FetchSummary,
  type LiveMode,
  type PidfileInfo,
  openBrowser,
  pidfilePath,
  processAlive,
  readPidfile,
  readWorkingFile,
  startBridgePreferring,
  verifyLiveServer,
  WORKING_DIR,
} from "../../live/index";

/**
 * The first title block's text in document order, as a hint for `list`.
 *
 * It must descend into a section's columns, not scan top-level blocks only:
 * templates put their content inside sections (that is the documented
 * structure), so a top-level scan finds nothing for a real template. Measured
 * across all five of the templatical skill's examples — event-invite, newsletter,
 * product-sale, receipt, welcome — none has a top-level title block, so a
 * shallow version of this returns null every time and the hint is dead code.
 */
function titleHint(content: unknown): string | null {
  return findTitle((content as { blocks?: unknown })?.blocks);
}

function findTitle(blocks: unknown): string | null {
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks as Array<{
    type?: string;
    content?: string;
    children?: unknown[];
  }>) {
    if (block?.type === "title" && typeof block.content === "string") {
      return block.content;
    }
    if (block?.type === "section" && Array.isArray(block.children)) {
      for (const column of block.children) {
        const hit = findTitle(column);
        if (hit) return hit;
      }
    }
  }
  return null;
}

export function runList(args: ParsedArgs): number {
  const cwd = flagValue(args, "cwd") ?? process.cwd();
  const templates = listWorkingFiles(cwd).map((name) => ({
    name,
    title: titleHint(readWorkingFile(join(cwd, WORKING_DIR, name))),
  }));
  emit({ templates }, () =>
    templates.length === 0
      ? `No templates in ${WORKING_DIR}/`
      : templates
          .map((t) => `  ${t.name}${t.title ? ` - ${t.title}` : ""}`)
          .join("\n"),
  );
  return EXIT.ok;
}

async function postTo(
  port: number,
  path: string,
  body?: unknown,
): Promise<Response> {
  // 127.0.0.1, where the bridge listens and verifyLiveServer checked it:
  // `localhost` can resolve to ::1 first and reach a different server.
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Removes the pidfile only while it still records `pid`: a server started in
 * the meantime keeps its own pidfile.
 */
function removePidfileOf(cwd: string, pid: number): void {
  const path = pidfilePath(cwd);
  try {
    const recorded = (
      JSON.parse(readFileSync(path, "utf8")) as { pid?: unknown }
    ).pid;
    if (recorded === pid) rmSync(path, { force: true });
  } catch {
    /* missing or unreadable: nothing of ours to remove */
  }
}

function untrustedPidfile(): UsageError {
  return new UsageError(
    `The pidfile does not belong to a live server for this workspace. Delete ${WORKING_DIR}/live-server.pid and try again.`,
  );
}

function noAnswer(info: PidfileInfo): UsageError {
  return new UsageError(
    `The live server (pid ${info.pid}) did not answer on port ${info.port} within ${IDENTITY_TIMEOUT_MS / 1000} s. If it is busy, try again; if it is not a live server, delete ${WORKING_DIR}/live-server.pid.`,
  );
}

/** The fetched state's outcome, as one line of reload or start output. */
function fetchLine(fetch: FetchSummary): string {
  if (!fetch.ok) return `Fetched state: the request failed. ${fetch.error}`;
  return fetch.unmapped.length > 0
    ? `Fetched state: filled from the API; not in the response: ${fetch.unmapped.join(", ")}.`
    : "Fetched state: filled from the API.";
}

export async function runLive(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  const cwd = resolveFrom(flagValue(args, "cwd") ?? ".", process.cwd());

  if (sub === "reload" || sub === "stop") {
    const info = readPidfile(cwd);
    if (!info || !processAlive(info.pid)) {
      throw new UsageError(
        `No live server is running here (no live pidfile at ${WORKING_DIR}/live-server.pid).`,
      );
    }
    const check = await verifyLiveServer(cwd, info);
    if (check === "no-answer") throw noAnswer(info);
    if (check === "mismatch") throw untrustedPidfile();
    if (sub === "reload") {
      const consumeAnnotations = args.flags["consume-annotations"] === true;
      const res = await postTo(
        info.port,
        "/reload",
        consumeAnnotations ? { consumeAnnotations: true } : undefined,
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        clients?: number;
        consumed?: boolean;
        mode?: LiveMode;
        error?: string;
        fetch?: FetchSummary;
      };
      const clients = body.clients ?? 0;
      const consumed = body.consumed === true;
      // The bridge's error already names what failed and what to run; a
      // refused request (a 403 from a rewritten Host, say) has no body at all.
      if (res.status >= 400 || body.ok === false) {
        const reason =
          body.error ??
          (res.status >= 400
            ? `The live server refused the reload (${res.status}).`
            : "The live server reported a failed reload.");
        const error = `${reason} Nothing was pushed.`;
        emit(
          { reloaded: false, ok: false, clients, consumed, error },
          () => error,
        );
        return EXIT.invalid;
      }
      const fetch = body.fetch;
      emit(
        {
          reloaded: true,
          ok: true,
          clients,
          consumed,
          ...(fetch ? { fetch } : {}),
        },
        () =>
          [
            body.mode === "custom-block"
              ? `Pushed the custom block to ${clients} page(s).`
              : `Pushed the working file to ${clients} connected page(s).`,
            fetch ? fetchLine(fetch) : "",
          ]
            .filter(Boolean)
            .join("\n"),
      );
      return EXIT.ok;
    }
    // No signal fallback: the pid came from the pidfile and /identity, both of
    // which another local process can forge, so signalling it could hit any
    // process this user owns. A server that passes /identity answers /shutdown.
    let failure: string | null = null;
    try {
      const response = await postTo(info.port, "/shutdown", {});
      if (!response.ok) failure = `it answered ${response.status}`;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    if (failure !== null) {
      throw new UsageError(
        `The live server (pid ${info.pid}) did not stop: POST /shutdown failed (${failure}). Stop that process yourself, then delete ${WORKING_DIR}/live-server.pid.`,
      );
    }
    removePidfileOf(cwd, info.pid);
    emit({ stopped: true }, () => "Stopped the live server.");
    return EXIT.ok;
  }

  if (sub !== undefined) {
    throw new UsageError(
      `Unknown "live ${sub}". Use \`live\`, \`live reload\` or \`live stop\`.`,
    );
  }

  // start
  const portFlag = flagValue(args, "port");
  const preferredPort = portFlag ? Number(portFlag) : DEFAULT_PORT;
  const file = flagValue(args, "file");
  const customBlock = flagValue(args, "custom-block");
  const host = flagValue(args, "host");
  if (customBlock && file) {
    throw new UsageError("Pass either --file or --custom-block, not both.");
  }
  if (host && !customBlock) {
    throw new UsageError("--host only applies with --custom-block.");
  }
  const fetchOn = args.flags.fetch === true;
  if (fetchOn && !customBlock) {
    throw new UsageError("--fetch only applies with --custom-block.");
  }
  const valuesRaw = flagValue(args, "values");
  if (valuesRaw !== undefined && !fetchOn) {
    throw new UsageError("--values only applies with --fetch.");
  }
  const fetchValues = fetchOn ? parseValuesFlag(valuesRaw) : undefined;
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(cwd, p));
  const requested: Required<Pick<PidfileInfo, "mode" | "path">> &
    Pick<PidfileInfo, "host" | "fetch"> = {
    mode: customBlock ? "custom-block" : "template",
    path: abs(customBlock ?? file ?? join(WORKING_DIR, "template.json")),
    ...(host ? { host: abs(host) } : {}),
    ...(fetchValues ? { fetch: fetchValues } : {}),
  };

  const existing = readPidfile(cwd);
  if (existing && processAlive(existing.pid)) {
    // A live pid that doesn't answer as this workspace's server is never
    // trusted and never silently replaced: it may be a busy bridge that pages
    // are still attached to, so recovering is the user's call.
    const check = await verifyLiveServer(cwd, existing);
    if (check === "no-answer") throw noAnswer(existing);
    if (check === "mismatch") {
      throw new UsageError(
        `Process ${existing.pid} from ${WORKING_DIR}/live-server.pid is running but does not answer as this workspace's live server. If it is a live server, stop it; otherwise delete ${WORKING_DIR}/live-server.pid. Then run \`templatical live\` again.`,
      );
    }
    // A pidfile without `mode` came from a template-only bridge; one without
    // `path` can't be compared, so only its mode is.
    const mode = existing.mode ?? "template";
    if (
      mode !== requested.mode ||
      (existing.path !== undefined && existing.path !== requested.path) ||
      (mode === "custom-block" &&
        (existing.host !== requested.host ||
          JSON.stringify(existing.fetch) !== JSON.stringify(requested.fetch)))
    ) {
      throw new UsageError(
        `A live server is already running for ${existing.path ?? "another file"} (${mode}). Run \`templatical live stop\` first.`,
      );
    }
    emit(
      {
        url: `http://localhost:${existing.port}/`,
        pid: existing.pid,
        alreadyRunning: true,
      },
      () =>
        `Live server already running (pid ${existing.pid}) at http://localhost:${existing.port}/`,
    );
    return EXIT.ok;
  }
  if (existing) rmSync(pidfilePath(cwd), { force: true }); // its process is gone

  // Runs once: a second signal while the bridge closes would otherwise delete
  // the pidfile of a replacement server started in the meantime.
  let closing = false;
  const cleanup = () => {
    if (closing) return;
    closing = true;
    removePidfileOf(cwd, process.pid);
    handle.close().finally(() => process.exit(EXIT.ok));
  };
  const handle = await startBridgePreferring({
    cwd,
    preferredPort,
    file,
    customBlock,
    host,
    ...(fetchValues ? { fetch: { values: fetchValues } } : {}),
    onShutdown: cleanup,
  });

  mkdirSync(dirname(pidfilePath(cwd)), { recursive: true });
  writeFileSync(
    pidfilePath(cwd),
    JSON.stringify({
      pid: process.pid,
      port: handle.port,
      ...requested,
      path: handle.workingPath,
    } satisfies PidfileInfo),
    "utf8",
  );

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Emit before blocking: the caller needs the URL and the working path now,
  // not when the server shuts down.
  const fetch = handle.lastFetch();
  emit(
    {
      url: handle.url,
      port: handle.port,
      preferredPort,
      fellBack: handle.fellBack,
      workingFile: handle.workingPath,
      customBlock: customBlock ? handle.workingPath : undefined,
      fetch: fetch ?? undefined,
    },
    () =>
      [
        `Templatical live preview running at ${handle.url}`,
        handle.fellBack
          ? `(port ${preferredPort} was busy - using ${handle.port})`
          : "",
        `${customBlock ? "Custom block" : "Working file"}: ${handle.workingPath}`,
        fetch ? fetchLine(fetch) : "",
      ]
        .filter(Boolean)
        .join("\n"),
  );

  if (args.flags["no-open"]) {
    note(`Open ${handle.url} in a browser.`);
  } else {
    note(`Opening ${handle.url} in your default browser...`);
    openBrowser(handle.url);
  }
  note("After writing the working file, run: templatical live reload");

  // Block: the bridge owns the process until a signal arrives.
  return new Promise<number>(() => {});
}
