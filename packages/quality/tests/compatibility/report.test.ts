import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as snapshot from "./fixtures/expected";
import { CANIEMAIL_SOURCE } from "../../src/compatibility/data/caniemail.generated";
import {
  caniemailReport,
  reportCaniemail,
} from "../../scripts/caniemail-report.mjs";

const fixture = (name: string) =>
  readFileSync(resolve(import.meta.dirname, "fixtures", name), "utf8");
const upstream = fixture("report-api.json");
const slugs = ["css-display-flex"];
const pinned = {
  "css-display-flex": { 2: "`display:inline-flex` is not supported." },
};

describe("caniemail freshness report", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prints nothing when upstream is not newer than the snapshot", () => {
    expect(reportCaniemail(fixture("api.json"), snapshot, slugs, pinned)).toBe(
      "",
    );
    const older = upstream.replace(
      "2026-10-20 08:00:00 +0000",
      "2026-09-16 12:00:00 +0000",
    );
    expect(reportCaniemail(older, snapshot, slugs, pinned)).toBe("");
  });

  it("compares the time, not only the day, in either offset", () => {
    const sameDayLater = upstream.replace(
      "2026-10-20 08:00:00 +0000",
      "2026-09-16 15:05:00 +0200",
    );
    expect(reportCaniemail(sameDayLater, snapshot, slugs, pinned)).toBe("");
    const sameDayNewer = upstream.replace(
      "2026-10-20 08:00:00 +0000",
      "2026-09-16 13:06:00 +0000",
    );
    expect(
      reportCaniemail(sameDayNewer, snapshot, slugs, pinned).split("\n")[0],
    ).toBe(
      "caniemail has newer data: upstream `last_update_date` is `2026-09-16 13:06:00 +0000`; the vendored snapshot has `2026-09-16 13:05:00 +0000`.",
    );
  });

  it("reports verdict, pinned-note, note and candidate changes", () => {
    expect(reportCaniemail(upstream, snapshot, slugs, pinned)).toBe(
      [
        "caniemail has newer data: upstream `last_update_date` is `2026-10-20 08:00:00 +0000`; the vendored snapshot has `2026-09-16 13:05:00 +0000`.",
        "",
        "### Verdict changes in registered features",
        "",
        "A cell is the client's last-listed verdict as the snapshot keeps it: `y`, `a` (partial) or `n`, with its note numbers. — means supported without notes, or untested.",
        "",
        "| Feature | Client | Snapshot | Upstream |",
        "| --- | --- | --- | --- |",
        "| `css-display-flex` | Gmail Webmail | `n #2` | `a #3` |",
        "| `css-display-flex` | Outlook Windows | — | `n` |",
        "",
        "### Pinned notes that changed",
        "",
        "A detector narrows its verdict with each of these notes. Re-check its predicate in `noteExcludes` (`packages/quality/src/compatibility/support.ts`).",
        "",
        '- `css-display-flex` #2: "`display:inline-flex` is not supported." → "`display:inline-flex` is only partly supported."',
        "",
        "### Other note changes in registered features",
        "",
        '- `css-display-flex` #3 added: "Ignored inside &lt;table&gt; cells."',
        "",
        "### Candidate features",
        "",
        "Unregistered features last tested after 2026-09-16 that a Gmail or Outlook platform doesn't support. Add a detector only when the feature loses content or layout there, not when it only degrades.",
        "",
        "- [fails in every Gmail platform](https://www.caniemail.com/features/css-all-gmail/) (`css-all-gmail`), tested 2026-10-12: `n` in Gmail",
        "- [&lt;marquee&gt; element](https://www.caniemail.com/features/html-marquee/) (`html-marquee`), tested 2026-10-05: `n` in Outlook (Windows)",
        "",
        "### Refresh",
        "",
        "1. Run `pnpm --filter @templatical/quality run sync:caniemail`.",
        "2. Replace `2026-09-16` with `2026-10-20` in every file `git grep -l 2026-09-16 -- apps/docs/quality apps/docs/de/quality` lists, then run `pnpm --filter @templatical/docs run build:agent-surface`.",
        "3. Run `pnpm --filter @templatical/quality run build`, then `pnpm --filter @templatical/quality run test` and `pnpm --filter @templatical/docs run test`. A changed pinned note fails `data.test.ts`: update `packages/quality/src/compatibility/pinned-notes.json`, the predicate in `noteExcludes`, and the rule's **Narrowing** line in both rule catalogs. `apps/docs/tests/docs-caniemail-parity.test.ts` checks the docs date and the cited note numbers.",
        "4. A new detector registers its slug in `packages/quality/src/compatibility/slugs.json`. Run the sync again after adding it.",
        "5. Add a changeset for `@templatical/quality` (`pnpm exec changeset`): the refreshed data ships in the package.",
        "",
      ].join("\n"),
    );
  });

  it("reads each client's last-listed verdict, never the numerically sorted one", () => {
    // JSON.parse would move "2024" after "2019"; the source lists 2019 last.
    expect(reportCaniemail(upstream, snapshot, slugs, pinned)).not.toContain(
      "css-integer-versions",
    );
    const reordered = upstream.replace(
      '"2024": "n", "2019": "y"',
      '"2019": "y", "2024": "n"',
    );
    expect(reportCaniemail(reordered, snapshot, slugs, pinned)).toContain(
      "- [retested as supported](https://www.caniemail.com/features/css-integer-versions/) (`css-integer-versions`), tested 2026-10-11: `n` in Gmail\n",
    );
  });

  it("reports changed and removed notes, keeping code spans unescaped", () => {
    const flex = snapshot.CANIEMAIL_DATA["css-display-flex"];
    const edited = {
      ...snapshot,
      CANIEMAIL_DATA: {
        "css-display-flex": {
          ...flex,
          notes: {
            ...flex.notes,
            3: "Ignored in `<td>` cells.",
            4: "Gone <soon>.",
          },
        },
      },
    };
    const report = reportCaniemail(upstream, edited, slugs, {
      "css-display-flex": { ...pinned["css-display-flex"], 5: "Pinned." },
    });
    expect(report).toContain(
      [
        "### Pinned notes that changed",
        "",
        "A detector narrows its verdict with each of these notes. Re-check its predicate in `noteExcludes` (`packages/quality/src/compatibility/support.ts`).",
        "",
        '- `css-display-flex` #2: "`display:inline-flex` is not supported." → "`display:inline-flex` is only partly supported."',
        '- `css-display-flex` #5: "Pinned." → removed',
        "",
        "### Other note changes in registered features",
        "",
        '- `css-display-flex` #3 changed: "Ignored in `<td>` cells." → "Ignored inside &lt;table&gt; cells."',
        '- `css-display-flex` #4 removed (was "Gone &lt;soon&gt;.")',
        "",
      ].join("\n"),
    );
  });

  it("says None for each section with nothing to report", () => {
    const quiet = JSON.stringify({
      ...JSON.parse(fixture("api.json")),
      last_update_date: "2026-10-20 08:00:00 +0000",
    });
    const report = reportCaniemail(quiet, snapshot, slugs, pinned);
    for (const heading of [
      "Verdict changes in registered features",
      "Pinned notes that changed",
      "Other note changes in registered features",
    ]) {
      expect(report).toContain(`### ${heading}\n\nNone.\n`);
    }
    expect(report).toContain("only degrades.\n\nNone.\n\n### Refresh\n");
    expect(report).not.toContain("### Blocks the sync");
  });

  it("lists what would make the sync fail", () => {
    const broken = upstream.replace('"a #3"', '"x #3"');
    const report = reportCaniemail(
      broken,
      snapshot,
      ["css-display-flex", "css-removed"],
      pinned,
    );
    expect(report).toContain(
      [
        "### Blocks the sync",
        "",
        "`sync:caniemail` fails until these are resolved:",
        "",
        "- `css-display-flex`: Unknown verdict css-display-flex/gmail.webmail: x #3.",
        "- `css-removed`: not in the upstream data.",
        "",
        "### Verdict changes in registered features",
        "",
        "None.",
        "",
      ].join("\n"),
    );
    // A registered slug is never a candidate, even while blocked.
    expect(report).not.toContain("(`css-removed`)");
  });

  it("stops at the API version when the format is unsupported", () => {
    const next = upstream.replace('"1.0.4"', '"2.0.0"');
    expect(reportCaniemail(next, snapshot, slugs, pinned)).toBe(
      [
        "caniemail has newer data: upstream `last_update_date` is `2026-10-20 08:00:00 +0000`; the vendored snapshot has `2026-09-16 13:05:00 +0000`.",
        "",
        "The upstream API version is `2.0.0`, and `sync:caniemail` only accepts `1.x`. Update `packages/quality/scripts/sync-caniemail.mjs` for the new format before syncing.",
        "",
      ].join("\n"),
    );
  });

  it("throws on a date it can't compare", () => {
    const iso = upstream.replace(
      "2026-10-20 08:00:00 +0000",
      "2026-10-20T08:00:00Z",
    );
    expect(() => reportCaniemail(iso, snapshot, slugs, pinned)).toThrow(
      "Unrecognized caniemail date: 2026-10-20T08:00:00Z",
    );
  });

  it("reads the vendored snapshot, slugs and pinned notes from the package", async () => {
    const respond = (lastUpdateDate: string) =>
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            api_version: "1.0.4",
            last_update_date: lastUpdateDate,
            nicenames: { family: {}, platform: {} },
            data: [
              {
                slug: "css-display-flex",
                title: "display:flex",
                url: "https://www.caniemail.com/features/css-display-flex/",
                last_test_date: "2026-10-01",
                notes_by_num: {},
                stats: {},
              },
            ],
          }),
      }));
    vi.stubGlobal("fetch", respond(CANIEMAIL_SOURCE.lastUpdateDate));
    expect(await caniemailReport()).toBe("");

    vi.stubGlobal("fetch", respond("2099-01-01 00:00:00 +0000"));
    const report = await caniemailReport();
    expect(report).toContain("- `css-display-grid`: not in the upstream data.");
    expect(report).toContain(
      '- `css-display-flex` #2: "`display:inline-flex` is not supported." → removed',
    );
  });

  it("fails when caniemail doesn't answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    await expect(caniemailReport()).rejects.toThrow("caniemail HTTP 503");
  });
});
