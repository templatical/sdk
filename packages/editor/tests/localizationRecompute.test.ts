// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, toRaw } from "vue";
import * as types from "@templatical/types";
import {
  createBackgroundImage,
  createButtonBlock,
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
  sourceHash,
  type AiProvider,
  type Block,
  type LocaleCoverage,
  type TemplateContent,
} from "@templatical/types";
import type { UseEditorReturn } from "@templatical/core";
import type { VueWrapper } from "@vue/test-utils";
import { languageContent, openLanguages } from "./helpers/localization";

const TAGS = [
  "de",
  "fr",
  "es",
  "ja",
  "nl",
  "ca",
  "pt-BR",
  "it",
  "pl",
  "sv",
  "da",
  "fi",
  "nb",
  "cs",
  "hu",
  "ro",
  "tr",
  "el",
  "ko",
  "zh",
];

/** Block "a", then `others` blocks of mixed types: half translated, a tenth stale. */
function template(others: number, languages: number): TemplateContent {
  const content = languageContent();
  const tags = TAGS.slice(0, languages);
  content.settings.locales = tags;
  const text = (i: number, field: string, value: string) => ({
    l10n: Object.fromEntries(
      tags.flatMap((tag, j) =>
        (i + j) % 2
          ? []
          : [
              [
                tag,
                {
                  text: {
                    [field]: {
                      value: `${tag}: ${value}`,
                      sourceHash: sourceHash(
                        (i + j) % 10 ? value : `${value} (old)`,
                      ),
                    },
                  },
                },
              ],
            ],
      ),
    ),
  });
  const block = (i: number): Block => {
    const value = `Block ${i}`;
    switch (i % 5) {
      case 0:
        return createTitleBlock({
          id: `b${i}`,
          content: `<p>${value}</p>`,
          ...text(i, "content", `<p>${value}</p>`),
        });
      case 1:
        return createButtonBlock({
          id: `b${i}`,
          text: value,
          ...text(i, "text", value),
        });
      case 2:
        return createImageBlock({
          id: `b${i}`,
          alt: value,
          ...text(i, "alt", value),
        });
      case 3:
        return createSectionBlock({
          id: `b${i}`,
          children: [
            [
              createParagraphBlock({
                id: `b${i}-child`,
                content: `<p>${value}</p>`,
                ...text(i, "content", `<p>${value}</p>`),
              }),
            ],
          ],
        });
      default:
        return createParagraphBlock({
          id: `b${i}`,
          content: `<p>${value}</p>`,
          ...text(i, "content", `<p>${value}</p>`),
        });
    }
  };
  content.blocks = [
    createParagraphBlock({ id: "a", content: "<p>Block A</p>" }),
    ...Array.from({ length: others }, (_, i) => block(i + 1)),
  ];
  return content;
}

type Call = {
  helper: "localeCoverage" | "localeStrings" | "resolveLocale";
  locale: string;
  /** "template", "settings", or the block a status badge computes for. */
  scope: string;
  only?: "gaps" | "all";
  /** How many top-level blocks the call's content holds. */
  blocks: number;
};

/**
 * Spies through the module, so every call the editor makes is counted.
 * `localeStrings` runs its own coverage pass for `only: "gaps"`, which a
 * `localeCoverage` spy can't see, so it is spied too. `resolveLocale` counts
 * whole-template projections.
 */
function spyOnLocalization() {
  const coverage = vi.spyOn(types, "localeCoverage");
  const strings = vi.spyOn(types, "localeStrings");
  const projections = vi.spyOn(types, "resolveLocale");
  return {
    clear() {
      coverage.mockClear();
      strings.mockClear();
      projections.mockClear();
    },
    calls(editor: UseEditorReturn): Call[] {
      const whole = toRaw(editor.content.value);
      // A copy or projection of the template still counts as the template.
      const scope = (content: TemplateContent, blockId?: string) =>
        toRaw(content) === whole || content.blocks.length > 1
          ? "template"
          : (blockId ?? content.blocks[0]?.id ?? "settings");
      return [
        ...coverage.mock.calls.map(([content, locale]) => ({
          helper: "localeCoverage" as const,
          locale,
          scope: scope(content),
          blocks: content.blocks.length,
        })),
        ...strings.mock.calls.map(([content, locale, options]) => ({
          helper: "localeStrings" as const,
          locale,
          scope: scope(content, options.blockId),
          only: options.only,
          blocks: content.blocks.length,
        })),
        ...projections.mock.calls.map(([content, locale]) => ({
          helper: "resolveLocale" as const,
          locale,
          scope: scope(content),
          blocks: content.blocks.length,
        })),
      ];
    },
  };
}

