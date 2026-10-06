import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error — plain .mjs helper, no types
import { ensureGitHistory, hasFullHistory } from "../scripts/git-history.mjs";

/** A fake `git` that answers fixed commands and throws on anything else. */
function fakeGit(answers: Record<string, string | Error>) {
  return vi.fn((args: string[]) => {
    const answer = answers[args.join(" ")];
    if (answer instanceof Error) throw answer;
    if (answer === undefined) throw new Error(`unexpected git ${args.join(" ")}`);
    return answer;
  });
}

const commands = (run: ReturnType<typeof fakeGit>) =>
  run.mock.calls.map(([args]) => args.join(" "));

describe("hasFullHistory", () => {
  it("is true in a full clone", () => {
    expect(
      hasFullHistory(fakeGit({ "rev-parse --is-shallow-repository": "false" })),
    ).toBe(true);
  });

  it("is false in a shallow clone", () => {
    expect(
      hasFullHistory(fakeGit({ "rev-parse --is-shallow-repository": "true" })),
    ).toBe(false);
  });

  it("is false outside a git checkout", () => {
    expect(
      hasFullHistory(
        fakeGit({
          "rev-parse --is-shallow-repository": new Error("not a git repository"),
        }),
      ),
    ).toBe(false);
  });
});

describe("ensureGitHistory", () => {
  it("does nothing off Cloudflare Pages", () => {
    const run = fakeGit({});
    expect(ensureGitHistory({ env: {}, run })).toBe("skipped");
    expect(commands(run)).toEqual([]);
  });

  it("leaves a full clone alone on Cloudflare Pages", () => {
    const run = fakeGit({ "rev-parse --is-shallow-repository": "false" });
    expect(ensureGitHistory({ env: { CF_PAGES: "1" }, run })).toBe("complete");
    expect(commands(run)).toEqual(["rev-parse --is-shallow-repository"]);
  });

  it("unshallows a shallow clone on Cloudflare Pages", () => {
    const run = fakeGit({
      "rev-parse --is-shallow-repository": "true",
      "fetch --unshallow --quiet": "",
    });
    expect(ensureGitHistory({ env: { CF_PAGES: "1" }, run })).toBe("unshallowed");
    expect(commands(run)).toEqual([
      "rev-parse --is-shallow-repository",
      "fetch --unshallow --quiet",
    ]);
  });

  it("reports a failed fetch and lets the build continue", () => {
    const log = vi.fn();
    const run = fakeGit({
      "rev-parse --is-shallow-repository": "true",
      "fetch --unshallow --quiet": new Error("network down"),
    });
    expect(ensureGitHistory({ env: { CF_PAGES: "1" }, run, log })).toBe("failed");
    expect(log).toHaveBeenCalledWith(
      "[git-history] could not unshallow: network down. lastUpdated stays off.",
    );
  });
});

/**
 * The injected runners above never reach `runGit`, so these cases load the
 * script against a stubbed `node:child_process` and read what the real default
 * runner hands it. A fetch that stalls would otherwise hold the Cloudflare
 * deploy until the platform's own build timeout.
 */
describe("the default git runner", () => {
  afterEach(() => {
    vi.doUnmock("node:child_process");
    vi.resetModules();
  });

  async function loadWith(
    execFileSync: (command: string, args: string[]) => string,
  ) {
    vi.resetModules();
    vi.doMock("node:child_process", () => ({ execFileSync }));
    // @ts-expect-error — plain .mjs helper, no types
    return import("../scripts/git-history.mjs");
  }

  it("bounds the history check to two minutes", async () => {
    const execFileSync = vi.fn(() => "false\n");
    const { hasFullHistory: check } = await loadWith(execFileSync);
    expect(check()).toBe(true);
    expect(execFileSync).toHaveBeenCalledTimes(1);
    expect(execFileSync).toHaveBeenCalledWith(
      "git",
      ["rev-parse", "--is-shallow-repository"],
      expect.objectContaining({ timeout: 120_000 }),
    );
  });

  it("bounds the unshallow fetch and treats its timeout as a failed fetch", async () => {
    const timedOut = Object.assign(new Error("spawnSync git ETIMEDOUT"), {
      code: "ETIMEDOUT",
    });
    const execFileSync = vi.fn((_command: string, args: string[]) => {
      if (args[0] === "rev-parse") return "true\n";
      throw timedOut;
    });
    const { ensureGitHistory: ensure } = await loadWith(execFileSync);
    const log = vi.fn();
    expect(ensure({ env: { CF_PAGES: "1" }, log })).toBe("failed");
    expect(execFileSync).toHaveBeenLastCalledWith(
      "git",
      ["fetch", "--unshallow", "--quiet"],
      expect.objectContaining({ timeout: 120_000 }),
    );
    expect(log).toHaveBeenCalledWith(
      "[git-history] could not unshallow: spawnSync git ETIMEDOUT. lastUpdated stays off.",
    );
  });
});

describe("docs config", () => {
  it("turns lastUpdated on exactly when git can date every page", async () => {
    const { default: config } = await import("../.vitepress/config");
    expect(config.lastUpdated).toBe(hasFullHistory());
  });
});
