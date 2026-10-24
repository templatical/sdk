import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../.vitepress/config";

/**
 * OSS docs house style: voice, package-manager install snippets, renderer
 * wording, Cloud-vs-OSS attribution, preview URL, countdown.
 *
 * Skip: changelog (history), cloud/ (WIP), public/ (generated).
 */

const DOCS = join(import.meta.dirname, "..");
const REPO = join(DOCS, "../..");

const SKIP_DIRS = new Set([
  "cloud",
  "de/cloud",
  "public",
  "node_modules",
  ".vitepress",
  "tests",
  "scripts",
]);

const SKIP_FILES = new Set(["changelog.md", "de/changelog.md"]);

const ADVERBS = /\b(deliberately|genuinely|precisely|merely)\b/i;
const DERIVED_BLOCK_COUNT = /\ball\s+\d+\s+built-in block/i;
const RENDERER_AS_HTML = /JSON\s*→\s*MJML\s*→\s*HTML/;
const UNIVERSAL_EMAIL_CLIENTS = /\b(?:all email clients|every email client|allen E-Mail-Clients|alle E-Mail-Clients|jedem E-Mail-Client|jeder E-Mail-Client)\b/i;
const BANNED_HEADINGS = [
  "## What's actually happening here",
  "## Trying it out",
  "## Why MJML?",
  "## What the renderer does NOT do",
];

function walkMarkdown(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(DOCS, abs).split(sep).join("/");
    if (statSync(abs).isDirectory()) {
      const top = rel.split("/")[0];
      if (SKIP_DIRS.has(top) || SKIP_DIRS.has(rel)) continue;
      walkMarkdown(abs, acc);
      continue;
    }
    if (!rel.endsWith(".md")) continue;
    if (SKIP_FILES.has(rel)) continue;
    acc.push(rel);
  }
  return acc;
}

