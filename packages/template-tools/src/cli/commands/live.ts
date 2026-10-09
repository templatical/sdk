import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import { EXIT, resolveFrom, UsageError } from "../io";
import {
  DEFAULT_PORT,
  listWorkingFiles,
  type LiveMode,
  type PidfileInfo,
  openBrowser,
  pidfilePath,
  processAlive,
  readPidfile,
  readWorkingFile,
  startBridgePreferring,
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
  return fetch(`http://localhost:${port}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** The reload-failure line, naming what to run next. */
function reloadFailure(bridgeError: string | undefined): string {
  if (bridgeError?.includes("--host")) {
    return "The --host template is missing or invalid; nothing was pushed. Run `templatical validate` on it.";
  }
  if (bridgeError === undefined || bridgeError.includes("custom block")) {
    return "The custom block definition is missing or invalid; nothing was pushed. Run `templatical custom-block validate`.";
  }
  return `${bridgeError} Nothing was pushed.`;
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
      };
      const clients = body.clients ?? 0;
      const consumed = body.consumed === true;
      if (body.ok === false) {
        const error = reloadFailure(body.error);
        emit(
          { reloaded: false, ok: false, clients, consumed, error },
          () => error,
        );
        return EXIT.invalid;
      }
      emit({ reloaded: true, ok: true, clients, consumed }, () =>
        body.mode === "custom-block"
          ? `Pushed the custom block to ${clients} page(s).`
          : `Pushed the working file to ${clients} connected page(s).`,
      );
      return EXIT.ok;
    }
    try {
      process.kill(info.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
    rmSync(pidfilePath(cwd), { force: true });
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
  const abs = (p: string) => (isAbsolute(p) ? p : resolve(cwd, p));
  const requested: Required<Pick<PidfileInfo, "mode" | "path">> &
    Pick<PidfileInfo, "host"> = {
    mode: customBlock ? "custom-block" : "template",
    path: abs(customBlock ?? file ?? join(WORKING_DIR, "template.json")),
    ...(host ? { host: abs(host) } : {}),
  };

  const existing = readPidfile(cwd);
  if (existing && processAlive(existing.pid)) {
    // A pidfile without `mode` came from a template-only bridge; one without
    // `path` can't be compared, so only its mode is.
    const mode = existing.mode ?? "template";
    if (
      mode !== requested.mode ||
      (existing.path !== undefined && existing.path !== requested.path) ||
      (mode === "custom-block" && existing.host !== requested.host)
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
  if (existing) rmSync(pidfilePath(cwd), { force: true }); // stale

  const handle = await startBridgePreferring({
    cwd,
    preferredPort,
    file,
    customBlock,
    host,
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

  const cleanup = () => {
    rmSync(pidfilePath(cwd), { force: true });
    handle.close().finally(() => process.exit(EXIT.ok));
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Emit before blocking: the caller needs the URL and the working path now,
  // not when the server shuts down.
  emit(
    {
      url: handle.url,
      port: handle.port,
      preferredPort,
      fellBack: handle.fellBack,
      workingFile: handle.workingPath,
      customBlock: customBlock ? handle.workingPath : undefined,
    },
    () =>
      [
        `Templatical live preview running at ${handle.url}`,
        handle.fellBack
          ? `(port ${preferredPort} was busy - using ${handle.port})`
          : "",
        `${customBlock ? "Custom block" : "Working file"}: ${handle.workingPath}`,
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
