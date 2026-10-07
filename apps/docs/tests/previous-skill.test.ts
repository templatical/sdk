import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The retired `templatical-email` skill. Search results and AI answers still
 * surface its install commands, which no longer work, so each locale of the
 * Agent Skill page quotes them verbatim, says they are dead in the sentence
 * that introduces them (a tool that lifts the fence keeps the verdict), and
 * gives the current command. Installing `templatical` leaves a
 * `templatical-email` copy in place, and two installed skills with
 * overlapping triggers let an agent load the stale one, so the page also has
 * the reader remove the old copy, by install route, before it installs. The
 * old page told readers to copy or symlink the folder into any of several
 * skills directories, so the copy route names each of them. The README links
 * that section by its explicit `{#previous-skill}` id, the same in every
 * locale, so the link cannot drift with a translated heading.
 */

const REPO = join(import.meta.dirname, "../../..");
const read = (rel: string) => readFileSync(join(REPO, rel), "utf8");

const ANCHOR = "previous-skill";
const OLD_COMMANDS = [
  "/plugin marketplace add templatical/sdk",
  "/plugin install templatical-email@templatical",
  "cp -r skills/templatical-email ~/.agents/skills/",
  "npx claudepluginhub templatical/sdk --plugin templatical-email",
];
const CURRENT_COMMAND = "npx skills add templatical/sdk";
// `npx skills add` leaves the old copy installed, so the page tells the reader
// to remove it first, by the route it came in through. The plugin pair is one
// fence; the copied folder is its own.
const PLUGIN_REMOVAL = [
  "/plugin uninstall templatical-email@templatical",
  "/plugin marketplace remove templatical",
];
const COPY_REMOVAL = ["rm -rf ~/.agents/skills/templatical-email"];
// The directories a reader could have copied or symlinked the folder into.
// `rm -rf` is shown once, for the first; the lead-in names the rest.
const SKILLS_DIRECTORIES = [
  "~/.agents/skills/",
  "~/.claude/skills/",
  "~/.cursor/skills/",
  "~/.gemini/skills/",
];

/** A fence's opening or closing line, indented when it sits in a list item. */
const FENCE = /^(\s*)```(.*)$/;

interface Section {
  /** The heading text after `## `, including any trailing `{#id}`. */
  heading: string;
  /** Every line up to the next second-level heading. */
  lines: string[];
}

interface Fence {
  info: string;
  body: string;
  /** Index, in the section's lines, of the line that opens the fence. */
  start: number;
}

/** Second-level sections, ignoring any `## ` line inside a code fence. */
function sectionsOf(src: string): Section[] {
  const sections: Section[] = [];
  let fenced = false;
  for (const line of src.split("\n")) {
    if (FENCE.test(line)) fenced = !fenced;
    const heading = fenced ? null : /^## (.*)$/.exec(line);
    if (heading) {
      sections.push({ heading: heading[1], lines: [] });
      continue;
    }
    sections.at(-1)?.lines.push(line);
  }
  return sections;
}

/** Fenced blocks in order, each body with its fence's indentation removed. */
function fencesOf(lines: string[]): Fence[] {
  const fences: Fence[] = [];
  let open: {
    info: string;
    indent: string;
    body: string[];
    start: number;
  } | null = null;
  for (const [index, line] of lines.entries()) {
    const fence = FENCE.exec(line);
    if (fence && open === null) {
      open = {
        info: fence[2].trim(),
        indent: fence[1],
        body: [],
        start: index,
      };
    } else if (fence && open !== null) {
      fences.push({
        info: open.info,
        body: open.body.join("\n"),
        start: open.start,
      });
      open = null;
    } else if (open !== null) {
      open.body.push(
        line.startsWith(open.indent) ? line.slice(open.indent.length) : line,
      );
    }
  }
  return fences;
}

/** The section's lines with every fenced block removed. */
function proseOf(lines: string[]): string {
  let fenced = false;
  return lines
    .filter((line) => {
      if (FENCE.test(line)) {
        fenced = !fenced;
        return false;
      }
      return !fenced;
    })
    .join("\n");
}

/** The nearest non-blank line above a fence: the sentence that introduces it. */
function leadInOf(lines: string[], fence: Fence): string {
  for (let index = fence.start - 1; index >= 0; index--) {
    if (lines[index].trim() !== "") return lines[index];
  }
  return "";
}