function readDocs(rel: string): string {
  return readFileSync(join(DOCS, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

/** ` ```bash ` fences whose body is a single `npm install …` line and whose
 *  info string is not `bash [npm]` (i.e. not inside the four-manager group). */
function bareNpmInstallFences(src: string): string[] {
  const hits: string[] = [];
  const re = /```bash(?<info>[^\n]*)\n(?<body>[\s\S]*?)```/g;
  for (const m of src.matchAll(re)) {
    const info = (m.groups?.info ?? "").trim();
    const body = (m.groups?.body ?? "").trim();
    if (!/^npm install /.test(body)) continue;
    if (body.includes("\n")) continue;
    if (info.startsWith("[npm]")) continue;
    hits.push(body);
  }
  return hits;
}

describe("OSS docs house style", () => {
  const pages = walkMarkdown(DOCS);

  it("walks a non-empty OSS markdown set", () => {
    expect(pages.length).toBeGreaterThan(20);
    expect(pages.some((p) => p.startsWith("cloud/"))).toBe(false);
    expect(pages).not.toContain("changelog.md");
  });

  it("has no editorial adverbs outside changelog and Cloud", () => {
    const hits: string[] = [];
    for (const rel of pages) {
      const src = readDocs(rel);
      for (const [i, line] of src.split("\n").entries()) {
        if (ADVERBS.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("does not encode a derived built-in block count", () => {
    const hits: string[] = [];
    for (const rel of pages) {
      if (DERIVED_BLOCK_COUNT.test(readDocs(rel))) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });

  it("does not promise universal email-client support", () => {
    const hits = pages.filter((rel) => UNIVERSAL_EMAIL_CLIENTS.test(readDocs(rel)));
    expect(hits).toEqual([]);
  });

  it("does not use the banned claim headings", () => {
    const hits: string[] = [];
    for (const rel of pages) {
      const src = readDocs(rel);
      for (const heading of BANNED_HEADINGS) {
        if (src.split("\n").includes(heading)) hits.push(`${rel}: ${heading}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("does not document npm-only install fences", () => {
    const hits: string[] = [];
    for (const rel of pages) {
      for (const body of bareNpmInstallFences(readDocs(rel))) {
        hits.push(`${rel}: ${body}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("does not describe the renderer as JSON → MJML → HTML", () => {
    const files = [
      "README.md",
      "apps/docs/showcase.md",
      "apps/docs/guide/agent-skill.md",
    ];
    const hits: string[] = [];
    for (const rel of files) {
      const src = rel.startsWith("apps/") ? readDocs(rel.slice("apps/docs/".length)) : readRepo(rel);
      if (RENDERER_AS_HTML.test(src)) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });

  it("does not list comments or saved blocks as Cloud additions in the license FAQ", () => {
    const src = readDocs("license-faq.md");
    expect(src).not.toMatch(
      /adds AI rewrite, real-time collaboration, comments/i,
    );
    expect(src).toMatch(/Cloud is one adapter, not the feature/);
  });

  it("keeps the editor screenshot as a single marketing URL with no-referrer", () => {
    const hero = readFileSync(
      join(DOCS, ".vitepress/theme/HeroPreview.vue"),
      "utf8",
    );
    expect(hero).toContain('SRC = "https://templatical.com/preview.png"');
    expect(hero).toContain('referrerpolicy="no-referrer"');
    expect(readRepo("README.md")).toContain(
      "https://templatical.com/preview.png",
    );
    expect(readDocs("index.md")).not.toContain("preview.png");
    expect(readDocs("de/index.md")).not.toContain("preview.png");
  });

  it("tells the agent skill never to emit countdown or custom", () => {
    const src = readDocs("guide/agent-skill.md");
    expect(src).toMatch(/Never emit `countdown`/);
    expect(src).toMatch(/Never emit `custom`/);
    expect(readDocs("guide/migration-from-unlayer.md")).not.toMatch(
      /Recreate using Templatical's `CountdownBlock`/,
    );
  });

  it("does not put Cloud comments in the README docs list", () => {
    expect(readRepo("README.md")).not.toMatch(
      /Cloud \(AI, Collab, Comments\)/,
    );
  });

  it("sends Guide and Get Started to Quick Start", () => {
    const src = readFileSync(join(DOCS, ".vitepress/config.ts"), "utf8");
    expect(src).toMatch(
      /\{ text: "Guide", link: "\/getting-started\/quick-start" \}/,
    );
    expect(readDocs("index.md")).toMatch(
      /link: \/getting-started\/quick-start/,
    );
  });

  it("does not link OSS pages into /cloud/", () => {
    const hits: string[] = [];
    const banned = /\]\(\/(?:de\/)?cloud\/|docs\.templatical\.com\/(?:de\/)?cloud/;
    for (const rel of pages) {
      for (const [i, line] of readDocs(rel).split("\n").entries()) {
        if (banned.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    }
    for (const rel of [
      "README.md",
      "packages/editor/README.md",
      "packages/core/README.md",
      "packages/media-library/README.md",
    ]) {
      for (const [i, line] of readRepo(rel).split("\n").entries()) {
        if (banned.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("keeps Cloud out of nav, sidebar, robots, and the sitemap", () => {
    const robots = readDocs("public/robots.txt");
    expect(robots).toMatch(/^Disallow: \/cloud\/$/m);
    expect(robots).toMatch(/^Disallow: \/de\/cloud\/$/m);

    const transform = config.sitemap?.transformItems;
    expect(typeof transform).toBe("function");
    // VitePress passes relative URLs here (generateSitemap: the page path with
    // `.md` dropped and `index.md` reduced to its directory), never absolute
    // ones, so the fixture must use that shape or the filter goes untested.
    expect(
      transform!([
        { url: "guide/theming" },
        { url: "cloud/ai" },
        { url: "cloud/" },
        { url: "de/cloud/ai" },
        { url: "de/guide/theming" },
        { url: "" },
      ]),
    ).toEqual([{ url: "guide/theming" }, { url: "de/guide/theming" }, { url: "" }]);

    const src = readFileSync(join(DOCS, ".vitepress/config.ts"), "utf8");
    expect(src).not.toMatch(/link:\s*"\/(?:de\/)?cloud/);
  });

  it("does not put token-count or pluggable-syntax jargon on the home cards", () => {
    expect(readDocs("index.md")).not.toMatch(/27 OKLch/i);
    expect(readDocs("de/index.md")).not.toMatch(/27 OKLch/i);
    expect(readDocs("index.md")).not.toMatch(/pluggable syntax/i);
    expect(readDocs("de/index.md")).not.toMatch(/pluggable Syntax/i);
  });

  it("Quick Start mounts from the CDN, not a bare package import", () => {
    for (const rel of [
      "getting-started/quick-start.md",
      "de/getting-started/quick-start.md",
    ]) {
      const src = readDocs(rel);
      expect(src, rel).not.toMatch(/from ['"]@templatical\/editor['"]/);
      expect(src, rel).toMatch(
        /unpkg\.com\/@templatical\/editor\/dist\/cdn\/editor\.js/,
      );
    }
  });

  it("Quick Start extracts JSON and MJML from the mounted editor", () => {
    for (const rel of [
      "getting-started/quick-start.md",
      "de/getting-started/quick-start.md",
    ]) {
      const src = readDocs(rel);
      expect(src, rel).toMatch(/editor\.getContent\(\)/);
      expect(src, rel).toMatch(/await editor\.toMjml\(\)/);
    }
  });

  it("does not put token-count, pluggable-syntax, or a block count in the README", () => {
    const src = readRepo("README.md");
    expect(src).not.toMatch(/27 OKLch/i);
    expect(src).not.toMatch(/pluggable syntax/i);
    expect(src).not.toMatch(/all 14 block types/i);
    expect(src).not.toMatch(/\*\*14 block types\*\*/);
    expect(src).not.toMatch(/Cloud tier \(below\)/);
  });

  it("does not put a design-token count in either README", () => {
    // The count goes stale whenever a hook is added or removed, and the
    // theming guide's table is the list that is kept accurate.
    for (const rel of ["README.md", "packages/editor/README.md"]) {
      expect(readRepo(rel)).not.toMatch(/\b\d+ design tokens\b/i);
    }
  });

  it("points the editor README saved-blocks link at the backend page", () => {
    const src = readRepo("packages/editor/README.md");
    expect(src).toMatch(
      /docs\.templatical\.com\/backend\/saved-blocks/,
    );
    expect(src).not.toMatch(
      /docs\.templatical\.com\/guide\/saved-blocks/,
    );
  });
});

describe("collaboration transport examples", () => {
  const surfaces = [
    ["backend/collaboration.md", readDocs("backend/collaboration.md")],
    ["de/backend/collaboration.md", readDocs("de/backend/collaboration.md")],
    [
      "scene markdown",
      readRepo("apps/playground/public/scenes/collaboration.md"),
    ],
    [
      "displayed scene",
      readRepo("apps/playground/src/scenes/storage/collaboration.ts"),
    ],
  ].map(([name, src]) => [name, src.replaceAll("'", '\"')] as const);

  it.each(surfaces)("%s captures the joined session id", (_name, src) => {
    expect(src.includes('let sessionId = "";')).toBe(true);
    expect(src.includes("sessionId = session.sessionId;")).toBe(true);
  });

  for (const method of [
    "submit",
    "operationsAfter",
    "acquireLock",
    "renewLock",
    "releaseLock",
  ]) {
    it.each(surfaces)(`%s sends X-Session-Id on ${method}`, (_name, src) => {
      const call =
        src.match(
          new RegExp(`    ${method}:[\\s\\S]*?(?=\\n    [a-zA-Z]+:|\\n  },)`),
        )?.[0] ?? "";
      expect(call.includes('headers: { "X-Session-Id": sessionId }')).toBe(
        true,
      );
      if (method === "releaseLock")
        expect(call.includes("keepalive: true")).toBe(true);
    });
  }

  it.each(["backend/collaboration.md", "de/backend/collaboration.md"])(
    "%s requires statusCode to classify retries",
    (rel) => {
      const sentence =
        readDocs(rel)
          .split("\n")
          .find((line) => line.startsWith("`api`")) ?? "";
      expect(sentence.includes("`statusCode`")).toBe(true);
      expect(
        sentence.includes(
          rel.startsWith("de/") ? "Netzwerkfehler" : "network failure",
        ),
      ).toBe(true);
      expect(
        sentence.includes(rel.startsWith("de/") ? "erneut" : "retried"),
      ).toBe(true);
    },
  );

  it.each(surfaces.slice(2))(
    "%s preserves HTTP status and request headers",
    (_name, src) => {
      expect(
        src.includes(
          "Object.assign(new Error(body.message), body, { statusCode: res.status })",
        ),
      ).toBe(true);
      expect(
        src.includes(
          'headers: { "Content-Type": "application/json", ...init.headers }',
        ),
      ).toBe(true);
    },
  );
});


describe("agent-first AI documentation", () => {
  it("the AI-kit README loads a template and explains the entry-point gate", () => {
    const src = readRepo("packages/ai-kit/README.md");
    expect(src).toMatch(/const editor = await init\(/);
    expect(src).toMatch(/await editor\.(?:load|create)\(/);
    expect(src).toMatch(/(?:loaded template|load\(\).*create\(\))/i);
  });

  it("the AI-kit README offers all four package managers", () => {
    const src = readRepo("packages/ai-kit/README.md");
    for (const command of ["npm install", "pnpm add", "yarn add", "bun add"]) {
      expect.soft(src).toContain(`${command} @templatical/ai-kit`);
    }
  });

  it.each([
    ["guide/bring-your-own-ai.md", "Backend conformance and model evaluation"],
    ["de/guide/bring-your-own-ai.md", "Backend-Konformität und Modellevaluierung"],
  ])("%s labels backend verification by its task", (page, heading) => {
    expect(readDocs(page)).toContain(`## ${heading}`);
  });

  it.each(["backend/ai.md", "de/backend/ai.md"])(
    "%s avoids a derived translation-language count", (page) => {
      expect(readDocs(page)).not.toMatch(/\b16 (?:languages|(?:Ziel)?sprachen)\b/);
    },
  );

  it("the editor README calls the BYO section Backend providers", () => {
    expect(readRepo("packages/editor/README.md")).toContain("## Backend providers");
  });
});


describe("collaborative persistence without templates.save", () => {
  it.each([
    ["backend/templates.md", "With collaboration, they still settle"],
    ["de/backend/templates.md", "Mit Zusammenarbeit warten sie weiterhin"],
  ])("%s does not claim a disabled save settles batches", (page, claim) => {
    expect(readDocs(page)).not.toContain(claim);
  });
});

describe("AI partial-failure replay guidance", () => {
  it.each(["backend/ai.md", "de/backend/ai.md"])(
    "%s qualifies Undo for server-applied batches", (page) => {
      const errors = readDocs(page).split(page.startsWith("de/") ? "## Fehler\n" : "## Errors\n")[1]?.split("\n## ")[0];
      expect(errors).toContain("onApplied");
      expect(errors).toContain("conversation.undo");
    },
  );
});


it.each([
  ["backend/ai.md", "Verification reuses a lint result that already covers the fix's final content; otherwise it waits for the next re-lint."],
  ["de/backend/ai.md", "Die Überprüfung verwendet ein Lint-Ergebnis, das den endgültigen Inhalt des Fixes bereits abdeckt; andernfalls wartet sie auf die nächste Lint-Prüfung."],
])("%s describes both covered-result and pending re-lint verification", (page, contract) => {
  expect(readDocs(page)).toContain(contract);
  expect(readDocs(page)).not.toMatch(/Only the next 500 ms|Erst die nächste, um 500 ms/);
});
