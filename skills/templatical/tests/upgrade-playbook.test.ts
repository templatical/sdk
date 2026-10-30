import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const md = read("reference/upgrade.md");
const { evals } = JSON.parse(read("evals/evals.json")) as {
  evals: { id: number; prompt: string; expected_output: string }[];
};

// The playbook's procedure is agent behaviour no CLI test can reach; these
// pin the sentences that carry it.
describe("upgrade playbook", () => {
  it("takes the target from llms-meta.json and the entries from changelog.json", () => {
    expect(md).toContain("https://docs.templatical.com/llms-meta.json");
    expect(md).toContain("`sdkVersion`");
    expect(md).toContain("https://docs.templatical.com/changelog.json");
  });

  it("checks the skill's own pin against the latest release before anything else", () => {
    const target = md.slice(md.indexOf("## 2. Target version"), md.indexOf("## 3."));
    expect(target).toContain("[cli.md](cli.md)");
    expect(target).toContain("npx skills update templatical");
  });

  it("prints the range after the installed version up to and including the target", () => {
    // Exclusive lower bound, inclusive upper bound: the installed release's
    // own entries are already in the app, and the target's are not.
    expect(md).toContain("cmp(v, from) <= 0 || cmp(v, to) > 0");
    expect(md).toContain("<installed> <target>");
  });

  it("names every changelog.json field the triage reads", () => {
    for (const field of ["version", "date", "changes[].level", "changes[].title", "changes[].body", "changes[].packages"]) {
      expect(md).toContain(`\`versions[].${field}\``);
    }
  });

  it("reads every entry, treating minor as the breaking channel before 1.0", () => {
    expect(md).toMatch(/`minor` is the breaking channel/);
    expect(md).toMatch(/Read every entry in range/);
    expect(md).toMatch(/never filters an entry out/);
  });

  it("keeps entries filed under a package the consumer doesn't list", () => {
    // The default-on deliverability lint is filed under @templatical/quality
    // alone, which reaches an app through the editor's optional dependency.
    expect(md).toMatch(/Don't skip an entry because its `packages`/);
    expect(md).toContain("init({ lint })");
  });

  it("pins source reads to the target's tag, never main", () => {
    expect(md).toContain("https://raw.githubusercontent.com/templatical/sdk/v<target>/<path>");
    expect(md).toMatch(/Never read `main`/);
  });

  it("proposes and waits before editing", () => {
    const proposal = md.slice(md.indexOf("## 5. Proposal"), md.indexOf("## 6."));
    expect(proposal).toMatch(/Before editing anything/);
    expect(proposal).toMatch(/wait for a go-ahead/);
  });

  it("restores a stored template with the runtime fallback, not a factory default", () => {
    const templates = md.slice(md.indexOf("## 6. Stored templates"), md.indexOf("## 7."));
    expect(templates).toContain("must have required property '<field>'");
    expect(templates).toMatch(/not a factory default/);
    expect(templates).toMatch(/in bulk needs their go-ahead/);
  });

  it("self-checks with the consumer's build and the pinned validator under the exit-code contract", () => {
    const check = md.slice(md.indexOf("## 7. Self-check"), md.indexOf("## 8."));
    expect(check).toMatch(/typecheck and their build/);
    expect(check).toMatch(/npx -y @templatical\/template-tools@\S+ validate <file> --json/);
    expect(check).toContain("[cli.md](cli.md)");
  });

  it.each([29, 30])("eval %i exercises the upgrade route", (id) => {
    const entry = evals.find((e) => e.id === id);
    expect(entry, `missing eval ${id}`).toBeDefined();
    expect(entry?.expected_output).toContain("upgrade.md");
    expect(entry?.expected_output).toContain("changelog.json");
    expect(entry?.expected_output).toMatch(/must not/i);
  });

  it("eval 29 names the lint config the default-on categories change", () => {
    const expected = evals.find((e) => e.id === 29)?.expected_output ?? "";
    expect(expected).toContain("`deliverability: false`");
    expect(expected).toContain("`compatibility: false`");
    expect(expected).toContain("`lint: { disabled: true }`");
  });

  it("eval 30 never says 'upgrade', so it tests the router's discrimination", () => {
    expect(evals.find((e) => e.id === 30)?.prompt).not.toMatch(/upgrade/i);
  });
});
