import { describe, expect, it } from "vitest";
import { convertModule } from "../block-mapper";
import {
  trimHighlightedTokenPadding,
  unwrapMergeTagCode,
} from "../merge-tokens";
import { convertBeeFreeTemplate } from "../converter";
import type { BeeFreeeModule, BeeFreeTemplate } from "../types";
import { expectLinear } from "./expectLinear";
import fixture from "./fixtures/mergetag-code.json";

function moduleOf(
  type: string,
  descriptor: BeeFreeeModule["descriptor"],
): BeeFreeeModule {
  return { type, descriptor };
}

function paragraph(html: string): string {
  const block = convertModule(
    moduleOf("mailup-bee-newsletter-modules-text", { text: { html } }),
    [],
  ).block;
  if (block.type !== "paragraph") throw new Error("expected a paragraph");
  return block.content;
}

const FIXTURE_HTML =
  '<div class="txtTinyMce-wrapper" style="font-size: 14px; line-height: 21px;"><p style="text-align: center;"><span style="color: #000000;">Lorem ipsum dolor{{ Lorem }}Lorem ipsum dolor</span></p><p style="text-align: center;"><span style="color: #000000;"><strong>Lorem ipsum dolor{{ Lorem }} </strong></span></p><p style="text-align: center;"><a href="{{ guest.link }}" target="_blank" style="text-decoration: underline;" rel="noopener">{{ Lorem }}</a></p></div>';

