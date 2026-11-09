import { describe, expect, it } from "vitest";
import { sourceHash } from "@templatical/types";
import { convertModule } from "../block-mapper";
import { convertBeeFreeTemplate } from "../converter";
import {
  decodeEntitiesInHtml,
  decodeEntitiesInTokens,
  decodeEntitiesInTokensForAttribute,
  trimHighlightedTokenPadding,
  unwrapMergeTagCode,
} from "../merge-tokens";
import type { BeeFreeeModule, BeeFreeTemplate } from "../types";
import { expectLinear } from "./expectLinear";
import fixture from "./fixtures/twig-entity-encoded.json";

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

const DECODED_FIXTURE_HTML =
  '<div class="txtTinyMce-wrapper" style="font-size: 14px; line-height: 120%;"><p>{% if guest.sex == \'female\' %}Dear Ms{% elseif guest.sex == \'male\' %}Dear Mr{% endif %} {{ guest.first_name|default("guest") }}</p><p>{% if item.quantity > 1 %}Tickets{% endif %}</p></div>';

describe("HTML entities inside Twig and Liquid tokens", () => {
  it("decodes named and numeric references inside tokens and leaves the rest encoded", () => {
    expect(
      paragraph(
        "<p>Tom &amp; Jerry {{ guest|default(&quot;a&quot;) }} {% if n &gt; 1 %}x{% endif %} {# &#39;n&#39; #}</p>",
      ),
    ).toBe(
      "<p>Tom &amp; Jerry {{ guest|default(\"a\") }} {% if n > 1 %}x{% endif %} {# 'n' #}</p>",
    );
  });

  it.each([
    ["decimal &#39;", "{{ &#39; }}", "{{ ' }}"],
    ["decimal &#0039;", "{{ &#0039; }}", "{{ ' }}"],
    ["hex &#x27;", "{{ &#x27; }}", "{{ ' }}"],
    ["hex &#X00027;", "{{ &#X00027; }}", "{{ ' }}"],
    ["&#34;", "{{ &#34; }}", '{{ " }}'],
    ["&#x3E;", "{{ &#x3E; }}", "{{ > }}"],
    ["&AMP;", "{{ a &AMP; b }}", "{{ a & b }}"],
    ["&lt;", "{{ a &lt; b }}", "{{ a < b }}"],
    ["&gt;", "{{ a &gt; b }}", "{{ a > b }}"],
    ["&apos;", "{{ &apos; }}", "{{ ' }}"],
    ["&quot;", "{{ &quot; }}", '{{ " }}'],
    ["&nbsp;", "{{ a&nbsp;b }}", "{{ a b }}"],
  ])("decodes %s inside a token", (_name, token, decoded) => {
    expect(paragraph(`<p>${token}</p>`)).toBe(`<p>${decoded}</p>`);
  });

  it("keeps &nbsp; and other references outside tokens", () => {
    expect(paragraph("<p>a&nbsp;b &copy; {{ c }}</p>")).toBe(
      "<p>a&nbsp;b &copy; {{ c }}</p>",
    );
  });

  it("decodes a reference once, so &amp;quot; becomes &quot;", () => {
    expect(paragraph("<p>{{ &amp;quot; }}</p>")).toBe("<p>{{ &quot; }}</p>");
  });

  it("leaves an unterminated token encoded and still decodes a complete one", () => {
    expect(paragraph("<p>{{ a &quot; }} {% if b &gt;</p>")).toBe(
      '<p>{{ a " }} {% if b &gt;</p>',
    );
    expect(paragraph("<p>{% if &gt; {{ a &quot;b&quot; }}</p>")).toBe(
      '<p>{% if &gt; {{ a "b" }}</p>',
    );
  });

  it("leaves a numeric reference that is not a Unicode scalar", () => {
    expect(paragraph("<p>{{ &#0; }} {{ &#xD800; }} {{ &#x110000; }}</p>")).toBe(
      "<p>{{ &#0; }} {{ &#xD800; }} {{ &#x110000; }}</p>",
    );
  });

  it("decodes a paragraph module and a list the same way as text", () => {
    const html = "<p>{% if a == &#39;b&#39; %}yes{% endif %}</p>";
    const decoded = "<p>{% if a == 'b' %}yes{% endif %}</p>";
    const paragraphBlock = convertModule(
      moduleOf("mailup-bee-newsletter-modules-paragraph", {
        paragraph: { html },
      }),
      [],
    ).block;
    const list = convertModule(
      moduleOf("mailup-bee-newsletter-modules-list", {
        list: { html: "<ul><li>{% if n &gt; 1 %}items{% endif %}</li></ul>" },
      }),
      [],
    ).block;
    if (paragraphBlock.type !== "paragraph" || list.type !== "paragraph") {
      throw new Error("expected paragraphs");
    }
    expect(paragraphBlock.content).toBe(decoded);
    expect(list.content).toBe(
      '<ul style="margin-top: 0; margin-bottom: 0; padding-left: 20px; list-style-type: revert"><li style="margin: 0">{% if n > 1 %}items{% endif %}</li></ul>',
    );
  });

  it("decodes a heading after stripping the heading tag", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-heading", {
        heading: {
          title: "h1",
          text: "<h1>{% if guest.sex == &#39;female&#39; %}Hi</h1>",
        },
      }),
      [],
    ).block;
    if (block.type !== "title") throw new Error("expected a title");
    expect(block.content).toBe("<p>{% if guest.sex == 'female' %}Hi</p>");
  });

  it("decodes a button label after stripping tags, and its href", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-button", {
        button: {
          label: "<b>{% if n &gt; 1 %}Go</b>",
          href: "https://example.com/{{ id|default(&quot;a&quot;) }}",
        },
      }),
      [],
    ).block;
    if (block.type !== "button") throw new Error("expected a button");
    expect(block.text).toBe("{% if n > 1 %}Go");
    expect(block.url).toBe('https://example.com/{{ id|default("a") }}');
  });

  it("decodes character references in a button label outside tokens", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-button", {
        button: {
          label:
            '<div class="txtTinyMce-wrapper"><p>I&nbsp;would like to join</p></div>',
        },
      }),
      [],
    ).block;
    if (block.type !== "button") throw new Error("expected a button");
    expect(block.text).toBe(`I${"\u00A0"}would like to join`);
  });

  it("decodes a numeric reference in a button label to the character", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-button", {
        button: {
          label:
            '<div><p style="word-break:break-word;">HIER GEHT&#39;S ZUR AGENDA</p></div>',
        },
      }),
      [],
    ).block;
    if (block.type !== "button") throw new Error("expected a button");
    expect(block.text).toBe("HIER GEHT'S ZUR AGENDA");
  });

  it("turns a doubled &amp;nbsp; in rich text back into &nbsp;", () => {
    expect(
      paragraph(
        '<p>und begrüßen Sie <span style="font-size: 16px;">&amp;nbsp;</span>herzlich</p>',
      ),
    ).toBe(
      '<p>und begrüßen Sie <span style="font-size: 16px;">&nbsp;</span>herzlich</p>',
    );
  });

  it("decodes an image src, alt and href", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-image", {
        image: {
          src: "https://example.com/{{ file|default(&quot;a&quot;) }}.png",
          alt: "Alt {{ name|default(&#39;x&#39;) }}",
          href: "https://example.com/?q={{ q &amp; r }}",
          width: "120px",
        },
      }),
      [],
    ).block;
    if (block.type !== "image") throw new Error("expected an image");
    expect(block.src).toBe('https://example.com/{{ file|default("a") }}.png');
    expect(block.alt).toBe("Alt {{ name|default('x') }}");
    expect(block.linkUrl).toBe("https://example.com/?q={{ q & r }}");
  });

  it("decodes a social icon href", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-social", {
        iconsList: {
          icons: [
            {
              name: "facebook",
              image: {
                href: "https://example.com/{{ page|default(&quot;a&quot;) }}",
              },
            },
          ],
        },
      }),
      [],
    ).block;
    if (block.type !== "social") throw new Error("expected social icons");
    expect(block.icons[0].url).toBe(
      'https://example.com/{{ page|default("a") }}',
    );
  });

  it("decodes menu item text and both link fields", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-menu", {
        menu: {
          items: [
            {
              text: "{% if n &gt; 1 %}Shop{% endif %}",
              link: "https://example.com/{{ id|default(&quot;a&quot;) }}",
            },
            {
              text: "About",
              href: "https://example.com/{{ slug|default(&#39;about&#39;) }}",
            },
          ],
        },
      }),
      [],
    ).block;
    if (block.type !== "menu") throw new Error("expected a menu");
    expect(block.items[0].text).toBe("{% if n > 1 %}Shop{% endif %}");
    expect(block.items[0].url).toBe(
      'https://example.com/{{ id|default("a") }}',
    );
    expect(block.items[1].url).toBe(
      "https://example.com/{{ slug|default('about') }}",
    );
  });

  it("decodes an html module", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-html", {
        html: {
          html: "<p>{% if a == &#39;b&#39; %}yes{% endif %}</p>",
        },
      }),
      [],
    ).block;
    if (block.type !== "html") throw new Error("expected html");
    expect(block.content).toBe("<p>{% if a == 'b' %}yes{% endif %}</p>");
  });

  it("decodes html copied from an unknown module", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-form", {
        text: { html: "<p>{{ name|default(&quot;guest&quot;) }}</p>" },
      }),
      [],
    ).block;
    if (block.type !== "html") throw new Error("expected html");
    expect(block.content).toBe('<p>{{ name|default("guest") }}</p>');
  });

  it("decodes a video url, thumbnail and alt", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-video", {
        video: {
          src: "https://example.com/{{ id|default(&quot;a&quot;) }}",
          thumbnail: "https://example.com/{{ thumb|default(&#39;t&#39;) }}.jpg",
          alt: "Preview {{ label|default(&quot;video&quot;) }}",
        },
      }),
      [],
    ).block;
    if (block.type !== "video") throw new Error("expected a video");
    expect(block.url).toBe('https://example.com/{{ id|default("a") }}');
    expect(block.thumbnailUrl).toBe(
      "https://example.com/{{ thumb|default('t') }}.jpg",
    );
    expect(block.alt).toBe('Preview {{ label|default("video") }}');
  });

  it("decodes a table cell after stripping its tags", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-table", {
        table: {
          rows: [
            {
              cells: [
                {
                  html: "<b>{% if n &gt; 1 %}Many</b>",
                },
              ],
            },
          ],
        },
      }),
      [],
    ).block;
    if (block.type !== "table") throw new Error("expected a table");
    expect(block.rows[0].cells[0].content).toBe("{% if n > 1 %}Many");
  });

  it("decodes a lone icon's src, alt and href", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-icons", {
        computedStyle: { iconHeight: "32px" },
        iconsList: {
          icons: [
            {
              image:
                "https://example.com/{{ file|default(&quot;a&quot;) }}.png",
              alt: "Gift {{ name|default(&#39;x&#39;) }}",
              href: "https://example.com/{{ id|default(&quot;a&quot;) }}",
              width: "48px",
              height: "48px",
            },
          ],
        },
      }),
      [],
      { columnWidth: 600 },
    ).block;
    if (block.type !== "image") throw new Error("expected an image");
    expect(block.src).toBe('https://example.com/{{ file|default("a") }}.png');
    expect(block.alt).toBe("Gift {{ name|default('x') }}");
    expect(block.linkUrl).toBe('https://example.com/{{ id|default("a") }}');
  });

  it("decodes tokens in an icons table, including after HTML escaping", () => {
    const block = convertModule(
      moduleOf("mailup-bee-newsletter-modules-icons", {
        computedStyle: { iconHeight: "32px" },
        iconsList: {
          icons: [
            {
              image: "https://example.com/icon.png",
              alt: "Icon",
              href: "https://example.com/{{ id|default(&quot;a&quot;) }}",
              text: "{% if n &gt; 1 %}Gifts{% endif %}",
              textPosition: "right",
              width: "48px",
              height: "48px",
            },
          ],
        },
      }),
      [],
    ).block;
    if (block.type !== "html") throw new Error("expected html");
    expect(block.content).toContain(
      'href="https://example.com/{{ id|default(&quot;a&quot;) }}"',
    );
    expect(block.content).toContain("{% if n > 1 %}Gifts{% endif %}");
    expect(block.content).not.toContain('" onmouseover=');
    expect(block.content).not.toContain("&gt;");
  });

  it("decodes a translated paragraph and a translated menu label", () => {
    const { content } = convertBeeFreeTemplate({
      page: {
        body: { language: { value: "en-US" } },
        rows: [
          {
            columns: [
              {
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-paragraph",
                    descriptor: {
                      paragraph: {
                        html: "<p>{{ name|default(&quot;guest&quot;) }}</p>",
                        translations: {
                          "es-ES": {
                            html: "<p>{{ name|default(&quot;invitado&quot;) }}</p>",
                          },
                        },
                      },
                    },
                  },
                  {
                    type: "mailup-bee-newsletter-modules-menu",
                    descriptor: {
                      menu: {
                        items: [{ text: "{% if n &gt; 1 %}Shop{% endif %}" }],
                        translations: {
                          "es-ES": {
                            items: [
                              { text: "{% if n &gt; 1 %}Tienda{% endif %}" },
                            ],
                          },
                        },
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
    const paragraphBlock = content.blocks[0];
    const menu = content.blocks[1];
    if (paragraphBlock.type !== "paragraph" || menu.type !== "menu") {
      throw new Error("expected a paragraph and a menu");
    }
    expect(paragraphBlock.content).toBe('<p>{{ name|default("guest") }}</p>');
    expect(paragraphBlock.l10n?.["es-ES"].text?.content).toEqual({
      value: '<p>{{ name|default("invitado") }}</p>',
      sourceHash: sourceHash('<p>{{ name|default("guest") }}</p>'),
    });
    expect(menu.items[0].text).toBe("{% if n > 1 %}Shop{% endif %}");
    expect(
      menu.l10n?.["es-ES"].text?.[`items.${menu.items[0].id}.text`],
    ).toEqual({
      value: "{% if n > 1 %}Tienda{% endif %}",
      sourceHash: sourceHash("{% if n > 1 %}Shop{% endif %}"),
    });
  });

  it("decodes the preheader and a translated preheader", () => {
    const { content } = convertBeeFreeTemplate({
      head: {
        meta: {
          preheader: "Hi {{ name|default(&quot;guest&quot;) }}",
          translations: {
            "es-ES": {
              preheader: "Hola {{ name|default(&quot;invitado&quot;) }}",
            },
          },
        },
      },
      page: {
        body: { language: { value: "en-US" } },
        rows: [],
      },
    });
    expect(content.settings.preheaderText).toBe(
      'Hi {{ name|default("guest") }}',
    );
    expect(content.settings.l10n?.["es-ES"].text?.preheaderText).toEqual({
      value: 'Hola {{ name|default("invitado") }}',
      sourceHash: sourceHash('Hi {{ name|default("guest") }}'),
    });
  });

  it("decodes a row background image url", () => {
    const { content } = convertBeeFreeTemplate({
      page: {
        rows: [
          {
            content: {
              style: {
                "background-image":
                  "url('https://cdn.test/{{ id|default(&quot;a&quot;) }}.png')",
                "background-repeat": "no-repeat",
              },
            },
            columns: [
              {
                modules: [
                  {
                    type: "mailup-bee-newsletter-modules-text",
                    descriptor: { text: { html: "<p>Copy</p>" } },
                  },
                ],
              },
            ],
          },
        ],
      },
    } as BeeFreeTemplate);
    const section = content.blocks[0];
    if (section.type !== "section") throw new Error("expected a section");
    expect(section.backgroundImage?.url).toBe(
      'https://cdn.test/{{ id|default("a") }}.png',
    );
  });

  it("decodes the trimmed TWIG_ENTITY_ENCODED fixture", () => {
    const { content } = convertBeeFreeTemplate(fixture as BeeFreeTemplate);
    const block = content.blocks[0];
    if (block.type !== "paragraph") throw new Error("expected a paragraph");
    expect(block.content).toBe(DECODED_FIXTURE_HTML);
  });
});

// Earliest opener, shortest closer, and an unterminated opener left in place.
const OLD_TOKEN = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;

function decodeWithOldToken(value: string): string {
  OLD_TOKEN.lastIndex = 0;
  return value.replace(OLD_TOKEN, (token) =>
    token
      .replaceAll("&#39;", "'")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&"),
  );
}

describe("code tags the scanner cannot treat as a chip", () => {
  it("leaves an unclosed code tag as written", () => {
    expect(unwrapMergeTagCode('<code data-bee-type="mergetag"')).toBe(
      '<code data-bee-type="mergetag"',
    );
    expect(
      unwrapMergeTagCode('before <code data-bee-type="mergetag" {{ a }}'),
    ).toBe('before <code data-bee-type="mergetag" {{ a }}');
    expect(trimHighlightedTokenPadding("hi <code")).toBe("hi <code");
    expect(trimHighlightedTokenPadding('<code class="x"')).toBe(
      '<code class="x"',
    );
  });

  it("drops a self-closing mergetag chip and keeps a self-closing code chip", () => {
    expect(
      unwrapMergeTagCode('<code data-bee-type="mergetag" />{{ name }}'),
    ).toBe("{{ name }}");
    expect(
      unwrapMergeTagCode('pre <code data-bee-type="mergetag" /> post'),
    ).toBe("pre  post");
    expect(trimHighlightedTokenPadding("<code /> after")).toBe(
      "<code /> after",
    );
    expect(
      trimHighlightedTokenPadding('<code class="x" /> <code>  {{a}}</code>'),
    ).toBe('<code class="x" /> <code>{{a}}</code>');
  });
});

describe("tokens in a double-quoted attribute", () => {
  it.each([
    [
      "apostrophe, marks and a space",
      "{% if a == &#39;x&#39; &gt; 1 &lt; 2 %}{{ a&amp;b&nbsp;c }}",
    ],
    ["outside a token", "keep &quot; {{ c&gt;d }} &quot;"],
    ["an unterminated token", "{{ &gt;"],
    ["a doubled amp before a quote", "{{ &amp;quot; }}"],
    ["an apostrophe entity", "{{ &apos; }}"],
  ])("matches full decoding when %s has no quote character", (_name, input) => {
    expect(decodeEntitiesInTokensForAttribute(input)).toBe(
      decodeEntitiesInTokens(input),
    );
  });

  it.each([
    ["&quot;", "{{ &quot; }}"],
    ["&QUOT;", "{{ &QUOT; }}"],
    ["&#34;", "{{ &#34; }}"],
    ["&#034;", "{{ &#034; }}"],
    ["&#0034;", "{{ &#0034; }}"],
    ["&#x22;", "{{ &#x22; }}"],
    ["&#X22;", "{{ &#X22; }}"],
    ["&#x00022;", "{{ &#x00022; }}"],
  ])("keeps %s encoded as &quot;", (_name, input) => {
    expect(decodeEntitiesInTokensForAttribute(input)).toBe("{{ &quot; }}");
    expect(decodeEntitiesInTokens(input)).toBe('{{ " }}');
  });

  it("decodes a quote in a text node and keeps one inside an attribute", () => {
    expect(paragraph("<p>{{ say &quot;hi&quot; }}</p>")).toBe(
      '<p>{{ say "hi" }}</p>',
    );
    const linked = paragraph(
      '<p><a href="{{ a(&quot;x&quot;) onmouseover=&quot;y&quot; }}{% if a == &#39;x&#39; &gt; 1 %}">go</a></p>',
    );
    expect(linked).toBe(
      "<p><a href=\"{{ a(&quot;x&quot;) onmouseover=&quot;y&quot; }}{% if a == 'x' > 1 %}\">go</a></p>",
    );
    expect(linked).not.toContain('" onmouseover=');
  });

  it("keeps the delimiter encoded in a single-quoted or unquoted attribute", () => {
    expect(paragraph("<p><a href='{{ a&#39;b&quot;c&apos; }}'>x</a></p>")).toBe(
      "<p><a href='{{ a&#39;b\"c&#39; }}'>x</a></p>",
    );
    expect(
      paragraph(
        "<p><a href={{a&quot;b&#39;c&gt;d&nbsp;e&amp;f&lt;g}}>x</a></p>",
      ),
    ).toBe("<p><a href={{a&quot;b&#39;c&gt;d&nbsp;e&f<g}}>x</a></p>");
    expect(
      paragraph(
        '<p><a href={{a&#32;&#9;&#10;&#13;&#12;b}} title = "{{ &gt; }}">x</a></p>',
      ),
    ).toBe(
      '<p><a href={{a&#32;&#9;&#10;&#13;&#12;b}} title = "{{ > }}">x</a></p>',
    );
  });

  it("decodes a comment and leaves an unclosed tag as written", () => {
    expect(paragraph("<p><!-- {{ &quot; }} -->{{ &#39; }}</p>")).toBe(
      "<p><!-- {{ \" }} -->{{ ' }}</p>",
    );
    expect(paragraph("<!-- {{ &#39; }}")).toBe("<!-- {{ ' }}");
    expect(paragraph('<p href="{{ &#39;x&#39; }}"')).toBe(
      '<p href="{{ &#39;x&#39; }}"',
    );
    expect(paragraph("<p>{{ &#39; }}</p>")).toBe("<p>{{ ' }}</p>");
    expect(paragraph("<a href=>{{ &#39; }}</a>")).toBe("<a href=>{{ ' }}</a>");
  });
});

describe("merge token scan", () => {
  it.each([
    ["adjacent", "{{a&#39;}}{{b&gt;}}"],
    ["nested braces", "{{ {% &#39; %} }}"],
    ["inner only", "{{ {% &#39; %}"],
    ["later curly", "{% no }} {{ a&#39; }}"],
    ["unterminated then hash", "{{# &#39; {# a&#39; #}"],
    ["shortest curly", "{{{{ foo&#39; }}"],
    ["shared percent", "{{%}%} {%%} {##}"],
    ["no closer", "{{{{ &#39;"],
    ["opener kinds touch", "{{% foo&#39; %} {# bar&gt; #}"],
    ["text around", "pre {{ a&amp;b }} mid {% c&gt;d %} post"],
    ["unclosed percent", "{% &#39; {{ b&gt; }}"],
    ["empty tokens", "{{}}{%}%}{# #}"],
    ["newline", "{{ &#39;\n }} {% \t&gt; %}"],
    ["first closer wins", "{{ {{ foo&#39; }} }}"],
    ["hash inside curly fails", "{#{#}#} {{%}%}"],
  ])("matches the old token regex on %s", (_name, input) => {
    expect(decodeEntitiesInTokens(input)).toBe(decodeWithOldToken(input));
  });

  it.each(["{{{{", "{{%", "{{#"])(
    "scans %s repeated 50k times in linear time",
    (opener) => {
      const scan = (value: string) => ({
        decoded: decodeEntitiesInTokens(value),
        unwrapped: unwrapMergeTagCode(
          `<code data-bee-type="mergetag">${value}</code>`,
        ),
        trimmed: trimHighlightedTokenPadding(`<code> ${value}</code>`),
      });
      const value = opener.repeat(50_000);
      const { decoded, unwrapped, trimmed } = scan(value);
      expect(decoded).toBe(value);
      expect(unwrapped).toBe(value);
      expect(trimmed.startsWith("<code>")).toBe(true);
      expectLinear((n) => {
        const input = opener.repeat(n);
        return () => scan(input);
      }, 2_000);
    },
  );
});

describe("a token that spans inline tags", () => {
  it("decodes a non-breaking space in a tag that spans code elements", () => {
    expect(
      paragraph(
        '<p>{% if <code>anzahl_x</code>&nbsp; == "2" or <code>anzahl_x</code>&nbsp; == "3" %}</p>',
      ),
    ).toBe(
      '<p>{% if <code>anzahl_x</code>  == "2" or <code>anzahl_x</code>  == "3" %}</p>',
    );
  });

  it("decodes &quot; and &#39; in the text of a tag-spanning token", () => {
    expect(
      paragraph(
        "<p>{% if <code>anzahl_x</code>&nbsp;== &quot;2&quot; or <code>anzahl_x</code>&#39;x&#39; %}</p>",
      ),
    ).toBe(
      `<p>{% if <code>anzahl_x</code> == "2" or <code>anzahl_x</code>'x' %}</p>`,
    );
  });

  it("decodes a non-breaking space between an opener and a closer in a later block", () => {
    expect(
      paragraph(
        "<p>{{ field_x } {% endif %}</p><p>&nbsp;</p><p>next {{ other }}</p>",
      ),
    ).toBe("<p>{{ field_x } {% endif %}</p><p> </p><p>next {{ other }}</p>");
  });

  it("leaves a reference outside the spanning token encoded", () => {
    expect(paragraph("<p>&nbsp;{% if <code>a</code>&nbsp;b %}</p>")).toBe(
      "<p>&nbsp;{% if <code>a</code> b %}</p>",
    );
  });

  it("decodes text in a token and keeps each attribute kind encoded", () => {
    expect(
      paragraph(
        "<p>{% if <a href=\"&quot;\">t</a> <a href='&#39;'>u</a> <b title={{&gt;&nbsp;}}>v</b> &nbsp;&#39; %}</p>",
      ),
    ).toBe(
      `<p>{% if <a href="&quot;">t</a> <a href='&#39;'>u</a> <b title={{&gt;&nbsp;}}>v</b>  ' %}</p>`,
    );
  });

  it("leaves a reference in the tag name encoded", () => {
    expect(
      paragraph('<p>{% if <span&nbsp; class="x">a</span> &quot; %}</p>'),
    ).toBe(`<p>{% if <span&nbsp; class="x">a</span> " %}</p>`);
  });

  it("turns a literal non-breaking space into a space only outside a tag", () => {
    const nbsp = "\u00A0";
    expect(paragraph(`<p>{% if <code>a</code>${nbsp}b %}</p>`)).toBe(
      "<p>{% if <code>a</code> b %}</p>",
    );
    expect(paragraph(`<p>{% if <code>a</code>${nbsp}${nbsp}b %}</p>`)).toBe(
      "<p>{% if <code>a</code>  b %}</p>",
    );
    expect(paragraph(`<p><a href={{a${nbsp}b}}>x</a></p>`)).toBe(
      "<p><a href={{a&nbsp;b}}>x</a></p>",
    );
    expect(paragraph(`<p><a href="{{a${nbsp}b}}">x</a></p>`)).toBe(
      '<p><a href="{{a b}}">x</a></p>',
    );
    expect(paragraph(`<p>{% if <span${nbsp} class="x">a</span> b %}</p>`)).toBe(
      `<p>{% if <span${nbsp} class="x">a</span> b %}</p>`,
    );
  });

  it("decodes a finished token before an unclosed tag and leaves that tag encoded", () => {
    expect(paragraph('<p>{{ &#39; }}</p><br href="{{ &#39;x&#39; }}')).toBe(
      `<p>{{ ' }}</p><br href="{{ &#39;x&#39; }}`,
    );
  });

  it("decodes a token in a string that has no tags", () => {
    expect(decodeEntitiesInHtml("{{ a&nbsp;b &quot; &#39; }}")).toBe(
      "{{ a b \" ' }}",
    );
  });

  it("scans {{ openers across tags in linear time", () => {
    const chunk = '<p><a href="{{ &quot;">{{ &nbsp;';
    const value = chunk.repeat(20_000);
    expect(decodeEntitiesInHtml(value)).toBe(value);
    expectLinear((n) => {
      const input = chunk.repeat(n);
      return () => decodeEntitiesInHtml(input);
    }, 1_000);
  });
});
