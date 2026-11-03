import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXAMPLES, socketsOnPort } from "../scripts/examples-verify.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function configPort(file: string, pattern: RegExp): number {
  const match = pattern.exec(readFileSync(join(repoRoot, file), "utf8"));
  if (!match) throw new Error(`no port found in ${file}`);
  return Number(match[1]);
}

/**
 * Every port CI binds, by owner. A port inside Linux's ephemeral range
 * (32768–60999) can be the local port of an outgoing or TIME_WAIT socket when
 * the server starts, and the bind fails with EADDRINUSE although nothing
 * listens: the examples (nuxt) leg failed that way on 51742.
 */
const CI_PORTS: Record<string, number> = {
  "playground e2e": configPort("playwright.config.ts", /E2E_PORT \?\? (\d+)\)/),
  "consumer smoke": configPort(
    "playwright.consumer.config.ts",
    /const PORT = (\d+);/,
  ),
  ...Object.fromEntries(
    Object.entries(EXAMPLES).map(([name, example]) => [
      `examples (${name})`,
      example.port,
    ]),
  ),
};

describe("ports CI binds", () => {
  it("covers the playground, the consumer smoke and all five examples", () => {
    expect(Object.keys(CI_PORTS)).toEqual([
      "playground e2e",
      "consumer smoke",
      "examples (nextjs)",
      "examples (nuxt)",
      "examples (sveltekit)",
      "examples (react-router)",
      "examples (react-vite)",
    ]);
  });

  it("sit below Linux's ephemeral range and above the privileged ports", () => {
    for (const [owner, port] of Object.entries(CI_PORTS)) {
      expect({ owner, port, below: port < 32768, above: port >= 1024 }).toEqual(
        { owner, port, below: true, above: true },
      );
    }
  });

  it("are all different", () => {
    const ports = Object.values(CI_PORTS);
    expect(new Set(ports).size).toBe(ports.length);
  });
});

// The script exports its port table, so it runs main() only when executed. If
// that check ever misfires, `pnpm run test:examples nuxt` does nothing and
// exits 0, and every examples leg passes without testing anything.
describe("examples-verify.mjs run as a script", () => {
  it("runs main: no example name is a usage error", () => {
    const result = spawnSync(
      process.execPath,
      [join(repoRoot, "packages/editor/scripts/examples-verify.mjs")],
      { encoding: "utf8" },
    );
    expect([result.status, result.stderr.trim()]).toEqual([
      2,
      "usage: examples-verify.mjs <nextjs|nuxt|sveltekit|react-router|react-vite> [--build] [--keep]",
    ]);
  });
});

describe("socketsOnPort", () => {
  // Rows in /proc/net/tcp's layout: sl, local, remote, state, queues, timers,
  // retransmits, uid, timeout, inode.
  const header =
    "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode";
  const tcp = [
    header,
    "   0: 0100007F:54DE 0100007F:01BB 06 00000000:00000000 03:00000F9A 00000000     0        0 0 3 0000000000000000",
    "   1: 00000000:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 41231 1 0000000000000000",
    "   2: 0100007F:C9FE 0100007F:54DE 01 00000000:00000000 00:00000000 00000000  1000        0 41299 1 0000000000000000",
  ].join("\n");

  it("lists the sockets whose local port is the one asked for, with their state", () => {
    expect(socketsOnPort({ "/proc/net/tcp": tcp }, 0x54de)).toEqual([
      {
        table: "/proc/net/tcp",
        local: "0100007F:54DE",
        remote: "0100007F:01BB",
        state: "TIME_WAIT",
        inode: "0",
      },
    ]);
    expect(socketsOnPort({ "/proc/net/tcp": tcp }, 8080)).toEqual([
      {
        table: "/proc/net/tcp",
        local: "00000000:1F90",
        remote: "00000000:0000",
        state: "LISTEN",
        inode: "41231",
      },
    ]);
  });

  it("matches the local port only, never the remote one", () => {
    expect(
      socketsOnPort({ "/proc/net/tcp": tcp }, 0x54de).map((s) => s.remote),
    ).toEqual(["0100007F:01BB"]);
  });

  it("returns nothing for a port no socket uses, or with no tables", () => {
    expect(socketsOnPort({ "/proc/net/tcp": tcp }, 4747)).toEqual([]);
    expect(socketsOnPort({}, 0x54de)).toEqual([]);
  });
});
