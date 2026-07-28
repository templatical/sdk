import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error -- plain .mjs generator, no type declarations
import {
  aggregate,
  buildOutputs,
  compareVersionsDesc,
  demoteHeadings,
  parsePackageChangelog,
  renderMarkdown,
  renderReleaseNotes,
  renderVersionBody,
  resolveDates,
  REPO_ROOT,
} from "../scripts/build-changelog.mjs";

/** Builds a changelog body the way changesets writes one. */
function changelog(name: string, body: string): string {
  return `# ${name}\n\n${body}\n`;
}

describe("parsePackageChangelog", () => {
  it("reads the package name from the title heading", () => {
    const { pkgName } = parsePackageChangelog(
      changelog("@templatical/editor", "## 1.0.0"),
      "fallback",
    );
    expect(pkgName).toBe("@templatical/editor");
  });

  it("falls back to the supplied name when there is no title heading", () => {
    const { pkgName } = parsePackageChangelog("## 1.0.0\n", "@templatical/core");
    expect(pkgName).toBe("@templatical/core");
  });

  it("captures a hash entry with its level and title", () => {
    const { versions } = parsePackageChangelog(
      changelog("@templatical/core", "## 1.2.0\n\n### Minor Changes\n\n- abc1234: Add a thing."),
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe("1.2.0");
    expect(versions[0].entries).toHaveLength(1);
    expect(versions[0].entries[0].hash).toBe("abc1234");
    expect(versions[0].entries[0].level).toBe("minor");
    expect(versions[0].entries[0].lines).toEqual(["Add a thing."]);
  });

  it("records Major, Minor and Patch sections as their own levels", () => {
    const { versions } = parsePackageChangelog(
      changelog(
        "@templatical/core",
        [
          "## 2.0.0",
          "",
          "### Major Changes",
          "",
          "- aaaaaaa: Break it.",
          "",
          "### Minor Changes",
          "",
          "- bbbbbbb: Extend it.",
          "",
          "### Patch Changes",
          "",
          "- ccccccc: Fix it.",
        ].join("\n"),
      ),
    );
    expect(versions[0].entries.map((e: { level: string }) => e.level)).toEqual([
      "major",
      "minor",
      "patch",
    ]);
  });

  it("drops Updated dependencies blocks together with their indented children", () => {
    const { versions } = parsePackageChangelog(
      changelog(
        "@templatical/quality",
        [
          "## 1.0.0",
          "",
          "### Patch Changes",
          "",
          "- Updated dependencies [abc1234]",
          "  - @templatical/types@1.0.0",
        ].join("\n"),
      ),
    );
    expect(versions[0].entries).toEqual([]);
  });

  it("drops bare package stubs at column zero", () => {
    const { versions } = parsePackageChangelog(
      changelog(
        "@templatical/editor",
        [
          "## 1.0.0",
          "",
          "### Patch Changes",
          "",
          "- @templatical/renderer@1.0.0",
          "- @templatical/quality@1.0.0",
        ].join("\n"),
      ),
    );
    expect(versions[0].entries).toEqual([]);
  });

  // Regression: changesets also nests a bare stub *under* a real entry with no
  // `Updated dependencies` parent. Treated as a continuation line it leaked the
  // stub into the rendered body (83 occurrences across the real changelogs).
  it("drops an indented bare stub that follows a real entry", () => {
    const { versions } = parsePackageChangelog(
      changelog(
        "@templatical/core",
        [
          "## 0.0.2",
          "",
          "### Patch Changes",
          "",
          "- c1de323: Include the CDN build.",
          "  - @templatical/types@0.0.2",
        ].join("\n"),
      ),
    );
    expect(versions[0].entries).toHaveLength(1);
    expect(versions[0].entries[0].lines.join("\n").trim()).toBe("Include the CDN build.");
  });

  it("keeps an indented heading inside a body as body content, not a version header", () => {
    const { versions } = parsePackageChangelog(
      changelog(
        "@templatical/renderer",
        [
          "## 0.9.0",
          "",
          "### Minor Changes",
          "",
          "- abc1234: Two things changed.",
          "",
          "  ## MJML background colors",
          "",
          "  Inner elements only support container-background-color.",
        ].join("\n"),
      ),
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].entries[0].lines).toEqual([
      "Two things changed.",
      "",
      "## MJML background colors",
      "",
      "Inner elements only support container-background-color.",
    ]);
  });

  it("dedents body lines by exactly two spaces, preserving deeper nesting", () => {
    const { versions } = parsePackageChangelog(
      changelog(
        "@templatical/core",
        [
          "## 1.0.0",
          "",
          "### Minor Changes",
          "",
          "- abc1234: Nested list.",
          "",
          "  - top level item",
          "    - nested item",
        ].join("\n"),
      ),
    );
    expect(versions[0].entries[0].lines).toEqual([
      "Nested list.",
      "",
      "- top level item",
      "  - nested item",
    ]);
  });

  it("keeps a version with no sections as an empty entry list", () => {
    const { versions } = parsePackageChangelog(
      changelog("@templatical/types", "## 0.1.2\n\n## 0.1.1"),
    );
    expect(versions.map((v: { version: string }) => v.version)).toEqual(["0.1.2", "0.1.1"]);
    expect(versions[0].entries).toEqual([]);
    expect(versions[1].entries).toEqual([]);
  });

  it("ignores a hash entry that appears before any section header", () => {
    const { versions } = parsePackageChangelog(
      changelog("@templatical/core", "## 1.0.0\n\n- abc1234: Orphaned."),
    );
    expect(versions[0].entries).toEqual([]);
  });
});

