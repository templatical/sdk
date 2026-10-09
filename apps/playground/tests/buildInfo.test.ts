import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readBuildInfo, resolveCommit } from "../scripts/build-info";
import { compareUrl, shortCommit } from "../src/host/buildInfo";

const SHA = "15f8a3b4c0ffee0123456789abcdef0123456789";
const OTHER_SHA = "55f0476cdeadbeef0123456789abcdef01234567";
const REPO_ROOT = join(import.meta.dirname, "../../..");

describe("resolveCommit", () => {
  it("prefers the commit Cloudflare Pages is building", () => {
    expect(resolveCommit({ CF_PAGES_COMMIT_SHA: SHA }, () => OTHER_SHA)).toBe(
      SHA,
    );
  });

  it("falls back to git HEAD outside Cloudflare Pages", () => {
    expect(resolveCommit({}, () => `${OTHER_SHA}\n`)).toBe(OTHER_SHA);
  });

  it("falls back to git when the Pages variable is not a commit hash", () => {
    expect(
      resolveCommit({ CF_PAGES_COMMIT_SHA: "main" }, () => OTHER_SHA),
    ).toBe(OTHER_SHA);
  });

  it("lowercases the hash", () => {
    expect(
      resolveCommit({ CF_PAGES_COMMIT_SHA: SHA.toUpperCase() }, () => ""),
    ).toBe(SHA);
  });

  it("returns null when git fails", () => {
    expect(
      resolveCommit({}, () => {
        throw new Error("not a git repository");
      }),
    ).toBe(null);
  });

  it("returns null when git prints something other than a hash", () => {
    expect(resolveCommit({}, () => "fatal: bad revision")).toBe(null);
  });
});

describe("readBuildInfo", () => {
  it("reads the version from the editor package, which every package shares", () => {
    const { version } = JSON.parse(
      readFileSync(join(REPO_ROOT, "packages/editor/package.json"), "utf8"),
    ) as { version: string };
    expect(readBuildInfo(REPO_ROOT, { CF_PAGES_COMMIT_SHA: SHA })).toEqual({
      version,
      commit: SHA,
    });
  });
});

describe("shortCommit", () => {
  it("keeps the first seven characters", () => {
    expect(shortCommit(SHA)).toBe("15f8a3b");
  });
});

describe("compareUrl", () => {
  it("compares the release tag with the commit the playground was built from", () => {
    expect(compareUrl({ version: "0.44.0", commit: SHA })).toBe(
      `https://github.com/templatical/sdk/compare/v0.44.0...${SHA}`,
    );
  });

  it("returns null without a commit", () => {
    expect(compareUrl({ version: "0.44.0", commit: null })).toBe(null);
  });
});