/** A template's coverage passes: its coverage calls plus its gap extractions. */
const coveragePasses = (calls: Call[]) =>
  calls
    .filter(
      (call) =>
        call.scope === "template" &&
        (call.helper === "localeCoverage" || call.only === "gaps"),
    )
    .map(({ helper, locale, scope }) => ({ helper, locale, scope }));

async function openGerman(
  others: number,
  languages: number,
  content = template(others, languages),
) {
  const spies = spyOnLocalization();
  const { wrapper, editor } = await openLanguages({
    content,
    localization: { locales: TAGS.slice(0, languages) },
    translation: { translate: async () => ({ fields: [] }) },
    // The Issues panel lints on its own schedule; this measures the language UI.
    lint: { disabled: true },
  });
  editor.setActiveLocale("de");
  await nextTick();
  await nextTick();
  return { spies, wrapper, editor };
}

/** One edit to block A in the German view, then the render it schedules. */
async function editA(
  spies: ReturnType<typeof spyOnLocalization>,
  editor: UseEditorReturn,
): Promise<Call[]> {
  spies.clear();
  editor.updateBlock("a", { content: "<p>Block A, übersetzt</p>" } as never);
  await nextTick();
  await nextTick();
  return spies.calls(editor);
}

function status(wrapper: VueWrapper, coverage: LocaleCoverage) {
  return {
    bar: wrapper.get('[data-testid="language-bar-status"]').text(),
    trigger: wrapper.get('[data-testid="language-menu"]').attributes("title"),
    expected: `${coverage.missing.length} missing, ${coverage.stale.length} out of date`,
  };
}

const AI: AiProvider = {
  chat: async () => ({ messageId: null, text: "" }),
  fixFinding: false,
  altText: false,
  rewrite: false,
  chatAttachments: false,
};

/**
 * Counts walks of the whole content: reads of a layer no view in these tests
 * shows ("fr" on the last block with one), on the raw tree. Projections strip
 * `l10n` before copying, so only a deep traversal or a clone reads it.
 */
function countWholeContentPasses(editor: UseEditorReturn): () => number {
  const block = toRaw(editor.content.value).blocks.findLast(
    (candidate) => candidate.type !== "section" && candidate.l10n?.fr,
  )!;
  const layer = block.l10n!.fr;
  let reads = 0;
  Object.defineProperty(block.l10n!, "fr", {
    get: () => (reads++, layer),
    enumerable: true,
    configurable: true,
  });
  return () => {
    const count = reads;
    reads = 0;
    return count;
  };
}

afterEach(() => vi.restoreAllMocks());

