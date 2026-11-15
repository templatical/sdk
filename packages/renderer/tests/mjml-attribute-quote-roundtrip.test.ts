import { describe, expect, it } from "vitest";
import mjml2html from "mjml";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createImageBlock,
  createMenuBlock,
  createTableBlock,
} from "@templatical/types";
import type { Block, TemplateContent } from "@templatical/types";
import { renderToMjml } from "../src";

/**
 * Attribute values are written inside double quotes and pass through MJML
 * into the compiled HTML byte-for-byte. A `'` in that value is valid HTML
 * and must stay raw so a send-time engine can still parse a quoted argument
 * (`{{ guest.link|default('x') }}`). A `"` is still `&quot;`, so it cannot
 * end the attribute.
 */

async function compile(blocks: Block[]): Promise<string> {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  const mjml = await renderToMjml(content);
  const result = await mjml2html(mjml, { validationLevel: "strict" });
  expect(result.errors).toEqual([]);
  return result.html;
}

describe("attribute quotes through the MJML compiler", () => {
  it("keeps a single-quoted argument in a button href", async () => {
    const html = await compile([
      createButtonBlock({
        url: "{{ guest.link|default('https://example.com') }}",
        text: "Open",
      }),
    ]);

    expect(html).toContain(
      'href="{{ guest.link|default(\'https://example.com\') }}"',
    );
    expect(html).not.toContain("&#039;");
  });

  it("keeps a single-quoted argument in an image src", async () => {
    const html = await compile([
      createImageBlock({
        src: "{{ guest.qr|default('https://example.com/qr.png') }}",
        alt: "QR",
      }),
    ]);

    expect(html).toContain(
      'src="{{ guest.qr|default(\'https://example.com/qr.png\') }}"',
    );
    expect(html).not.toContain("&#039;");
  });

  it("keeps a single quote raw in a renderer-written style attribute", async () => {
    const html = await compile([
      createMenuBlock({
        separator: "|",
        separatorColor: "O'Hare",
        spacing: 10,
        items: [
          {
            id: "a",
            text: "A",
            url: "https://example.com/a",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
          {
            id: "b",
            text: "B",
            url: "https://example.com/b",
            openInNewTab: false,
            bold: false,
            underline: false,
          },
        ],
      }),
    ]);

    expect(html).toContain('style="color: O\'Hare; padding: 0 10px;"');
    expect(html).not.toContain("&#039;");
  });

  it("keeps a double quote as &quot; without cutting the href short", async () => {
    const html = await compile([
      createButtonBlock({
        url: 'https://example.com/?q="guest"',
        text: "Open",
      }),
    ]);

    expect(html).toContain('href="https://example.com/?q=&quot;guest&quot;"');
    expect(html).not.toContain("&#039;");
  });
});

/**
 * Element text is content between tags. Both quotes stay raw so a merge tag
 * with a quoted argument survives, and `&` / `<` stay escaped.
 */
const QUOTED_ARGUMENTS = [
  "{{ x|default('y') }}",
  '{{ x|default("y") }}',
] as const;
const MARKUP_TEXT = "a & b <c>";
const ESCAPED_MARKUP_TEXT = "a &amp; b &lt;c&gt;";

async function compileContent(
  fill: (content: TemplateContent) => void,
): Promise<string> {
  const content = createDefaultTemplateContent();
  fill(content);
  const mjml = await renderToMjml(content);
  const result = await mjml2html(mjml, { validationLevel: "strict" });
  expect(result.errors).toEqual([]);
  return result.html;
}

function menuWithLabel(text: string): Block {
  return createMenuBlock({
    items: [
      {
        id: "a",
        text,
        url: "https://example.com/a",
        openInNewTab: false,
        bold: false,
        underline: false,
      },
    ],
  });
}

function tableWithCell(text: string): Block {
  return createTableBlock({
    hasHeaderRow: false,
    rows: [{ id: "r1", cells: [{ id: "c1", content: text }] }],
  });
}

describe("element text quotes through the MJML compiler", () => {
  it.each(QUOTED_ARGUMENTS)(
    "keeps %j raw in a button label",
    async (token) => {
      const html = await compile([
        createButtonBlock({ url: "https://example.com", text: token }),
      ]);

      expect(html).toContain(token);
    },
  );

  it.each(QUOTED_ARGUMENTS)(
    "keeps %j raw in a menu item",
    async (token) => {
      const html = await compile([menuWithLabel(token)]);

      expect(html).toContain(token);
    },
  );

  it.each(QUOTED_ARGUMENTS)(
    "keeps %j raw in a table cell",
    async (token) => {
      const html = await compile([tableWithCell(token)]);

      expect(html).toContain(token);
    },
  );

  it.each(QUOTED_ARGUMENTS)(
    "keeps %j raw in the preheader",
    async (token) => {
      const html = await compileContent((content) => {
        content.settings.preheaderText = token;
      });

      expect(html).toContain(token);
    },
  );

  it("escapes & and < in a button label", async () => {
    const html = await compile([
      createButtonBlock({ url: "https://example.com", text: MARKUP_TEXT }),
    ]);

    expect(html).toContain(ESCAPED_MARKUP_TEXT);
  });

  it("escapes & and < in a menu item", async () => {
    const html = await compile([menuWithLabel(MARKUP_TEXT)]);

    expect(html).toContain(ESCAPED_MARKUP_TEXT);
  });

  it("escapes & and < in a table cell", async () => {
    const html = await compile([tableWithCell(MARKUP_TEXT)]);

    expect(html).toContain(ESCAPED_MARKUP_TEXT);
  });

  it("escapes & and < in the preheader", async () => {
    const html = await compileContent((content) => {
      content.settings.preheaderText = MARKUP_TEXT;
    });

    expect(html).toContain(ESCAPED_MARKUP_TEXT);
  });
});
