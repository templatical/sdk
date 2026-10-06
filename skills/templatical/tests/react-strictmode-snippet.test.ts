import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

const tsxBlocks = (src: string) =>
  [...src.matchAll(/```tsx[^\n]*\n([\s\S]*?)```/g)].map(([, body]) => body);

// init() is async. Under React StrictMode the effect's cleanup runs before the
// promise settles, so an instance that resolves after cancellation must be
// unmounted right there; storing it on a ref the cleanup already read leaks an
// editor (troubleshooting.md documents the symptom). Agents copy this snippet.
const CANCELLED_UNMOUNT =
  /if \(cancelled\) \{\s*ed\.unmount\(\);\s*return;\s*\}/;

const DOCS_PAGES = [
  "apps/docs/getting-started/installation.md",
  "apps/docs/de/getting-started/installation.md",
];

const docsMount = (page: string) =>
  read(`../../../${page}`).match(/```tsx \[React\]\n([\s\S]*?)```/)?.[1] ?? "";

const skillMount = () => {
  const blocks = tsxBlocks(read("../reference/integrate.md")).filter((block) =>
    block.includes("useEffect"),
  );
  expect(blocks).toHaveLength(1);
  return blocks[0];
};

describe("the React mount the skill hands to agents", () => {
  it("unmounts an editor that resolves after StrictMode cancelled the effect", () => {
    const block = skillMount();
    expect(block).toMatch(CANCELLED_UNMOUNT);
    expect(block).not.toMatch(/if \(!cancelled\) editorRef\.current = ed;/);
  });

  it.each(DOCS_PAGES)(
    "follows the same rule as the docs' React mount in %s",
    (page) => {
      expect(docsMount(page)).toMatch(CANCELLED_UNMOUNT);
    },
  );
});

// The skill and both docs locales carry the same mount, and readers copy
// whichever they find, so each is held to the same contract.
const MOUNTS: Array<[string, () => string]> = [
  ["skills/templatical/reference/integrate.md", skillMount],
  ...DOCS_PAGES.map((page): [string, () => string] => [
    page,
    () => docsMount(page),
  ]),
];

describe.each(MOUNTS)("the React mount in %s", (_page, mountSource) => {
  it("cleans up by flagging the effect cancelled and unmounting the instance that settled", () => {
    const block = mountSource();
    // `instance` is the cleanup's only handle on a settled editor, so the
    // assignment that fills it is part of the cleanup's contract.
    expect(block).toMatch(/instance = ed;/);
    const cleanup = block.match(/return \(\) => \{([\s\S]*?)\};/)?.[1] ?? "";
    expect(cleanup).toContain("cancelled = true;");
    expect(cleanup).toContain("instance?.unmount();");
    expect(cleanup).not.toMatch(/editorRef\.current\??\.unmount/);
  });

  // `useRef<HTMLDivElement>(null)` is `HTMLDivElement | null`, which init's
  // `container: string | HTMLElement` rejects under `strict` (TS2322). A const
  // read after the null check stays narrowed inside the async closure.
  it("hands init() the narrowed container, not the nullable ref", () => {
    const block = mountSource();
    expect(block).toMatch(
      /const container = containerRef\.current;\s*if \(!container\) return;/,
    );
    expect(block).toMatch(/init\(\{\s*container\s*[,}]/);
    expect(block).not.toMatch(/init\(\{[^}]*containerRef\.current/);
  });
});