describe("aggregate", () => {
  const entry = (hash: string, level: string, lines: string[]) => ({ hash, level, lines });

  it("dedupes one hash across packages and unions their names", () => {
    const result = aggregate([
      {
        pkgName: "@templatical/editor",
        versions: [{ version: "1.0.0", entries: [entry("abc1234", "minor", ["Shared change."])] }],
      },
      {
        pkgName: "@templatical/types",
        versions: [{ version: "1.0.0", entries: [entry("abc1234", "minor", ["Shared change."])] }],
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].changes).toHaveLength(1);
    expect(result[0].changes[0].packages).toEqual([
      "@templatical/editor",
      "@templatical/types",
    ]);
  });

  it("escalates to the highest level when packages bump differently", () => {
    const result = aggregate([
      {
        pkgName: "@templatical/core",
        versions: [{ version: "1.0.0", entries: [entry("abc1234", "patch", ["Change."])] }],
      },
      {
        pkgName: "@templatical/editor",
        versions: [{ version: "1.0.0", entries: [entry("abc1234", "minor", ["Change."])] }],
      },
    ]);
    expect(result[0].changes[0].level).toBe("minor");
  });

  it("splits the first line into the title and keeps the rest as the body", () => {
    const result = aggregate([
      {
        pkgName: "@templatical/core",
        versions: [
          {
            version: "1.0.0",
            entries: [entry("abc1234", "minor", ["Short summary.", "", "Longer detail here."])],
          },
        ],
      },
    ]);
    expect(result[0].changes[0].title).toBe("Short summary.");
    expect(result[0].changes[0].body).toBe("Longer detail here.");
  });

  it("orders versions newest first", () => {
    const result = aggregate([
      {
        pkgName: "@templatical/core",
        versions: [
          { version: "0.9.0", entries: [] },
          { version: "0.10.0", entries: [] },
          { version: "0.9.1", entries: [] },
        ],
      },
    ]);
    expect(result.map((v: { version: string }) => v.version)).toEqual(["0.10.0", "0.9.1", "0.9.0"]);
  });

  it("orders changes by level then hash so reruns are stable", () => {
    const result = aggregate([
      {
        pkgName: "@templatical/core",
        versions: [
          {
            version: "1.0.0",
            entries: [
              entry("ddddddd", "patch", ["Patch d."]),
              entry("bbbbbbb", "major", ["Major b."]),
              entry("aaaaaaa", "patch", ["Patch a."]),
              entry("ccccccc", "minor", ["Minor c."]),
            ],
          },
        ],
      },
    ]);
    expect(result[0].changes.map((c: { hash: string }) => c.hash)).toEqual([
      "bbbbbbb",
      "ccccccc",
      "aaaaaaa",
      "ddddddd",
    ]);
  });

  it("returns a version with no changes rather than dropping it", () => {
    const result = aggregate([
      { pkgName: "@templatical/core", versions: [{ version: "0.1.2", entries: [] }] },
    ]);
    expect(result).toEqual([{ version: "0.1.2", changes: [] }]);
  });
});

describe("compareVersionsDesc", () => {
  it("sorts descending across major, minor and patch", () => {
    expect(["1.0.0", "2.0.0", "1.2.0", "1.0.3"].sort(compareVersionsDesc)).toEqual([
      "2.0.0",
      "1.2.0",
      "1.0.3",
      "1.0.0",
    ]);
  });

  it("compares numerically, not lexically", () => {
    expect(["0.9.0", "0.10.0", "0.20.0"].sort(compareVersionsDesc)).toEqual([
      "0.20.0",
      "0.10.0",
      "0.9.0",
    ]);
  });

  it("sorts a prerelease below its release", () => {
    expect(["1.0.0-beta.1", "1.0.0"].sort(compareVersionsDesc)).toEqual(["1.0.0", "1.0.0-beta.1"]);
  });

  it("returns 0 for identical versions", () => {
    expect(compareVersionsDesc("1.2.3", "1.2.3")).toBe(0);
  });
});

describe("demoteHeadings", () => {
  it("pushes an h2 down to h4 so it cannot read as a version header", () => {
    expect(demoteHeadings("## Inner section")).toBe("#### Inner section");
  });

  it("keeps relative depth between inner headings", () => {
    expect(demoteHeadings("## Outer\n\n### Inner")).toBe("#### Outer\n\n##### Inner");
  });

  it("caps at h6 rather than emitting seven hashes", () => {
    expect(demoteHeadings("##### Deep")).toBe("###### Deep");
  });

  it("leaves headings inside fenced code untouched", () => {
    const input = ["```md", "## Not a heading", "```", "## Real heading"].join("\n");
    expect(demoteHeadings(input)).toBe(
      ["```md", "## Not a heading", "```", "#### Real heading"].join("\n"),
    );
  });

  it("leaves non-heading lines alone", () => {
    expect(demoteHeadings("Plain text with # hash inside")).toBe("Plain text with # hash inside");
  });
});

describe("resolveDates", () => {
  const base = { tagDates: new Map(), recordedDates: new Map(), today: "2026-07-28" };

  it("prefers a tag date over a recorded one so a stamped date self-corrects", () => {
    const dates = resolveDates(["1.0.0"], {
      ...base,
      tagDates: new Map([["1.0.0", "2026-07-26"]]),
      recordedDates: new Map([["1.0.0", "2026-07-25"]]),
    });
    expect(dates.get("1.0.0")).toBe("2026-07-26");
  });

  it("uses the recorded date when tags are unavailable", () => {
    const dates = resolveDates(["1.0.0"], {
      ...base,
      recordedDates: new Map([["1.0.0", "2026-07-25"]]),
    });
    expect(dates.get("1.0.0")).toBe("2026-07-25");
  });

  it("stamps today on the newest version only", () => {
    const dates = resolveDates(["2.0.0", "1.0.0"], base);
    expect(dates.get("2.0.0")).toBe("2026-07-28");
    expect(dates.has("1.0.0")).toBe(false);
  });

  it("leaves an untagged historical version undated rather than fabricating one", () => {
    const dates = resolveDates(["2.0.0", "1.0.0", "0.0.2"], {
      ...base,
      tagDates: new Map([["2.0.0", "2026-07-26"]]),
    });
    expect(dates.get("2.0.0")).toBe("2026-07-26");
    expect(dates.has("1.0.0")).toBe(false);
    expect(dates.has("0.0.2")).toBe(false);
  });
});

describe("renderVersionBody", () => {
  const change = (level: string, title: string, body = "") => ({
    hash: "abc1234",
    level,
    title,
    body,
    packages: ["@templatical/core"],
  });

  it("labels each level and lists the attributed packages", () => {
    const out = renderVersionBody({
      version: "1.0.0",
      changes: [change("major", "Broke it"), change("minor", "Added it"), change("patch", "Fixed it")],
    });
    expect(out).toContain("### Breaking changes");
    expect(out).toContain("### Features");
    expect(out).toContain("### Fixes and improvements");
    expect(out).toContain("**Broke it**");
    expect(out).toContain("`@templatical/core`");
  });

  it("omits sections that have no changes", () => {
    const out = renderVersionBody({ version: "1.0.0", changes: [change("patch", "Fixed it")] });
    expect(out).not.toContain("### Breaking changes");
    expect(out).not.toContain("### Features");
    expect(out).toContain("### Fixes and improvements");
  });

  it("explains a version that carries no user-facing changes", () => {
    const out = renderVersionBody({ version: "0.1.2", changes: [] });
    expect(out).toBe("_No user-facing changes — released to keep the suite in step._");
  });

  it("joins multiple packages with a separator", () => {
    const out = renderVersionBody({
      version: "1.0.0",
      changes: [
        { ...change("minor", "Shared"), packages: ["@templatical/core", "@templatical/editor"] },
      ],
    });
    expect(out).toContain("`@templatical/core` · `@templatical/editor`");
  });

  // The page wraps every entry in `::: v-pre`; a line-initial `:::` in a body would
  // close it early and fail the docs build with a stack trace pointing at compiled
  // output rather than at the changeset responsible.
  it("throws naming the changeset when a body line would close the v-pre container", () => {
    expect(() =>
      renderVersionBody({
        version: "1.0.0",
        changes: [{ ...change("minor", "Documented a container"), body: "::: tip\nHello\n:::" }],
      }),
    ).toThrow(/abc1234 has a line starting with ':::'/);
  });

  it("allows ':::' that is not at the start of a line", () => {
    const out = renderVersionBody({
      version: "1.0.0",
      changes: [{ ...change("minor", "Inline colons"), body: "Use a ::: marker inline." }],
    });
    expect(out).toContain("Use a ::: marker inline.");
  });
});

describe("renderMarkdown", () => {
  const versions = [{ version: "1.0.0", changes: [] }];

  it("emits frontmatter that limits the outline to version headings", () => {
    const out = renderMarkdown(versions, new Map());
    expect(out).toContain("outline: [2, 2]");
    expect(out).toContain("title: Changelog");
  });

  it("renders a date element when the version has one", () => {
    const out = renderMarkdown(versions, new Map([["1.0.0", "2026-07-26"]]));
    expect(out).toContain('<time datetime="2026-07-26">2026-07-26</time>');
  });

  it("omits the date element entirely when the version has none", () => {
    expect(renderMarkdown(versions, new Map())).not.toContain("<time");
  });

  it("ends with exactly one trailing newline", () => {
    const out = renderMarkdown(versions, new Map());
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  // Without this, merge-tag syntax quoted in entry prose is compiled as a Vue
  // interpolation and the docs build fails. Vue interpolates inside `<code>` too,
  // so escaping the braces is not an alternative.
  it("wraps the version list in a v-pre container", () => {
    const out = renderMarkdown(versions, new Map());
    expect(out).toContain("::: v-pre");
    expect(out.trimEnd().endsWith(":::")).toBe(true);
  });

  it("opens the container after the intro so intro links stay outside it", () => {
    const out = renderMarkdown(versions, new Map());
    expect(out.indexOf("[Installation]")).toBeLessThan(out.indexOf("::: v-pre"));
  });
});

describe("renderReleaseNotes", () => {
  const versions = [
    {
      version: "1.0.0",
      changes: [
        {
          hash: "abc1234",
          level: "minor",
          title: "Added it",
          body: "",
          packages: ["@templatical/core"],
        },
      ],
    },
  ];

  it("renders the version body followed by the footer", () => {
    const out = renderReleaseNotes(versions, "1.0.0", new Array(9).fill("pkg"));
    expect(out).toContain("### Features");
    expect(out).toContain("**Added it**");
    expect(out).toContain("All 9 `@templatical/*` packages are published at `1.0.0`");
    expect(out).toContain("https://docs.templatical.com/changelog");
  });

  it("does not repeat the version as a heading — the release title carries it", () => {
    expect(renderReleaseNotes(versions, "1.0.0", [])).not.toContain("## 1.0.0");
  });

  it("throws naming the version when it is not in the changelog", () => {
    expect(() => renderReleaseNotes(versions, "9.9.9", [])).toThrow(
      "No changelog entries found for version 9.9.9",
    );
  });
});

// Freshness guard, mirroring the schema-freshness test in skills/templatical-email:
// regenerate in memory and require it to equal what is committed, so a block-model
// change or a hand-edit can never ship a stale page.
describe("committed output is up to date", () => {
  const today = new Date().toISOString().slice(0, 10);
  const built = buildOutputs({ today });

  it("matches apps/docs/changelog.md", () => {
    const onDisk = readFileSync(join(REPO_ROOT, "apps", "docs", "changelog.md"), "utf8");
    expect(onDisk).toBe(built.markdown);
  });

  it("matches apps/docs/public/changelog.json", () => {
    const onDisk = readFileSync(
      join(REPO_ROOT, "apps", "docs", "public", "changelog.json"),
      "utf8",
    );
    expect(onDisk).toBe(built.json);
  });

  it("aggregates all nine packages", () => {
    expect(built.packages).toHaveLength(9);
    expect(built.packages).toContain("@templatical/editor");
    expect(built.packages).toContain("@templatical/types");
  });

  it("carries no dependency-bump stubs into the rendered page", () => {
    expect(built.markdown).not.toMatch(/^- @templatical\/[a-z-]+@\d/m);
    expect(built.markdown).not.toContain("Updated dependencies");
  });

  it("uses column-zero h2 headings only for versions", () => {
    const h2s = built.markdown.match(/^## .+$/gm) ?? [];
    expect(h2s).toHaveLength(built.versions.length);
    for (const heading of h2s) {
      expect(heading).toMatch(/^## \d+\.\d+\.\d+/);
    }
  });
});
