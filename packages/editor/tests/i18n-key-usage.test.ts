import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Locale ↔ source agreement, in **both** directions:
 *
 * - **No dangling reference.** Every `t.…` / `cloudT.…` chain in the editor's
 *   source resolves to something the locale actually defines. Catches deleting
 *   (or renaming) a key that is still rendered — which no other check does:
 *   `i18n.test.ts` compares locales against *each other*, and `typecheck`
 *   derives the type from `en.ts`, so removing a key from every locale is
 *   consistent, well-typed, and still a runtime `undefined`.
 * - **No dead key.** Every leaf in `en.ts` is reachable from source. Catches
 *   strings accumulating for UI that was never built — 128 of them had, and one
 *   block (81 keys × 7 locales) duplicated `@templatical/media-library`'s own.
 *
 * The two share one alias list and one resolver on purpose. They were separate
 * ad-hoc scripts once and drifted: the dead-key sweep matched only `t.`/`cloudT.`
 * and so reported keys as unused that `AiChatSidebar` reads through
 * `cloudTranslations`, while the dangling check — same blind spot — cheerfully
 * confirmed the deletion was safe. Two checks with one blind spot agree with each
 * other and are wrong together.
 */

const SRC = join(import.meta.dirname, "..", "src");
const OSS_LOCALE = join(SRC, "i18n", "locales", "en.ts");
const CLOUD_LOCALE = join(SRC, "i18n", "locales", "cloud", "en.ts");

/**
 * Every identifier observed to hold a translations object.
 *
 * **Not just `t` and `cloudT`.** Translations reach components three ways —
 * `useI18n()`'s destructure, a `props.translations`, and `requireInject(
 * CLOUD_TRANSLATIONS_KEY)` under a local name — and the third is why
 * `cloudTranslations` is here. Adding a fourth spelling without adding it to
 * this list makes both directions silently under-report; the
 * "recognises every translations holder" case below is what stops that.
 */
const CLOUD_HOLDERS = ["cloudT", "cloudTranslations"] as const;
const OSS_HOLDERS = [
  "t",
  "translations",
  "resolvedTranslations",
  "injectedTranslations",
] as const;

/**
 * Chains ending in one of these are ordinary JS on a string, not a key path
 * (`t.foo.bar.replace(…)`, `t.x.value`). Without the filter they read as
 * dangling references.
 */
const NON_KEY_TAILS = new Set([
  "value",
  "length",
  "replace",
  "toString",
  "map",
  "filter",
  "trim",
  "split",
  "slice",
  "join",
  "includes",
]);

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        (e.name.endsWith(".ts") || e.name.endsWith(".vue")) &&
        !e.name.endsWith(".d.ts"),
    )
    .map((e) => join(e.parentPath ?? SRC, e.name))
    .filter((p) => !relative(SRC, p).split(sep).includes("locales"))
    .sort();
}

/**
 * Leaf and object key paths from a locale module.
 *
 * Indentation-driven rather than an `import()` of the module: these files are
 * the source of truth for a *type*, and reading them as text keeps the guard
 * honest about what is written down rather than what TypeScript infers.
 */
