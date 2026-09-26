import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

// A "wrap the email in a card / view in browser / imprint" request during
// authoring is init({ layout }), and the live page cannot show it. The rule
// has to sit on the playbooks that session actually opens — integrate.md
// already says this, and an authoring session does not load that page.
describe("a shell around the email stays out of the campaign and out of the repo", () => {
  it("states the rule where build and edit look", () => {
    const rules = read("../reference/rules.md");
    expect(rules).toContain("init({ layout })");
    expect(rules).toContain("this live preview will not show it");
    expect(rules).toContain("Do not edit the CLI, the live harness, or the docs");
    expect(read("../reference/build.md")).toContain("shell rule in [rules.md](rules.md)");
    expect(read("../reference/edit.md")).toContain("not an edit of the template");
  });

  it("tells a live session the open editor will not render the shell", () => {
    const live = read("../reference/live.md");
    expect(live).toContain("## A shell around the email");
    expect(live).toContain("The open editor will not show the shell");
    expect(live).toContain("Do not\nedit the CLI, the live harness, or the docs");
  });
});
