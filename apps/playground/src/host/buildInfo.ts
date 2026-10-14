/**
 * Which SDK build the playground runs. It builds from the workspace, so on
 * `main` it can be ahead of the latest release: a bug that won't reproduce
 * here may be fixed but unreleased. The values are baked in at build time by
 * `scripts/build-info.ts` through Vite's `define`.
 */
export interface BuildInfo {
  /** The fixed-group version, read from the editor's package.json. */
  version: string;
  /** Full commit hash, or null when neither Pages nor git could say. */
  commit: string | null;
}

const REPO_URL = "https://github.com/templatical/sdk";

export function shortCommit(commit: string): string {
  return commit.slice(0, 7);
}

/**
 * GitHub's compare view from the release tag to the built commit: it lists
 * exactly what the playground has that the release doesn't, and reads
 * "identical" on a release commit. That answers the question without the git
 * tags a shallow Pages clone lacks.
 */
export function compareUrl(info: BuildInfo): string | null {
  if (!info.commit) return null;
  return `${REPO_URL}/compare/v${info.version}...${info.commit}`;
}
