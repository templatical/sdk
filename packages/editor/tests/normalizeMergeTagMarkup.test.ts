// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  createParagraphBlock,
  createImageBlock,
  createVideoBlock,
  createMenuBlock,
  createCountdownBlock,
  safeClone,
  OperationError,
  type Block,
  type Operation,
  createTitleBlock,
  createButtonBlock,
  createTableBlock,
  createSectionBlock,
  createHtmlBlock,
  createDefaultTemplateContent,
  createWrapperBlock,
  SYNTAX_PRESETS,
  type MergeTag,
  type TemplateContent,
  type CustomBlock,
} from "@templatical/types";
import {
  normalizeMergeTagsInHtml,
  normalizeRemoteOperations,
  normalizeMergeTagMarkup,
} from "../src/utils/normalizeMergeTagMarkup";

const LIQUID = SYNTAX_PRESETS.liquid;

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}", sample: "Ada" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Unsubscribe URL", value: "{{unsubscribe_url}}" },
];

function contentWith(blocks: TemplateContent["blocks"]): TemplateContent {
  return { ...createDefaultTemplateContent(), blocks };
}

function localizedContentWith(
  blocks: TemplateContent["blocks"],
): TemplateContent {
  const content = contentWith(blocks);
  content.settings.locales = ["de"];
  content.settings.preheaderText = "Default preview";
  return content;
}

// ---------------------------------------------------------------------------
// The HTML-level transform
// ---------------------------------------------------------------------------

