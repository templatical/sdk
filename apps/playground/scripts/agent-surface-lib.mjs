// Pure generator for playground llms.txt and per-scene markdown twins.
// Takes the scene list as an argument so Vitest can import this file
// without loading TypeScript scene modules.

export const SITE = "https://play.templatical.com";
export const DOCS_SITE = "https://docs.templatical.com";

const GROUP_HEADINGS = {
  minimum: "Minimum",
  storage: "Storage",
  author: "Author",
  render: "Render",
  import: "Import",
  examples: "Examples",
};

const GROUP_ORDER = [
  "minimum",
  "storage",
  "author",
  "render",
  "import",
  "examples",
];

function headingFor(group) {
  return (
    GROUP_HEADINGS[group] ?? group.charAt(0).toUpperCase() + group.slice(1)
  );
}

function orderedGroups(scenes) {
  const seen = [...new Set(scenes.map((scene) => scene.group))];
  const known = GROUP_ORDER.filter((group) => seen.includes(group));
  const rest = seen.filter((group) => !GROUP_ORDER.includes(group)).sort();
  return [...known, ...rest];
}

function renderIndex(scenes) {
  const lines = [
    "# Templatical Playground",
    "",
    "> Live init() setups for the Templatical email editor SDK.",
    "",
    "Each scene is also raw markdown: /scenes/<id>.md",
    "",
  ];
  for (const group of orderedGroups(scenes)) {
    lines.push(`## ${headingFor(group)}`, "");
    for (const scene of scenes.filter((s) => s.group === group)) {
      lines.push(
        `- [${scene.title}](${SITE}/scenes/${scene.id}): ${scene.summary}`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function renderPage(scene) {
  return `${[
    `# ${scene.title}`,
    "",
    scene.summary,
    "",
    `Contract: ${DOCS_SITE}${scene.docs}`,
    `Live: ${SITE}/scenes/${scene.id}`,
    "",
    "## Snippet",
    "",
    "```ts",
    scene.snippet,
    "```",
  ]
    .join("\n")
    .trimEnd()}\n`;
}

export function buildOutputs(scenes) {
  const pages = {};
  for (const scene of scenes) {
    pages[`scenes/${scene.id}.md`] = renderPage(scene);
  }
  return { index: renderIndex(scenes), pages };
}
