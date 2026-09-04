import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { flagValue, type ParsedArgs } from "../args";
import { emit, note } from "../output";
import { EXIT, resolveFrom, UsageError } from "../io";
import {
  DEFAULT_PORT,
  listWorkingFiles,
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
 * across all five of the Agent Skill's own examples — event-invite, newsletter,
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

async function postTo(port: number, path: string): Promise<Response> {
  return fetch(`http://localhost:${port}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
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
      const res = await postTo(info.port, "/reload");
      const body = (await res.json().catch(() => ({}))) as { clients?: number };
      emit(
        { reloaded: true, clients: body.clients ?? 0 },
        () =>
          `Pushed the working file to ${body.clients ?? 0} connected page(s).`,
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
  const existing = readPidfile(cwd);
  if (existing && processAlive(existing.pid)) {
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

  const file = flagValue(args, "file");
  const handle = await startBridgePreferring({ cwd, preferredPort, file });

  mkdirSync(dirname(pidfilePath(cwd)), { recursive: true });
  writeFileSync(
    pidfilePath(cwd),
    JSON.stringify({ pid: process.pid, port: handle.port }),
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
    },
    () =>
      [
        `Templatical live preview running at ${handle.url}`,
        handle.fellBack
          ? `(port ${preferredPort} was busy - using ${handle.port})`
          : "",
        `Working file: ${handle.workingPath}`,
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