describe("normalizeMergeTagsInHtml", () => {
  it("wraps a bare token in text position in a merge-tag span", () => {
    const result = normalizeMergeTagsInHtml(
      "<p>Hi {{first_name}}</p>",
      TAGS,
      LIQUID,
    );

    expect(result).toBe(
      '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span></p>',
    );
  });

  // F5 — the decisive property. A regex pass over the markup wraps this token
  // too, yielding `href="<span data-merge-tag="…">Unsubscribe URL</span>"`. A
  // text-node walk cannot reach an attribute value at all.
  it("leaves a token inside an href byte-identical", () => {
    const input = '<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>';

    expect(normalizeMergeTagsInHtml(input, TAGS, LIQUID)).toBe(input);
  });

  it("wraps a token in text while leaving one in an attribute of the same element", () => {
    const result = normalizeMergeTagsInHtml(
      '<p><a href="{{unsubscribe_url}}">Bye {{last_name}}</a></p>',
      TAGS,
      LIQUID,
    );

    expect(result).toBe(
      '<p><a href="{{unsubscribe_url}}">Bye <span data-merge-tag="{{last_name}}">Last Name</span></a></p>',
    );
  });

  // Q5 — matching is syntax-driven, not list-driven, so an ESP template's
  // undeclared tags become atomic too. `getMergeTagLabel` falls back to the
  // raw token, which is honest rather than invented.
  it("wraps an undeclared token using the raw token as its label", () => {
    const result = normalizeMergeTagsInHtml(
      "<p>Tier: {{customer.tier}}</p>",
      TAGS,
      LIQUID,
    );

    expect(result).toBe(
      '<p>Tier: <span data-merge-tag="{{customer.tier}}">{{customer.tier}}</span></p>',
    );
  });

  it("wraps a logic tag with its keyword as the label", () => {
    const result = normalizeMergeTagsInHtml(
      "<p>{% if vip %}VIP{% endif %}</p>",
      TAGS,
      LIQUID,
    );

    expect(result).toBe(
      '<p><span data-logic-merge-tag="{% if vip %}">IF</span>VIP' +
        '<span data-logic-merge-tag="{% endif %}">ENDIF</span></p>',
    );
  });

  // Q2 — structural idempotency. The walk skips any text node under a
  // `[data-merge-tag]` ancestor, so the span's inner text is unreachable
  // regardless of what it says.
  it("is idempotent", () => {
    const once = normalizeMergeTagsInHtml(
      "<p>Hi {{first_name}} and {% if vip %}x{% endif %}</p>",
      TAGS,
      LIQUID,
    );

    expect(normalizeMergeTagsInHtml(once, TAGS, LIQUID)).toBe(once);
  });

  // F2 — the case a lookbehind guard cannot cover: a tag whose label equals
  // its value, so the span's inner text is itself a token. Pruning the subtree
  // makes the text unreachable regardless of what it says.
  it("is idempotent when a tag's label equals its value", () => {
    const selfLabelled: MergeTag[] = [{ label: "{{x}}", value: "{{x}}" }];
    const once = normalizeMergeTagsInHtml("<p>{{x}}</p>", selfLabelled, LIQUID);

    expect(once).toBe('<p><span data-merge-tag="{{x}}">{{x}}</span></p>');
    expect(normalizeMergeTagsInHtml(once, selfLabelled, LIQUID)).toBe(once);
  });

  it("does not re-wrap inside an existing logic-tag span whose text is a token", () => {
    const input =
      '<p><span data-logic-merge-tag="{% if vip %}">{% if vip %}</span></p>';

    expect(normalizeMergeTagsInHtml(input, TAGS, LIQUID)).toBe(input);
  });

  // Short-circuit: no replacement ⇒ return the input string, never a
  // re-serialization of it. `<br/>` and single-quoted attributes are exactly
  // what a serializer would rewrite.
  it("returns tokenless html byte-identical, including <br/> and single quotes", () => {
    const input = "<p>Hello<br/>world <a href='/x'>link</a></p>";

    expect(normalizeMergeTagsInHtml(input, TAGS, LIQUID)).toBe(input);
  });

  it("returns an empty string unchanged", () => {
    expect(normalizeMergeTagsInHtml("", TAGS, LIQUID)).toBe("");
  });

  /**
   * The `<!doctype html><body>…</body>` wrapper around the parse input is
   * load-bearing, and these are the cases that prove it.
   *
   * Without it the parser starts in its "before head" insertion mode, which
   * routes leading whitespace and any head-ish element — `<style>`, `<meta>`,
   * `<title>` — into `<head>`, where reading `body.innerHTML` back silently
   * discards them. Rich text loaded from a store can legitimately carry all of
   * these, and this function's contract is to return its input untouched apart
   * from the tokens it converts.
   *
   * The fixture carries a token on purpose: with none, the zero-replacement
   * short-circuit returns the input string without ever parsing, and the
   * assertion would hold whatever the parser did.
   *
   * Only leading whitespace is pinned here. happy-dom keeps `<style>` and
   * `<meta>` in the body either way, so asserting those in this environment
   * proves nothing — they are pinned against jsdom in
   * `normalizeMergeTagMarkupAngleSyntax.test.ts`, whose parser follows the
   * spec.
   */
  it("keeps leading whitespace when a token elsewhere converts", () => {
    const result = normalizeMergeTagsInHtml(
      "  <p>{{last_name}}</p>",
      TAGS,
      LIQUID,
    );

    expect(result).toBe(
      '  <p><span data-merge-tag="{{last_name}}">Last Name</span></p>',
    );
  });

  it("wraps a token in bare text with no surrounding element", () => {
    expect(normalizeMergeTagsInHtml("{{last_name}}", TAGS, LIQUID)).toBe(
      '<span data-merge-tag="{{last_name}}">Last Name</span>',
    );
  });

  it("wraps every occurrence of a repeated token", () => {
    const result = normalizeMergeTagsInHtml(
      "<p>{{last_name}} {{last_name}}</p>",
      TAGS,
      LIQUID,
    );

    expect(result).toBe(
      '<p><span data-merge-tag="{{last_name}}">Last Name</span> ' +
        '<span data-merge-tag="{{last_name}}">Last Name</span></p>',
    );
  });

  it("escapes html-special characters in surrounding text rather than emitting them raw", () => {
    const result = normalizeMergeTagsInHtml(
      "<p>a &amp; b {{last_name}}</p>",
      TAGS,
      LIQUID,
    );

    expect(result).toBe(
      '<p>a &amp; b <span data-merge-tag="{{last_name}}">Last Name</span></p>',
    );
  });
});

