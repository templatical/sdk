import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BuildInfo } from "../src/host/buildInfo";

const COMMIT_HASH = /^[0-9a-f]{7,40}$/i;

/**
 * The commit the playground is built from. Cloudflare Pages states it in
 * `CF_PAGES_COMMIT_SHA`; anywhere else git HEAD answers. The value ends up
 * in a link, so anything that isn't a commit hash is dropped.
 */
export function resolveCommit(
  env: Record<string, string | undefined>,
  readGitHead: () => string,
): string | null {
  const fromPages = env.CF_PAGES_COMMIT_SHA?.trim();
  if (fromPages && COMMIT_HASH.test(fromPages)) return fromPages.toLowerCase();
  try {
    const head = readGitHead().trim();
    return COMMIT_HASH.test(head) ? head.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function readBuildInfo(
  repoRoot: string,
  env: Record<string, string | undefined> = process.env,
): BuildInfo {
  const { version } = JSON.parse(
    readFileSync(resolve(repoRoot, "packages/editor/package.json"), "utf8"),
  ) as { version: string };
  const commit = resolveCommit(env, () =>
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
  return { version, commit };
}