const withoutId = (heading: string) => heading.replace(/ \{#[\w-]+\}$/, "");

/** The section whose heading carries the `{#previous-skill}` id. */
function previousSkillOf(sections: Section[], path: string): Section {
  const found = sections.find((section) =>
    section.heading.endsWith(` {#${ANCHOR}}`),
  );
  if (!found) {
    throw new Error(`${path} has no ## heading carrying {#${ANCHOR}}`);
  }
  return found;
}

const PAGES = [
  {
    locale: "English",
    path: "apps/docs/guide/agent-skill.md",
    install: "Install",
    capabilities: "Capabilities",
    noLongerWork: /no longer work/,
  },
  {
    locale: "German",
    path: "apps/docs/de/guide/agent-skill.md",
    install: "Installation",
    capabilities: "Fähigkeiten",
    noLongerWork: /funktionieren nicht mehr/,
  },
];

describe.each(PAGES)("$locale Agent Skill page", (page) => {
  const sections = sectionsOf(read(page.path));

  const previousSkill = () => previousSkillOf(sections, page.path);

  it("puts the {#previous-skill} id on a heading that names the skill", () => {
    expect(previousSkill().heading).toContain("`templatical-email`");
  });

  it("sits directly between Install and Capabilities", () => {
    const headings = sections.map((section) => withoutId(section.heading));
    const install = headings.indexOf(page.install);
    expect(install).toBeGreaterThanOrEqual(0);
    expect(headings.slice(install, install + 3)).toEqual([
      page.install,
      withoutId(previousSkill().heading),
      page.capabilities,
    ]);
  });

  it("quotes the old install commands verbatim in one fenced block", () => {
    const quoting = fencesOf(previousSkill().lines).filter((fence) =>
      OLD_COMMANDS.some((command) => fence.body.includes(command)),
    );
    expect(quoting).toHaveLength(1);
    expect(quoting[0].body.split("\n")).toEqual(OLD_COMMANDS);
  });

  it("says the commands no longer work, and names the new skill and its install command", () => {
    const prose = proseOf(previousSkill().lines);
    expect(prose).toMatch(page.noLongerWork);
    expect(prose).toContain("`templatical`");
    expect(prose).toContain(`\`${CURRENT_COMMAND}\``);
  });

  it("puts the verdict in the sentence that introduces the old commands, so a tool that lifts the fence keeps it", () => {
    const { lines } = previousSkill();
    const quoting = fencesOf(lines).find((fence) =>
      OLD_COMMANDS.every((command) => fence.body.includes(command)),
    );
    if (!quoting)
      throw new Error(`${page.path} has no fence quoting the old commands`);
    expect(leadInOf(lines, quoting)).toMatch(page.noLongerWork);
  });

  it("tells a reader who copied or symlinked the folder to delete it from every skills directory", () => {
    const prose = proseOf(previousSkill().lines);
    for (const directory of SKILLS_DIRECTORIES) {
      expect(prose, directory).toContain(directory);
    }
    expect(prose).toMatch(/symlink/i);
  });

  it("gives the removal commands verbatim: the plugin pair in one fence, the copied folder in its own", () => {
    const fences = fencesOf(previousSkill().lines).map((fence) =>
      fence.body.split("\n"),
    );
    expect(fences).toContainEqual(PLUGIN_REMOVAL);
    expect(fences).toContainEqual(COPY_REMOVAL);
  });

  it("removes the old copy before it installs the renamed skill", () => {
    const bodies = fencesOf(previousSkill().lines).map((fence) => fence.body);
    const position = (commands: string[]) =>
      bodies.indexOf(commands.join("\n"));
    expect(position(PLUGIN_REMOVAL)).toBeGreaterThanOrEqual(0);
    expect(position(COPY_REMOVAL)).toBeGreaterThanOrEqual(0);
    expect(position([CURRENT_COMMAND])).toBeGreaterThan(
      position(PLUGIN_REMOVAL),
    );
    expect(position([CURRENT_COMMAND])).toBeGreaterThan(position(COPY_REMOVAL));
  });

  it("gives the current command in the fence style the Install section uses", () => {
    const install = sections.find(
      (section) => section.heading === page.install,
    );
    const inInstall = fencesOf(install?.lines ?? []).find(
      (fence) => fence.body === CURRENT_COMMAND,
    );
    const inSection = fencesOf(previousSkill().lines).find(
      (fence) => fence.body === CURRENT_COMMAND,
    );
    expect(inInstall?.info).toBe("bash");
    expect(inSection?.info).toBe("bash");
  });
});

describe("the agent corpus", () => {
  it("carries the section, so an agent that fetches llms-full.txt meets the deprecation", () => {
    const english = PAGES[0].path;
    const heading = previousSkillOf(sectionsOf(read(english)), english).heading;
    const corpus = read("apps/docs/public/llms-full.txt");
    expect(corpus).toContain(`## ${heading}`);
    expect(corpus).toContain(OLD_COMMANDS.join("\n"));
    // Indented inside list items, so each removal command is checked on its own.
    for (const command of [...PLUGIN_REMOVAL, ...COPY_REMOVAL]) {
      expect(corpus, command).toContain(command);
    }
  });
});

describe("README", () => {
  it("links the previous-skill section once, from a line that names the old skill", () => {
    const link = `https://docs.templatical.com/guide/agent-skill#${ANCHOR}`;
    const lines = read("README.md")
      .split("\n")
      .filter((line) => line.includes(link));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("`templatical-email`");
  });
});