// ---------------------------------------------------------------------------
// The field-aware content walk
// ---------------------------------------------------------------------------

describe("normalizeMergeTagMarkup", () => {
  it("normalizes ParagraphBlock.content", () => {
    const content = contentWith([
      createParagraphBlock({ content: "<p>Hi {{first_name}}</p>" }),
    ]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    expect((result.blocks[0] as { content: string }).content).toBe(
      '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span></p>',
    );
  });

  it("normalizes TitleBlock.content", () => {
    const content = contentWith([
      createTitleBlock({ content: "Welcome {{first_name}}" }),
    ]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    expect((result.blocks[0] as { content: string }).content).toBe(
      'Welcome <span data-merge-tag="{{first_name}}">First Name</span>',
    );
  });

  it("normalizes a paragraph nested inside a section column", () => {
    const nested = createParagraphBlock({ content: "<p>{{last_name}}</p>" });
    const section = createSectionBlock({ columns: 1 });
    section.children = [[nested]];
    const content = contentWith([section]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    const child = (result.blocks[0] as typeof section).children[0][0];
    expect((child as { content: string }).content).toBe(
      '<p><span data-merge-tag="{{last_name}}">Last Name</span></p>',
    );
  });

  it("normalizes a paragraph that is a direct wrapper child", () => {
    const nested = createParagraphBlock({ content: "<p>{{last_name}}</p>" });
    const wrapper = createWrapperBlock({ children: [nested] });
    const content = contentWith([wrapper]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    const child = (result.blocks[0] as typeof wrapper).children[0];
    expect((child as { content: string }).content).toBe(
      '<p><span data-merge-tag="{{last_name}}">Last Name</span></p>',
    );
  });

  it("normalizes a paragraph nested in a section that is a wrapper child", () => {
    const nested = createParagraphBlock({ content: "<p>{{last_name}}</p>" });
    const section = createSectionBlock({ columns: 1 });
    section.children = [[nested]];
    const wrapper = createWrapperBlock({ children: [section] });
    const content = contentWith([wrapper]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    const wrappedSection = (result.blocks[0] as typeof wrapper).children[0];
    const child = (wrappedSection as typeof section).children[0][0];
    expect((child as { content: string }).content).toBe(
      '<p><span data-merge-tag="{{last_name}}">Last Name</span></p>',
    );
  });

  // F3 — plain-string fields are rendered as text, so injecting markup into
  // them would put a literal `<span …>` on the canvas and in the MJML.
  it("leaves ButtonBlock.text and ButtonBlock.url byte-identical", () => {
    const content = contentWith([
      createButtonBlock({
        text: "Hi {{first_name}}",
        url: "https://x.test/{{account_id}}",
      }),
    ]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    const button = result.blocks[0] as { text: string; url: string };
    expect(button.text).toBe("Hi {{first_name}}");
    expect(button.url).toBe("https://x.test/{{account_id}}");
  });

  it("leaves custom-block fieldValues byte-identical", () => {
    const custom: CustomBlock = {
      id: "custom-1",
      type: "custom",
      customType: "testimonial",
      fieldValues: { quote: "Thanks {{first_name}}" },
    } as CustomBlock;
    const content = contentWith([custom]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    expect((result.blocks[0] as CustomBlock).fieldValues.quote).toBe(
      "Thanks {{first_name}}",
    );
  });

  it("leaves HtmlBlock.content byte-identical", () => {
    const content = contentWith([
      createHtmlBlock({ content: "<div>{{first_name}}</div>" }),
    ]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    expect((result.blocks[0] as { content: string }).content).toBe(
      "<div>{{first_name}}</div>",
    );
  });

  // F3 — a settings field, not a block field, so a blocks-only walk misses it.
  it("leaves settings.preheaderText byte-identical", () => {
    const content = contentWith([]);
    content.settings.preheaderText = "Hi {{first_name}}";

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    expect(result.settings.preheaderText).toBe("Hi {{first_name}}");
  });

  // Q3 — TableBlock.vue hydrates a cell via `textContent` and writes back
  // `innerText` on blur, so a normalized cell would persist literal markup as
  // text the first time a user focuses and leaves it.
  it("leaves TableCellData.content byte-identical", () => {
    const table = createTableBlock();
    table.rows = [{ cells: [{ content: "Hi {{first_name}}" }] }];
    const content = contentWith([table]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    expect((result.blocks[0] as typeof table).rows[0].cells[0].content).toBe(
      "Hi {{first_name}}",
    );
  });

  it("returns the same content reference when nothing changed", () => {
    const content = contentWith([
      createParagraphBlock({ content: "<p>Nothing here</p>" }),
      createButtonBlock({ text: "Hi {{first_name}}" }),
    ]);

    expect(normalizeMergeTagMarkup(content, TAGS, LIQUID)).toBe(content);
  });

  it("does not mutate the input content when it does change", () => {
    const paragraph = createParagraphBlock({ content: "<p>{{last_name}}</p>" });
    const content = contentWith([paragraph]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    expect(result).not.toBe(content);
    expect(paragraph.content).toBe("<p>{{last_name}}</p>");
  });

  // `TemplateContent` types `blocks` as required, but this runs at the entry
  // point, on an object the consumer hands us — a partial or hand-rolled
  // content must not turn a working `init()` into a crash.
  it("returns content with no blocks array unchanged", () => {
    const content = { settings: {} } as unknown as TemplateContent;

    expect(normalizeMergeTagMarkup(content, TAGS, LIQUID)).toBe(content);
  });

  it("returns an empty content object unchanged", () => {
    const content = {} as unknown as TemplateContent;

    expect(normalizeMergeTagMarkup(content, TAGS, LIQUID)).toBe(content);
  });

  it("skips a section whose children array is missing", () => {
    const section = createSectionBlock({ columns: 1 });
    delete (section as Partial<typeof section>).children;
    const content = contentWith([
      section,
      createParagraphBlock({ content: "<p>{{last_name}}</p>" }),
    ]);

    const result = normalizeMergeTagMarkup(content, TAGS, LIQUID);

    expect(result.blocks[0]).toBe(section);
    expect((result.blocks[1] as { content: string }).content).toBe(
      '<p><span data-merge-tag="{{last_name}}">Last Name</span></p>',
    );
  });

  it("leaves a title block with no content string alone", () => {
    const block = createTitleBlock({ content: "x" });
    delete (block as Partial<typeof block>).content;
    const content = contentWith([block]);

    expect(normalizeMergeTagMarkup(content, TAGS, LIQUID)).toBe(content);
  });

  it("is idempotent over a whole template", () => {
    const content = contentWith([
      createTitleBlock({ content: "Hi {{first_name}}" }),
      createParagraphBlock({ content: "<p>{% if vip %}VIP{% endif %}</p>" }),
    ]);

    const once = normalizeMergeTagMarkup(content, TAGS, LIQUID);
    const twice = normalizeMergeTagMarkup(once, TAGS, LIQUID);

    expect(twice).toBe(once);
  });
});

it("normalizes guarded deletion of an added merge-tag paragraph without changing the input", () => {
  const content = { blocks: [], settings: {} } as never;
  const block = {
    id: "p1",
    type: "paragraph",
    content: "<p>{{first_name}}</p>",
  } as const;
  const ops = [
    { op: "deleteBlock", blockId: "p1", expect: { block } },
  ] as const;
  const normalized = normalizeRemoteOperations(ops as never, content, {
    tags: [{ value: "{{first_name}}", label: "First name" }],
  });
  expect(
    (normalized[0] as unknown as { expect: { block: { content: string } } })
      .expect.block.content,
  ).toContain('data-merge-tag="{{first_name}}"');
  expect(ops[0].expect.block.content).toBe("<p>{{first_name}}</p>");
});

describe("remote locale merge tags", () => {
  const text = {
    content: { value: "<p>Hallo {{first_name}}</p>", sourceHash: "12345678" },
  };
  const normalized = {
    content: {
      value:
        '<p>Hallo <span data-merge-tag="{{first_name}}">First Name</span></p>',
      sourceHash: "12345678",
    },
  };

  it("normalizes each updateBlockLocale text value without mutating its source", () => {
    const op = {
      op: "updateBlockLocale" as const,
      blockId: "p1",
      locale: "de",
      text,
    };
    const ops = [op];
    const result = normalizeRemoteOperations(
      ops,
      localizedContentWith([createParagraphBlock({ id: "p1" })]),
      { tags: TAGS },
    );
    expect(result).toEqual([{ ...op, text: normalized }]);
    expect(op.text).toEqual(text);
    expect(
      normalizeRemoteOperations(
        result,
        localizedContentWith([createParagraphBlock({ id: "p1" })]),
        { tags: TAGS },
      ),
    ).toBe(result);
    expect(() =>
      normalizeRemoteOperations(result, localizedContentWith([]), {
        tags: TAGS,
      }),
    ).toThrow(OperationError);
  });

  it("normalizes nested locale text in addBlock and setContent", () => {
    const child = createParagraphBlock({ id: "p1", l10n: { de: { text } } });
    const block = createSectionBlock({ children: [[child]] });
    const ops = [
      { op: "addBlock" as const, block, parent: null, after: null },
      { op: "setContent" as const, content: contentWith([block]) },
    ];
    const result = normalizeRemoteOperations(ops, contentWith([]), {
      tags: TAGS,
    });
    expect(result[0]).toMatchObject({
      block: { children: [[{ l10n: { de: { text: normalized } } }]] },
    });
    expect(result[1]).toMatchObject({
      content: {
        blocks: [{ children: [[{ l10n: { de: { text: normalized } } }]] }],
      },
    });
    expect(child.l10n!.de.text).toEqual(text);
  });
});

describe("localized rich-text boundaries (amendment 18)", () => {
  const value = "  {{first_name}} <br/> &amp;  ";
  const source = "12345678";
  const richValue = "<p>Hallo {{first_name}}</p>";
  const richNormalized =
    '<p>Hallo <span data-merge-tag="{{first_name}}">First Name</span></p>';

  function plainBlocks(): Block[] {
    const localized = (block: Block, paths: string[]): Block => ({
      ...block,
      l10n: {
        de: {
          text: Object.fromEntries(
            paths.map((path) => [path, { value, sourceHash: source }]),
          ),
        },
      },
    });
    return [
      localized(createImageBlock({ id: "image" }), ["alt"]),
      localized(createVideoBlock({ id: "video" }), ["alt"]),
      localized(createButtonBlock({ id: "button" }), ["text"]),
      localized(
        createMenuBlock({
          id: "menu",
          items: [
            {
              id: "item",
              text: "Menu",
              url: "https://example.com",
              openInNewTab: false,
              bold: false,
              underline: false,
            },
          ],
        }),
        ["items.item.text"],
      ),
      localized(
        createTableBlock({
          id: "table",
          rows: [{ id: "row", cells: [{ id: "cell", content: "Cell" }] }],
        }),
        ["rows.row.cells.cell.content"],
      ),
      localized(createCountdownBlock({ id: "countdown" }), [
        "labelDays",
        "labelHours",
        "labelMinutes",
        "labelSeconds",
        "expiredMessage",
      ]),
    ];
  }

  it("keeps remote plain-text locale fields and preheader byte-identical", () => {
    const blocks = plainBlocks();
    const ops: Operation[] = blocks.map((block) => ({
      op: "updateBlockLocale",
      blockId: block.id,
      locale: "de",
      text: block.l10n!.de.text,
    }));
    ops.push({
      op: "updateSettingsLocale",
      locale: "de",
      text: { preheaderText: { value, sourceHash: source } },
    });
    const original = safeClone(ops);
    const result = normalizeRemoteOperations(
      ops,
      localizedContentWith(blocks),
      {
        tags: TAGS,
      },
    );
    expect(result).toEqual(original);
    expect(result).toBe(ops);
    expect(ops).toEqual(original);
  });

  it("resolves rich-text types from existing blocks and earlier additions only", () => {
    const text = { content: { value: richValue, sourceHash: source } };
    const blocks = [
      createTitleBlock({ id: "title" }),
      createParagraphBlock({ id: "paragraph" }),
      createHtmlBlock({ id: "html" }),
    ];
    const added = createSectionBlock({
      children: [
        [
          ...blocks.map((block) => ({ ...block, id: "new-" + block.id })),
          ...plainBlocks(),
        ],
      ],
    });
    const ops: Operation[] = [
      { op: "updateBlockLocale", blockId: "new-title", locale: "de", text },
      ...blocks.map((block): Operation => ({
        op: "updateBlockLocale",
        blockId: block.id,
        locale: "de",
        text,
      })),
      { op: "addBlock", block: added, parent: null, after: null },
      ...blocks.map((block): Operation => ({
        op: "updateBlockLocale",
        blockId: "new-" + block.id,
        locale: "de",
        text,
      })),
      ...plainBlocks().map((block): Operation => ({
        op: "updateBlockLocale",
        blockId: block.id,
        locale: "de",
        text: block.l10n!.de.text,
      })),
    ];
    const original = safeClone(ops);
    // The pre-add write is now refused instead of silently leaving simulation behind.
    expect(() =>
      normalizeRemoteOperations(ops, localizedContentWith(blocks), {
        tags: TAGS,
      }),
    ).toThrow(OperationError);
    const result = normalizeRemoteOperations(
      ops.slice(1),
      localizedContentWith(blocks),
      {
        tags: TAGS,
      },
    );
    for (const index of [0, 1, 2, 4, 5, 6]) {
      expect(result[index]).toMatchObject({
        text: { content: { value: richNormalized, sourceHash: source } },
      });
    }
    expect(result.slice(7)).toEqual(original.slice(8));
    expect(ops).toEqual(original);
  });

  it.each(["addBlock", "setContent"] as const)(
    "keeps nested plain locale fields byte-identical in %s while normalizing rich content",
    (kind) => {
      const plain = plainBlocks();
      const text = { content: { value: richValue, sourceHash: source } };
      const rich = [
        createTitleBlock({ id: "title", l10n: { de: { text } } }),
        createParagraphBlock({ id: "paragraph", l10n: { de: { text } } }),
        createHtmlBlock({ id: "html", l10n: { de: { text } } }),
      ];
      const section = createSectionBlock({ children: [[...plain, ...rich]] });
      const content = contentWith([section]);
      content.settings.l10n = {
        de: { text: { preheaderText: { value, sourceHash: source } } },
      };
      const op: Operation =
        kind === "addBlock"
          ? { op: "addBlock", block: section, parent: null, after: null }
          : { op: "setContent", content };
      const original = safeClone(op);
      const result = normalizeRemoteOperations([op], contentWith([]), {
        tags: TAGS,
      })[0];
      const block =
        result.op === "addBlock"
          ? result.block
          : result.op === "setContent"
            ? result.content.blocks[0]
            : null;
      expect(block?.type).toBe("section");
      if (block?.type !== "section") throw new Error("Expected a section.");
      expect(block.children[0].slice(0, plain.length)).toEqual(plain);
      for (const child of block.children[0].slice(plain.length)) {
        expect(child.l10n!.de.text).toEqual({
          content: { value: richNormalized, sourceHash: source },
        });
      }
      if (result.op === "setContent") {
        expect(result.content.settings.l10n).toEqual({
          de: { text: { preheaderText: { value, sourceHash: source } } },
        });
      }
      expect(op).toEqual(original);
    },
  );
});
