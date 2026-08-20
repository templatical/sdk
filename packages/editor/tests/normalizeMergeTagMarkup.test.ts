// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  createParagraphBlock,
  createTitleBlock,
  createButtonBlock,
  createTableBlock,
  createSectionBlock,
  createHtmlBlock,
  createDefaultTemplateContent,
  SYNTAX_PRESETS,
  type MergeTag,
  type TemplateContent,
  type CustomBlock,
} from "@templatical/types";
import {
  normalizeMergeTagsInHtml,
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

  // F5 — the decisive finding. The deleted regex-based `restoreMergeTagMarkup`
  // produced `href="<span data-merge-tag="…">Unsubscribe URL</span>"` here. A
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
  // its value, so the span's inner text is itself a token.
  it("is idempotent when a tag's label equals its value", () => {
    const selfLabelled: MergeTag[] = [
      { label: "{{x}}", value: "{{x}}" },
    ];
    const once = normalizeMergeTagsInHtml("<p>{{x}}</p>", selfLabelled, LIQUID);

    expect(once).toBe('<p><span data-merge-tag="{{x}}">{{x}}</span></p>');
    expect(normalizeMergeTagsInHtml(once, selfLabelled, LIQUID)).toBe(once);
  });

  it("does not re-wrap inside an existing logic-tag span whose text is a token", () => {
    const input = '<p><span data-logic-merge-tag="{% if vip %}">{% if vip %}</span></p>';

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

    expect(
      (result.blocks[0] as CustomBlock).fieldValues.quote,
    ).toBe("Thanks {{first_name}}");
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

    expect(
      (result.blocks[0] as typeof table).rows[0].cells[0].content,
    ).toBe("Hi {{first_name}}");
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