describe("BeeFree merge-tag code wrappers", () => {
  it("unwraps a plain mergetag code wrapper to the token", () => {
    expect(
      paragraph(
        '<p><code data-bee-type="mergetag" data-bee-code="">{{ guest.name }}</code></p>',
      ),
    ).toBe("<p>{{ guest.name }}</p>");
  });

  it("unwraps a wrapper with extra attributes, style, and either quote style", () => {
    expect(
      paragraph(
        '<p><code style="font-family: monospace; color: #c0392b" spellcheck="false" data-bee-code="{{ guest|default(&quot;attr&quot;) }}" data-bee-type="mergetag">{{ guest|default(&quot;inner&quot;) }}</code></p>',
      ),
    ).toBe('<p>{{ guest|default("inner") }}</p>');

    expect(
      paragraph(
        "<p><code data-bee-type='mergetag' data-bee-code='{{ guest.name }}'>{{ guest.name }}</code></p>",
      ),
    ).toBe("<p>{{ guest.name }}</p>");

    expect(
      paragraph(
        '<p><code data-bee-type=mergetag data-bee-code="">{{ guest.name }}</code></p>',
      ),
    ).toBe("<p>{{ guest.name }}</p>");

    expect(
      paragraph(
        '<p><code data-bee-type = "mergetag"\n  data-bee-code="">{{ guest.name }}</code></p>',
      ),
    ).toBe("<p>{{ guest.name }}</p>");
  });

  it("keeps strong and span formatting around the unwrapped token", () => {
    expect(
      paragraph(
        '<p><span style="color: #000000"><strong><code spellcheck="false" data-bee-type="mergetag" data-bee-code="">{{ guest.name }}</code></strong></span></p>',
      ),
    ).toBe(
      '<p><span style="color: #000000"><strong>{{ guest.name }}</strong></span></p>',
    );
  });

  it("unwraps a logic tag and decodes entities inside it", () => {
    expect(
      paragraph(
        '<p><code data-bee-type="mergetag" data-bee-code="">{% if guest.sex == &#39;female&#39; %}</code>Dear Ms<code data-bee-type="mergetag">{% else %}</code>Dear guest<code data-bee-type="mergetag">{% endif %}</code></p>',
      ),
    ).toBe(
      "<p>{% if guest.sex == 'female' %}Dear Ms{% else %}Dear guest{% endif %}</p>",
    );
  });

  it("keeps a mergetag chip that holds only a non-breaking space", () => {
    expect(
      paragraph(
        '<p>Dear <code data-bee-type="mergetag" data-bee-code="">{{contact.first_name}}</code><code data-bee-type="mergetag" data-bee-code="">&nbsp;</code><code data-bee-type="mergetag" data-bee-code="">{{contact.last_name}}</code>,</p>',
      ),
    ).toBe("<p>Dear {{contact.first_name}}&nbsp;{{contact.last_name}},</p>");
  });

  it("turns a mergetag chip that holds only plain spaces into one plain space", () => {
    expect(
      paragraph(
        '<p>Dear <code data-bee-type="mergetag" data-bee-code="">{{contact.first_name}}</code><code data-bee-type="mergetag" data-bee-code=""> </code><code data-bee-type="mergetag" data-bee-code="">{{contact.last_name}}</code>,</p>',
      ),
    ).toBe("<p>Dear {{contact.first_name}} {{contact.last_name}},</p>");
  });

  it("keeps the space after a word before a mergetag chip", () => {
    expect(
      paragraph(
        '<p>SIM-Karten:<code data-bee-type="mergetag"> {{anzahl}}</code></p>',
      ),
    ).toBe("<p>SIM-Karten: {{anzahl}}</p>");
  });

  it("keeps the chip space between a word and a token", () => {
    expect(
      paragraph(
        '<p>Hallo<code data-bee-type="mergetag"> {{contact.first_name}}</code>,</p>',
      ),
    ).toBe("<p>Hallo {{contact.first_name}},</p>");
  });

  it("drops the chip space after a plain space or non-breaking space", () => {
    expect(
      paragraph(
        '<p>Hallo <code data-bee-type="mergetag"> {{contact.first_name}}</code></p>',
      ),
    ).toBe("<p>Hallo {{contact.first_name}}</p>");
    expect(
      paragraph(
        '<p>Hallo&nbsp;<code data-bee-type="mergetag"> {{contact.first_name}}</code></p>',
      ),
    ).toBe("<p>Hallo&nbsp;{{contact.first_name}}</p>");
    expect(
      paragraph(
        '<p>Hallo&#160;<code data-bee-type="mergetag"> {{contact.first_name}}</code></p>',
      ),
    ).toBe("<p>Hallo&#160;{{contact.first_name}}</p>");
    expect(
      paragraph(
        '<p>Hallo&#Xa0;<code data-bee-type="mergetag"> {{contact.first_name}}</code></p>',
      ),
    ).toBe("<p>Hallo&#Xa0;{{contact.first_name}}</p>");
  });

  it.each([
    ["&amp;nbsp;", "&nbsp;"],
    ["&amp;#160;", "&#160;"],
    ["&amp;#xA0;", "&#xA0;"],
    ["&#0160;", "&#0160;"],
  ])("drops a chip space after %s", (reference, restored) => {
    expect(
      paragraph(
        `<p>Hallo${reference}<code data-bee-type="mergetag"> {{name}}</code></p>`,
      ),
    ).toBe(`<p>Hallo${restored}{{name}}</p>`);
  });

  it("drops a chip space after a whitespace chip whose reference decodes to a non-breaking space", () => {
    expect(
      paragraph(
        '<p>Hi<code data-bee-type="mergetag">&#38;nbsp;</code><code data-bee-type="mergetag"> {{x}}</code></p>',
      ),
    ).toBe("<p>Hi&nbsp;{{x}}</p>");
  });

  it("drops plain-code padding after a doubled non-breaking-space reference", () => {
    expect(paragraph("<p>Hallo&amp;nbsp;<code> {{name}}</code></p>")).toBe(
      "<p>Hallo&nbsp;<code>{{name}}</code></p>",
    );
  });

  it("drops the chip space at a block start or after a break", () => {
    expect(
      paragraph(
        '<p><code data-bee-type="mergetag"> {{contact.first_name}}</code> kommt</p>',
      ),
    ).toBe("<p>{{contact.first_name}} kommt</p>");
    expect(
      unwrapMergeTagCode(
        '<code data-bee-type="mergetag"> {{contact.first_name}}</code>',
      ),
    ).toBe("{{contact.first_name}}");
    expect(
      paragraph(
        '<p>Hallo<br><code data-bee-type="mergetag"> {{contact.first_name}}</code></p>',
      ),
    ).toBe("<p>Hallo<br>{{contact.first_name}}</p>");
  });

  it("keeps the second chip's space after the first chip's token", () => {
    expect(
      paragraph(
        '<p><code data-bee-type="mergetag"> {{a}}</code><code data-bee-type="mergetag"> {{b}}</code></p>',
      ),
    ).toBe("<p>{{a}} {{b}}</p>");
  });

  it("sees text before a nested chip inside its enclosing chip", () => {
    expect(
      paragraph(
        '<p><code data-bee-type="mergetag">Hallo<code data-bee-type="mergetag"> {{x}}</code></code></p>',
      ),
    ).toBe("<p>Hallo {{x}}</p>");
  });

  it("looks through inline tags for the text before a chip", () => {
    expect(
      paragraph(
        '<p>Hallo <strong><code data-bee-type="mergetag"> {{x}}</code></strong></p>',
      ),
    ).toBe("<p>Hallo <strong>{{x}}</strong></p>");
    expect(
      paragraph(
        '<p><strong>Hallo</strong><code data-bee-type="mergetag"> {{x}}</code></p>',
      ),
    ).toBe("<p><strong>Hallo</strong> {{x}}</p>");
  });

  it("keeps the chip space after an image", () => {
    expect(
      paragraph(
        '<p><img src="https://example.com/a.png"><code data-bee-type="mergetag"> {{x}}</code></p>',
      ),
    ).toBe('<p><img src="https://example.com/a.png"> {{x}}</p>');
  });

  it("drops padding after case-insensitive block tags and keeps it after incomplete tags", () => {
    expect(
      unwrapMergeTagCode(
        'Hallo</H2><code data-bee-type="mergetag"> {{x}}</code>',
      ),
    ).toBe("Hallo</H2>{{x}}");
    expect(
      unwrapMergeTagCode(
        'Hallo<a "<code data-bee-type="mergetag"> {{x}}</code>',
      ),
    ).toBe('Hallo<a " {{x}}');
  });

  it("treats a bare less-than sign as visible text before a chip", () => {
    expect(
      paragraph(
        '<p>Price < <code data-bee-type="mergetag"> {{amount}}</code></p>',
      ),
    ).toBe("<p>Price < {{amount}}</p>");
    expect(
      paragraph(
        '<p>Use a < b <code data-bee-type="mergetag"> {{name}}</code></p>',
      ),
    ).toBe("<p>Use a < b {{name}}</p>");
    expect(
      unwrapMergeTagCode('Hi<<code data-bee-type="mergetag"> {{x}}</code>'),
    ).toBe("Hi< {{x}}");
  });

  it("recognizes a break after a literal less-than sign and digits", () => {
    expect(
      paragraph(
        '<p>Total<10<br><code data-bee-type="mergetag"> {{x}}</code></p>',
      ),
    ).toBe("<p>Total<10<br>{{x}}</p>");
  });

  it("ignores an HTML comment with a greater-than sign before a chip", () => {
    expect(
      paragraph(
        '<p>Hi <!-- a>b --><code data-bee-type="mergetag"> {{x}}</code></p>',
      ),
    ).toBe("<p>Hi <!-- a>b -->{{x}}</p>");
  });

  it("keeps the chip space after visible text and a comment", () => {
    expect(
      paragraph(
        '<p>Hi<!-- note --><code data-bee-type="mergetag"> {{x}}</code></p>',
      ),
    ).toBe("<p>Hi<!-- note --> {{x}}</p>");
  });

  it("keeps the chip space after an unterminated comment", () => {
    expect(
      unwrapMergeTagCode('Hi<!--<code data-bee-type="mergetag"> {{x}}</code>'),
    ).toBe("Hi<!-- {{x}}");
  });

  it("keeps a non-breaking space inside a chip at block start", () => {
    expect(
      paragraph('<p><code data-bee-type="mergetag">&nbsp;{{x}}</code></p>'),
    ).toBe("<p>&nbsp;{{x}}</p>");
  });

  it("keeps a non-breaking space before the one token in a mergetag chip", () => {
    expect(
      paragraph(
        '<p>Hello<code spellcheck="false" data-bee-type="mergetag" data-bee-code="">&nbsp;{{contact.first_name}},</code></p>',
      ),
    ).toBe("<p>Hello&nbsp;{{contact.first_name}},</p>");
  });

  it("keeps a leading space in plain code after a word", () => {
    expect(paragraph("<p>SIM-Karten:<code> {{anzahl}}</code></p>")).toBe(
      "<p>SIM-Karten:<code> {{anzahl}}</code></p>",
    );
    expect(paragraph("<p>SIM-Karten:<code> {{anzahl}} </code></p>")).toBe(
      "<p>SIM-Karten:<code> {{anzahl}} </code></p>",
    );
  });

  it("drops plain-code padding after whitespace or at a block start", () => {
    expect(paragraph("<p>Hallo <code> {{x}}</code></p>")).toBe(
      "<p>Hallo <code>{{x}}</code></p>",
    );
    expect(paragraph("<p><code> {{x}}</code></p>")).toBe(
      "<p><code>{{x}}</code></p>",
    );
    expect(paragraph("<p>Hallo<br><code> {{x}}</code></p>")).toBe(
      "<p>Hallo<br><code>{{x}}</code></p>",
    );
    expect(paragraph("<p>Hallo&nbsp;<code> {{x}}</code></p>")).toBe(
      "<p>Hallo&nbsp;<code>{{x}}</code></p>",
    );
  });

  it("looks through inline tags before plain code", () => {
    expect(paragraph("<p>Hallo <strong><code> {{x}}</code></strong></p>")).toBe(
      "<p>Hallo <strong><code>{{x}}</code></strong></p>",
    );
    expect(paragraph("<p><strong>Hallo</strong><code> {{x}}</code></p>")).toBe(
      "<p><strong>Hallo</strong><code> {{x}}</code></p>",
    );
  });

  it("keeps plain-code padding after an image", () => {
    expect(
      paragraph(
        '<p><img src="https://example.com/a.png"><code> {{x}}</code></p>',
      ),
    ).toBe('<p><img src="https://example.com/a.png"><code> {{x}}</code></p>');
  });

  it("joins a token split by a code element inside the braces", () => {
    expect(
      paragraph(
        '<p>Hi {{ <code style="color: red" data-bee-type="mergetag" data-bee-code="">guest</code>.name }}</p>',
      ),
    ).toBe("<p>Hi {{ guest.name }}</p>");

    expect(
      paragraph(
        '<p>{{ <code data-bee-type="mergetag">name|default(&quot;a&quot;)</code> }}</p>',
      ),
    ).toBe('<p>{{ name|default("a") }}</p>');
  });

  it("keeps a plain code sample, unwraps a speciallink chip, and leaves an unclosed merge-tag opener", () => {
    expect(
      paragraph(
        '<p>Run <code>npm install</code> then <code data-bee-type="mergetag">{{ guest.name }}</code>.</p>',
      ),
    ).toBe("<p>Run <code>npm install</code> then {{ guest.name }}.</p>");

    expect(
      paragraph(
        '<p><code data-bee-type="speciallink" data-bee-code=""><a href="{{ guest.link }}">{{ guest.link }}</a></code></p>',
      ),
    ).toBe('<p><a href="{{ guest.link }}">{{ guest.link }}</a></p>');

    expect(paragraph('<p><code data-bee-type="widget">keep</code></p>')).toBe(
      '<p><code data-bee-type="widget">keep</code></p>',
    );

    expect(
      paragraph(
        '<p><code data-bee-type="speciallink">run <code>npm install</code> now</code></p>',
      ),
    ).toBe("<p>run <code>npm install</code> now</p>");

    expect(
      paragraph('<p><code data-bee-type="mergetag">{{ guest.name }}</p>'),
    ).toBe('<p><code data-bee-type="mergetag">{{ guest.name }}</p>');
  });

  it("unwraps a TinyMCE speciallink chip and keeps the link", () => {
    const html =
      '<div class="txtTinyMce-wrapper" style="font-size: 14px; line-height: 21px;" data-mce-style="font-size: 14px; line-height: 21px;"><p style="font-size: 14px; line-height: 21px;" data-mce-style="font-size: 14px; line-height: 21px;"><code spellcheck="false" data-bee-type="speciallink" data-bee-code="">Sie finden die Angaben <a href="https://example.com/details" target="_blank" style="text-decoration: underline;" data-mce-style="text-decoration: underline;" rel="noopener">hier</a>.</code></p></div>';
    const { content } = convertBeeFreeTemplate({
      page: {
        rows: [
          {
            columns: [
              {
                "grid-columns": 12,
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-text",
                    descriptor: {
                      text: {
                        html,
                        computedStyle: { linkColor: "#0068A5" },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    } as BeeFreeTemplate);
    const block = content.blocks[0];
    if (block.type !== "paragraph") throw new Error("expected a paragraph");
    expect(block.content).toBe(
      '<div class="txtTinyMce-wrapper" style="font-size: 14px; line-height: 21px;" data-mce-style="font-size: 14px; line-height: 21px;"><p style="font-size: 14px; line-height: 21px;" data-mce-style="font-size: 14px; line-height: 21px;">Sie finden die Angaben <a href="https://example.com/details" target="_blank" style="text-decoration: underline; color: #0068a5" data-mce-style="text-decoration: underline;" rel="noopener">hier</a>.</p></div>',
    );
    expect(block.content).not.toContain("<code");
    expect(block.content).not.toContain("data-bee-type");
  });

  it("keeps the spaces inside a speciallink chip", () => {
    expect(
      paragraph(
        '<p><code data-bee-type="speciallink"> {{ guest.name }} </code></p>',
      ),
    ).toBe("<p> {{ guest.name }} </p>");
  });

  it("unwraps a speciallink chip with a single-quoted or unquoted type", () => {
    expect(
      paragraph(
        `<p><code data-bee-type='speciallink'><a href="https://example.com/a">hier</a></code></p>`,
      ),
    ).toBe('<p><a href="https://example.com/a">hier</a></p>');

    expect(
      paragraph(
        '<p><code data-bee-type=speciallink><a href="https://example.com/b">hier</a></code></p>',
      ),
    ).toBe('<p><a href="https://example.com/b">hier</a></p>');
  });

  it("removes a self-closing speciallink chip and an empty one", () => {
    expect(paragraph('<p>A<code data-bee-type="speciallink" />B</p>')).toBe(
      "<p>AB</p>",
    );
    expect(
      unwrapMergeTagCode('<code data-bee-type="speciallink"></code>'),
    ).toBe("");
  });

  it("leaves an unclosed speciallink opener as written", () => {
    expect(
      paragraph(
        '<p><code spellcheck="false" data-bee-type="speciallink" data-bee-code="">hier</p>',
      ),
    ).toBe(
      '<p><code spellcheck="false" data-bee-type="speciallink" data-bee-code="">hier</p>',
    );
  });

  it("unwraps a speciallink chip inside strong", () => {
    expect(
      paragraph(
        '<p><strong><code data-bee-type="speciallink"><a href="https://example.com/docs" target="_blank" rel="noopener">hier</a></code></strong></p>',
      ),
    ).toBe(
      '<p><strong><a href="https://example.com/docs" target="_blank" rel="noopener">hier</a></strong></p>',
    );
  });

  it("lets a mergetag type win when the chip also names speciallink", () => {
    expect(
      paragraph(
        "<p><code data-bee-type=speciallink data-bee-type=mergetag>  {{ x }}</code></p>",
      ),
    ).toBe("<p>{{ x }}</p>");

    expect(
      paragraph(
        "<p><code data-bee-type=mergetag data-bee-type=speciallink>  {{ x }}</code></p>",
      ),
    ).toBe("<p>{{ x }}</p>");
  });

  it("applies each chip rule when a merge tag sits next to a speciallink", () => {
    expect(
      paragraph(
        '<p>Hi <code data-bee-type="mergetag"> {{ guest.name }}</code><code data-bee-type="speciallink"> {{ guest.link }}</code></p>',
      ),
    ).toBe("<p>Hi {{ guest.name }} {{ guest.link }}</p>");
  });

  it("unwraps a heading, a list, a button label, a table cell and an html module", () => {
    const heading = convertModule(
      moduleOf("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "h2",
          text: '<h2><span style="color:#112233"><code data-bee-type="mergetag">{{ guest.name }}</code></span></h2>',
        },
      }),
      [],
    ).block;
    if (heading.type !== "title") throw new Error("expected a title");
    expect(heading.content).toBe(
      '<p><span style="color:#112233">{{ guest.name }}</span></p>',
    );

    const list = convertModule(
      moduleOf("mailup-bee-newsletter-modules-list", {
        list: {
          html: '<ul><li><strong><code data-bee-type="mergetag">{{ item.name }}</code></strong></li></ul>',
        },
      }),
      [],
    ).block;
    if (list.type !== "paragraph") throw new Error("expected a paragraph");
    expect(list.content).toBe(
      '<ul style="margin-top: 0; margin-bottom: 0; padding-left: 20px; list-style-type: revert"><li style="margin: 0"><strong>{{ item.name }}</strong></li></ul>',
    );

    const button = convertModule(
      moduleOf("mailup-bee-newsletter-modules-button", {
        button: {
          label:
            '<strong><code data-bee-type="mergetag" data-bee-code="{% if n > 1 %}">{% if n &gt; 1 %}</code></strong>',
        },
      }),
      [],
    ).block;
    if (button.type !== "button") throw new Error("expected a button");
    expect(button.text).toBe("{% if n > 1 %}");

    const table = convertModule(
      moduleOf("mailup-bee-newsletter-modules-table", {
        table: {
          content: {
            headers: [],
            rows: [
              {
                cells: [
                  {
                    html: '<code data-bee-type="mergetag" data-bee-code="{% if n > 1 %}">{% if n &gt; 1 %}</code>',
                  },
                ],
              },
            ],
          },
        },
      }),
      [],
    ).block;
    if (table.type !== "table") throw new Error("expected a table");
    expect(table.rows[0].cells[0].content).toBe("{% if n > 1 %}");

    const html = convertModule(
      moduleOf("mailup-bee-newsletter-modules-html", {
        html: {
          html: '<p>Hi <code data-bee-type="mergetag">{{ guest.name }}</code></p>',
        },
      }),
      [],
    ).block;
    if (html.type !== "html") throw new Error("expected html");
    expect(html.content).toBe(
      '<div style="font-size:16px;line-height:normal;word-break:normal;text-align:center" align="center"><p>Hi {{ guest.name }}</p></div>',
    );
  });

  it("keeps a chip space after a word in headings and button labels", () => {
    const heading = convertModule(
      moduleOf("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "h2",
          text: '<h2>Hallo<code data-bee-type="mergetag"> {{contact.first_name}}</code></h2>',
        },
      }),
      [],
    ).block;
    if (heading.type !== "title") throw new Error("expected a title");
    expect(heading.content).toBe("<p>Hallo {{contact.first_name}}</p>");

    const button = convertModule(
      moduleOf("mailup-bee-newsletter-modules-button", {
        button: {
          label:
            'Hallo<code data-bee-type="mergetag"> {{contact.first_name}}</code>',
        },
      }),
      [],
    ).block;
    if (button.type !== "button") throw new Error("expected a button");
    expect(button.text).toBe("Hallo {{contact.first_name}}");
  });

  it("unwraps a speciallink chip in a heading", () => {
    const heading = convertModule(
      moduleOf("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "h2",
          text: '<h2><code spellcheck="false" data-bee-type="speciallink" data-bee-code="">Sie finden <a href="https://example.com/details" target="_blank" style="text-decoration: underline;" rel="noopener">hier</a>.</code></h2>',
        },
      }),
      [],
    ).block;
    if (heading.type !== "title") throw new Error("expected a title");
    expect(heading.content).toBe(
      '<p>Sie finden <a href="https://example.com/details" target="_blank" style="text-decoration: underline;" rel="noopener">hier</a>.</p>',
    );
    expect(heading.content).not.toContain("<code");
    expect(heading.content).not.toContain("data-bee-type");
  });

  // The two linear-growth tests run the scan at the adversarial size and then
  // at two sizes, cheapest of five rounds each; CI's coverage run needs more
  // than the default 5 s for that.
  it("unwraps nested mergetag code in linear time", () => {
    const nested = (tags: number) =>
      '<code data-bee-type="mergetag">T'.repeat(tags) + "</code>".repeat(tags);
    expect(unwrapMergeTagCode(nested(20_000))).toBe("T".repeat(20_000));
    expectLinear((n) => {
      const html = nested(n);
      return () => unwrapMergeTagCode(html);
    }, 1_000);
  }, 30_000);

  it("unwraps unclosed mergetag code in linear time", () => {
    const chunk = '<code data-bee-type="mergetag">a';
    expect(
      paragraph(chunk.repeat(20_000)).startsWith(
        '<code data-bee-type="mergetag">',
      ),
    ).toBe(true);
    expectLinear((n) => {
      const html = chunk.repeat(n);
      return () => paragraph(html);
    }, 1_000);
  }, 30_000);

  it("unwraps nested speciallink code in linear time", () => {
    const nested = (tags: number) =>
      '<code data-bee-type="speciallink">T'.repeat(tags) +
      "</code>".repeat(tags);
    expect(unwrapMergeTagCode(nested(20_000))).toBe("T".repeat(20_000));
    expectLinear((n) => {
      const html = nested(n);
      return () => unwrapMergeTagCode(html);
    }, 1_000);
  }, 30_000);

  it("unwraps unclosed speciallink code in linear time", () => {
    const chunk = '<code data-bee-type="speciallink">a';
    expect(
      paragraph(chunk.repeat(20_000)).startsWith(
        '<code data-bee-type="speciallink">',
      ),
    ).toBe(true);
    expectLinear((n) => {
      const html = chunk.repeat(n);
      return () => paragraph(html);
    }, 1_000);
  }, 30_000);

  // The exact result and CPU growth guard both matter: scanning backwards
  // from each empty chip through earlier inline tags would be quadratic.
  it("tracks whitespace before empty chips in linear time", () => {
    const adversarial = (n: number) =>
      "<p>" +
      '<span></span><code data-bee-type="mergetag"></code>'.repeat(n) +
      '<code data-bee-type="mergetag"> {{x}}</code></p>';
    expect(unwrapMergeTagCode(adversarial(2_000))).toBe(
      "<p>" + "<span></span>".repeat(2_000) + "{{x}}</p>",
    );
    expectLinear((n) => {
      const html = adversarial(n);
      return () => unwrapMergeTagCode(html);
    }, 2_000);
  }, 30_000);

  // The empty inline code elements make a backward search from every opener
  // quadratic; the separate exact assertion guards the retained markup.
  it("tracks whitespace before plain code in linear time", () => {
    const adversarial = (n: number) =>
      "<p>" +
      "<span></span><code></code>".repeat(n) +
      "<code> {{x}}</code></p>";
    expect(trimHighlightedTokenPadding(adversarial(2_000))).toBe(
      "<p>" +
        "<span></span><code></code>".repeat(2_000) +
        "<code>{{x}}</code></p>",
    );
    expectLinear((n) => {
      const html = adversarial(n);
      return () => trimHighlightedTokenPadding(html);
    }, 2_000);
  }, 30_000);

  // A comment without `-->` in each slice must not search the rest of the
  // string for a later terminator; the scan remains linear in chip count.
  it("tracks comments before chips in linear time", () => {
    const adversarial = (n: number) =>
      '<!--<code data-bee-type="mergetag"></code>'.repeat(n) +
      '<code data-bee-type="mergetag"> {{x}}</code>';
    expect(unwrapMergeTagCode(adversarial(2_000))).toBe(
      "<!--".repeat(2_000) + " {{x}}",
    );
    expectLinear((n) => {
      const html = adversarial(n);
      return () => unwrapMergeTagCode(html);
    }, 2_000);
  }, 30_000);

  it("unwraps the trimmed MERGETAG_CODE fixture", () => {
    const { content } = convertBeeFreeTemplate(fixture as BeeFreeTemplate);
    const block = content.blocks[0];
    if (block.type !== "paragraph") throw new Error("expected a paragraph");
    expect(block.content).toBe(FIXTURE_HTML);
    expect(block.content).not.toContain('data-bee-type="mergetag"');
    expect(block.content).not.toContain('data-bee-type="speciallink"');
  });
});
