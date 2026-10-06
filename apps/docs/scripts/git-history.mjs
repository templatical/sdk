import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Every git call is bounded. An unshallow fetch that stalls on the network
// would otherwise hold the deploy until the platform's own build timeout; past
// this, git is killed, execFileSync throws ETIMEDOUT, and the callers below
// take the failure paths they already have.
const GIT_TIMEOUT_MS = 120_000;

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: GIT_TIMEOUT_MS,
  }).trim();
}

/**
 * Whether git can date each page. VitePress takes a page's lastUpdated from
 * `git log -1 -- <file>`; in a shallow clone every file reports the clone's
 * one commit, so every page would claim the same date. Outside a checkout
 * (a tarball build) there is no history at all.
 */
export function hasFullHistory(run = runGit) {
  try {
    return run(["rev-parse", "--is-shallow-repository"]) === "false";
  } catch {
    return false;
  }
}

/**
 * Cloudflare Pages clones shallow and sets CF_PAGES for its builds. There,
 * fetch the rest of history so page dates are real. Anywhere else this does
 * nothing: local checkouts are full, and CI's docs build is a gate, not a
 * deploy. A failed fetch never fails the build; lastUpdated just stays off.
 */
export function ensureGitHistory({
  env = process.env,
  run = runGit,
  log = console.log,
} = {}) {
  if (!env.CF_PAGES) return "skipped";
  if (hasFullHistory(run)) return "complete";
  try {
    run(["fetch", "--unshallow", "--quiet"]);
    return "unshallowed";
  } catch (error) {
    log(
      `[git-history] could not unshallow: ${error.message}. lastUpdated stays off.`,
    );
    return "failed";
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  ensureGitHistory();
}
