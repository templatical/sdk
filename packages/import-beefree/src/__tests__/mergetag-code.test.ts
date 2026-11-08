import { describe, expect, it } from "vitest";
import { convertModule } from "../block-mapper";
import { unwrapMergeTagCode } from "../merge-tokens";
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
  '<div class="txtTinyMce-wrapper" style="font-size: 14px; line-height: 21px;"><p style="text-align: center;"><span style="color: #000000;">Lorem ipsum dolor{{ Lorem }}Lorem ipsum dolor</span></p><p style="text-align: center;"><span style="color: #000000;"><strong>Lorem ipsum dolor{{ Lorem }} </strong></span></p><p style="text-align: center;"><code spellcheck="false" data-bee-type="speciallink" data-bee-code=""><a href="{{ guest.link }}" target="_blank" style="text-decoration: underline;" rel="noopener">{{ Lorem }}</a></code></p></div>';

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

  it("keeps a mergetag chip that holds only a non-breaking space as a plain space", () => {
    expect(
      paragraph(
        '<p>Dear <code data-bee-type="mergetag" data-bee-code="">{{contact.first_name}}</code><code data-bee-type="mergetag" data-bee-code="">&nbsp;</code><code data-bee-type="mergetag" data-bee-code="">{{contact.last_name}}</code>,</p>',
      ),
    ).toBe("<p>Dear {{contact.first_name}} {{contact.last_name}},</p>");
  });

  it("drops the space a mergetag chip pads around its token", () => {
    expect(
      paragraph(
        '<p>SIM-Karten:<code data-bee-type="mergetag"> {{anzahl}}</code></p>',
      ),
    ).toBe("<p>SIM-Karten:{{anzahl}}</p>");
  });

  it("keeps a non-breaking space before the one token in a mergetag chip", () => {
    expect(
      paragraph(
        '<p>Hello<code spellcheck="false" data-bee-type="mergetag" data-bee-code="">&nbsp;{{contact.first_name}},</code></p>',
      ),
    ).toBe("<p>Hello&nbsp;{{contact.first_name}},</p>");
  });

  it("drops a leading space inside a code element that holds one token", () => {
    expect(paragraph("<p>SIM-Karten:<code> {{anzahl}}</code></p>")).toBe(
      "<p>SIM-Karten:<code>{{anzahl}}</code></p>",
    );
    expect(paragraph("<p>SIM-Karten:<code> {{anzahl}} </code></p>")).toBe(
      "<p>SIM-Karten:<code>{{anzahl}} </code></p>",
    );
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

  it("preserves a code element that is not a merge tag", () => {
    expect(
      paragraph(
        '<p>Run <code>npm install</code> then <code data-bee-type="mergetag">{{ guest.name }}</code>.</p>',
      ),
    ).toBe("<p>Run <code>npm install</code> then {{ guest.name }}.</p>");

    expect(
      paragraph(
        '<p><code data-bee-type="speciallink" data-bee-code=""><a href="{{ guest.link }}">{{ guest.link }}</a></code></p>',
      ),
    ).toBe(
      '<p><code data-bee-type="speciallink" data-bee-code=""><a href="{{ guest.link }}">{{ guest.link }}</a></code></p>',
    );

    expect(
      paragraph('<p><code data-bee-type="mergetag">{{ guest.name }}</p>'),
    ).toBe('<p><code data-bee-type="mergetag">{{ guest.name }}</p>');
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
    expect(html.content).toBe("<p>Hi {{ guest.name }}</p>");
  });

  it("unwraps nested mergetag code in linear time", () => {
    const nested = (tags: number) =>
      '<code data-bee-type="mergetag">T'.repeat(tags) + "</code>".repeat(tags);
    expect(unwrapMergeTagCode(nested(20_000))).toBe("T".repeat(20_000));
    expectLinear((n) => {
      const html = nested(n);
      return () => unwrapMergeTagCode(html);
    }, 1_000);
  });

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
  });

  it("unwraps the trimmed MERGETAG_CODE fixture", () => {
    const { content } = convertBeeFreeTemplate(fixture as BeeFreeTemplate);
    const block = content.blocks[0];
    if (block.type !== "paragraph") throw new Error("expected a paragraph");
    expect(block.content).toBe(FIXTURE_HTML);
    expect(block.content).not.toContain('data-bee-type="mergetag"');
    expect(block.content).toContain('data-bee-type="speciallink"');
  });
});