describe("localization recompute", () => {
  it("computes the template's coverage once per edit in a language view and recomputes only the edited block's badge", async () => {
    const { spies, wrapper, editor } = await openGerman(300, 20);
    const before = types.localeCoverage(toRaw(editor.content.value), "de");
    expect(before.missing).toContain("a/content");

    const calls = await editA(spies, editor);

    // The header trigger, the language bar and its Translate counts share one pass.
    expect(coveragePasses(calls)).toEqual([
      { helper: "localeCoverage", locale: "de", scope: "template" },
    ]);
    // The counts' extraction: every eligible field, with no coverage pass of its own.
    expect(
      calls
        .filter(
          (call) =>
            call.scope === "template" && call.helper === "localeStrings",
        )
        .map(({ only, locale }) => ({ only, locale })),
    ).toEqual([{ only: "all", locale: "de" }]);
    // Rendering the edit projects no whole template, so it doesn't grow with
    // the blocks around A.
    expect(calls.filter((call) => call.helper === "resolveLocale")).toEqual([]);
    const badges = calls.filter(
      (call) => call.helper !== "resolveLocale" && call.scope !== "template",
    );
    expect(badges.length).toBeGreaterThan(0);
    expect(new Set(badges.map((call) => call.scope))).toEqual(new Set(["a"]));
    expect(badges.every((call) => call.blocks === 1)).toBe(true);

    const after = types.localeCoverage(toRaw(editor.content.value), "de");
    expect(after.missing).toHaveLength(before.missing.length - 1);
    expect(after.stale).toHaveLength(before.stale.length);
    const shown = status(wrapper, after);
    expect(shown.bar).toBe(shown.expected);
    expect(shown.trigger).toBe(shown.expected);
    expect(wrapper.get('[data-testid="translate-language"]').text()).toBe(
      `Translate ${after.missing.length + after.stale.length} fields`,
    );
  });

  it("computes coverage again for the template and every block when the view switches to French", async () => {
    const { spies, wrapper, editor } = await openGerman(30, 2);
    spies.clear();
    editor.setActiveLocale("fr");
    await nextTick();
    await nextTick();
    const calls = spies.calls(editor);

    expect(coveragePasses(calls)).toEqual([
      { helper: "localeCoverage", locale: "fr", scope: "template" },
    ]);
    const blocks = editor.content.value.blocks.flatMap((block) =>
      block.type === "section"
        ? [block.id, ...block.children.flat().map((child) => child.id)]
        : [block.id],
    );
    expect(
      new Set(
        calls
          .filter(
            (call) =>
              call.scope !== "template" && call.helper === "localeCoverage",
          )
          .map((call) => `${call.scope}@${call.locale}`),
      ),
    ).toEqual(new Set(blocks.map((id) => `${id}@fr`)));
    // The new language's settings are projected, without its blocks.
    expect(
      calls.filter((call) => call.helper === "resolveLocale"),
    ).toContainEqual({
      helper: "resolveLocale",
      locale: "fr",
      scope: "settings",
      blocks: 0,
    });
    const shown = status(
      wrapper,
      types.localeCoverage(toRaw(editor.content.value), "fr"),
    );
    expect(shown.bar).toBe(shown.expected);
    expect(shown.trigger).toBe(shown.expected);
  });

  it("makes the same helper computations per edit with 2 or 20 languages and with 30 or 300 other blocks", async () => {
    const work = async (others: number, languages: number) => {
      const { spies, editor } = await openGerman(others, languages);
      const calls = await editA(spies, editor);
      vi.restoreAllMocks();
      return calls
        .map(
          (call) =>
            `${call.helper}:${call.scope}@${call.locale}${call.only ? `/${call.only}` : ""}`,
        )
        .sort();
    };
    const small = await work(30, 2);
    expect(small.length).toBeGreaterThan(0);
    expect(await work(30, 20)).toEqual(small);
    expect(await work(300, 20)).toEqual(small);
  });

  it.each([
    [30, 2],
    [300, 20],
  ])(
    "walks the whole content a fixed number of times per edit with lint and AI on (%i other blocks, %i languages)",
    async (others, languages) => {
      const { editor } = await openLanguages({
        content: template(others, languages),
        localization: { locales: TAGS.slice(0, languages) },
        translation: { translate: async () => ({ fields: [] }) },
        ai: AI,
      });
      editor.setActiveLocale("de");
      await nextTick();
      await nextTick();
      const passes = countWholeContentPasses(editor);

      editor.updateBlock("a", { content: "<p>Block A, ü</p>" } as never);
      await nextTick();
      await nextTick();
      // The undo snapshot of the first edit to A, the lint version watcher's
      // walk before the render, and the idle AI author watcher's one walk.
      expect(passes()).toBe(3);

      editor.updateBlock("a", { content: "<p>Block A, üb</p>" } as never);
      await nextTick();
      await nextTick();
      // Typing on: history coalesces edits to one block and the AI watcher
      // is spent until a job starts, so only the lint version watcher walks.
      expect(passes()).toBe(1);
    },
  );

  it("projects the whole template at most once per edit for several match-image heroes", async () => {
    const content = template(30, 2);
    const hero = (id: string) =>
      createSectionBlock({
        id,
        backgroundImage: {
          ...createBackgroundImage("/hero.jpg"),
          naturalWidth: 1200,
          naturalHeight: 800,
        },
        hero: { height: "image", verticalAlign: "middle" },
        children: [[createParagraphBlock({ content: `<p>${id}</p>` })]],
      });
    content.blocks.push(hero("hero-1"), hero("hero-2"), hero("hero-3"));
    const { spies, editor } = await openGerman(0, 2, content);

    const projections = (await editA(spies, editor)).filter(
      (call) => call.helper === "resolveLocale" && call.scope === "template",
    );

    expect(projections).toEqual([
      { helper: "resolveLocale", locale: "de", scope: "template", blocks: 34 },
    ]);
  });
});