function keyPaths(file: string): { leaves: Set<string>; objects: Set<string> } {
  const lines = readFileSync(file, "utf8").split("\n");
  const stack: Array<{ key: string; indent: number }> = [];
  const leaves = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();
    const indent = raw.length - raw.trimStart().length;

    while (
      stack.length > 0 &&
      indent <= stack[stack.length - 1]!.indent &&
      !line.startsWith("}")
    ) {
      stack.pop();
    }

    const opener = line.match(
      /^(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*)):\s*\{$/,
    );
    if (opener) {
      stack.push({
        key: opener[1] ?? opener[2] ?? opener[3]!,
        indent,
      });
      continue;
    }
    if (line === "}," || line === "}" || line === "} as const;") {
      stack.pop();
      continue;
    }
    const entry = line.match(
      /^(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$-]*)):\s*(?:`|"|'|$)/,
    );
    if (entry) {
      const key = entry[1] ?? entry[2] ?? entry[3]!;
      leaves.add([...stack.map((s) => s.key), key].join("."));
    }
  }

  const objects = new Set<string>();
  for (const path of leaves) {
    const parts = path.split(".");
    for (let i = 1; i < parts.length; i++) {
      objects.add(parts.slice(0, i).join("."));
    }
  }
  return { leaves, objects };
}

/**
 * Keys no component renders, kept deliberately.
 *
 * `i18n.test.ts` uses these as *fixtures* — `expect(t.history.undo).toBe(
 * "Rückgängig")` proves the German loader works, and needs some key to prove it
 * with. Deleting them would mean editing nine assertions to accommodate the
 * deletion, which is the wrong way round; a reference from a test is still a
 * reference. Both also label plausible near-future UI: undo/redo are
 * keyboard-only today (no button exists to label), and `CloudLoadingOverlay`
 * renders a shimmer skeleton with no text.
 *
 * Add to this list only with a reason. An entry that is *also* unreferenced by
 * tests is just dead code wearing an exemption.
 */
const KEPT_WITHOUT_A_READER: Record<"oss" | "cloud", readonly string[]> = {
  oss: ["history.undo", "history.redo"],
  cloud: ["loading.initializing"],
};

interface Analysis {
  leaves: Set<string>;
  used: Set<string>;
  dangling: Array<{ file: string; ref: string }>;
}

function analyse(locale: string, holders: readonly string[]): Analysis {
  const { leaves, objects } = keyPaths(locale);
  const pattern = new RegExp(
    `\\b(${holders.join("|")})((?:\\??\\.[A-Za-z_$][\\w$]*)+)`,
    "g",
  );

  const used = new Set<string>();
  const dangling: Array<{ file: string; ref: string }> = [];

  for (const file of sourceFiles()) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(pattern)) {
      const path = m[2]!.replace(/\?\./g, ".").replace(/^\./, "");
      if (NON_KEY_TAILS.has(path.split(".").pop()!)) continue;

      if (leaves.has(path)) {
        used.add(path);
      } else if (objects.has(path)) {
        // An object reference makes everything beneath it reachable — this is
        // what covers `t.blocks[type]`, `cloudT.scoring.severity[s]`, and a
        // whole subtree handed to a helper (`formatRelativeTime(x, t.time)`).
        // Resolving those by hand is how `time.*` was nearly deleted as dead.
        for (const leaf of leaves) {
          if (leaf === path || leaf.startsWith(`${path}.`)) used.add(leaf);
        }
      } else {
        dangling.push({ file: relative(SRC, file), ref: `${m[1]}.${path}` });
      }
    }
  }
  return { leaves, used, dangling };
}

const OSS = analyse(OSS_LOCALE, OSS_HOLDERS);
const CLOUD = analyse(CLOUD_LOCALE, CLOUD_HOLDERS);

describe("i18n keys agree with the source that reads them", () => {
  it("discovered the source tree and both locales (sanity check)", () => {
    expect(sourceFiles().length).toBeGreaterThan(100);
    expect(OSS.leaves.size).toBeGreaterThan(300);
    expect(CLOUD.leaves.size).toBeGreaterThan(30);
  });

  it("OSS: every t.… reference resolves to a defined key", () => {
    expect(OSS.dangling).toEqual([]);
  });

  it("cloud: every cloudT.… reference resolves to a defined key", () => {
    expect(CLOUD.dangling).toEqual([]);
  });

  it("OSS: every key is read by some component", () => {
    const dead = [...OSS.leaves]
      .filter((k) => !OSS.used.has(k) && !KEPT_WITHOUT_A_READER.oss.includes(k))
      .sort();
    expect(dead).toEqual([]);
  });

  it("cloud: every key is read by some component", () => {
    const dead = [...CLOUD.leaves]
      .filter(
        (k) => !CLOUD.used.has(k) && !KEPT_WITHOUT_A_READER.cloud.includes(k),
      )
      .sort();
    expect(dead).toEqual([]);
  });

  /**
   * The exemptions must stay exemptions. If a component starts rendering one,
   * the entry is stale and the list should shrink — otherwise it slowly becomes
   * a place where dead keys go to hide.
   */
  it("nothing on the exemption list has since gained a reader", () => {
    expect(KEPT_WITHOUT_A_READER.oss.filter((k) => OSS.used.has(k))).toEqual([]);
    expect(
      KEPT_WITHOUT_A_READER.cloud.filter((k) => CLOUD.used.has(k)),
    ).toEqual([]);
  });

  /** An exemption for a key that no longer exists is equally stale. */
  it("every exempted key still exists in its locale", () => {
    expect(
      KEPT_WITHOUT_A_READER.oss.filter((k) => !OSS.leaves.has(k)),
    ).toEqual([]);
    expect(
      KEPT_WITHOUT_A_READER.cloud.filter((k) => !CLOUD.leaves.has(k)),
    ).toEqual([]);
  });

  /**
   * The alias list is the one hand-maintained input, so it gets its own case:
   * if a component starts holding translations under a name absent from
   * `CLOUD_HOLDERS` / `OSS_HOLDERS`, both directions above quietly narrow.
   * Every `useI18n` / `useCloudI18n` destructure and every `CLOUD_TRANSLATIONS_KEY`
   * inject must bind to a name this guard recognises.
   */
  it("recognises every translations holder name in use", () => {
    const known = new Set<string>([...CLOUD_HOLDERS, ...OSS_HOLDERS]);
    const unknown = new Set<string>();

    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8");
      // `const { t } = useI18n()` / `const { t: cloudT } = useCloudI18n()`
      for (const m of src.matchAll(
        /const\s*\{\s*t\s*(?::\s*([A-Za-z_$][\w$]*))?\s*[,}][^=]*=\s*use(?:Cloud)?I18n/g,
      )) {
        const name = m[1] ?? "t";
        if (!known.has(name)) unknown.add(name);
      }
      // `const x = requireInject(CLOUD_TRANSLATIONS_KEY, …)` / inject(TRANSLATIONS_KEY)
      for (const m of src.matchAll(
        /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:requireInject|inject)\s*\(\s*(?:CLOUD_)?TRANSLATIONS_KEY/g,
      )) {
        if (!known.has(m[1]!)) unknown.add(m[1]!);
      }
    }
    expect([...unknown].sort()).toEqual([]);
  });
});
