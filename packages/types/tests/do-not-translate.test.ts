import { describe, expect, it } from "vitest";
import {
  applyLocaleStrings,
  applyOperations,
  createDefaultTemplateContent,
  createParagraphBlock,
  createWrapperBlock,
  decodeHtmlEntities,
  localeStrings,
  maskTags,
  sourceHash,
  SYNTAX_PRESETS,
  unmaskTags,
} from "../src";

const syntax = SYNTAX_PRESETS.liquid;
const options = { syntax, only: "all" as const, doNotTranslate: ["Sable"] };

function fixture() {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = [
    createParagraphBlock({ id: "p", content: "<p>Try Sable today</p>" }),
  ];
  return content;
}

describe("do-not-translate masking", () => {
  it("matches case-sensitive whole words, including before an apostrophe", () => {
    expect(
      maskTags(
        "Try Templatical today; Templatical's; templatical; Templaticals",
        syntax,
        "text",
        {
          doNotTranslate: ["Templatical"],
        },
      ),
    ).toEqual({
      text: 'Try <x id="1"/> today; <x id="2"/>\'s; templatical; Templaticals',
      tokens: ["Templatical", "Templatical"],
    });
  });

  it("treats Unicode letters, numbers and underscores as word characters", () => {
    expect(
      maskTags(
        "Frau Müller. üMüller Müllerü 2Müller Müller2 _Müller Müller_",
        syntax,
        "text",
        {
          doNotTranslate: ["Müller"],
        },
      ),
    ).toEqual({
      text: 'Frau <x id="1"/>. üMüller Müllerü 2Müller Müller2 _Müller Müller_',
      tokens: ["Müller"],
    });
  });

  it("trims and escapes terms and chooses the longest non-overlapping match", () => {
    const text = "Templatical Cloud, Templatical and C++ [Acme].";
    const masked = maskTags(text, syntax, "text", {
      doNotTranslate: [" Templatical ", "Templatical Cloud", "C++", "[Acme]"],
    });
    expect(masked).toEqual({
      text: '<x id="1"/>, <x id="2"/> and <x id="3"/> <x id="4"/>.',
      tokens: ["Templatical Cloud", "Templatical", "C++", "[Acme]"],
    });
    expect(unmaskTags(masked.text, masked.tokens)).toBe(text);
  });

  it("lets raw tags and whole chips win over overlapping terms", () => {
    const chip = '<span data-merge-tag="{{name}}">Acme</span>';
    expect(
      maskTags(
        `{{templatical_url}} {% if Acme %}${chip} Acme`,
        syntax,
        "html",
        {
          doNotTranslate: ["templatical_url", "Acme"],
        },
      ),
    ).toEqual({
      text: '<x id="1"/> <x id="2"/><x id="3"/> <x id="4"/>',
      tokens: ["{{templatical_url}}", "{% if Acme %}", chip, "Acme"],
    });
  });

  it("shares source-order ids with tags and uses attribute placeholders only in values", () => {
    expect(
      maskTags('{{first_name}}<a title="Acme">Acme</a>', syntax, "html", {
        doNotTranslate: ["Acme"],
      }),
    ).toEqual({
      text: '<x id="1"/><a title="__x2__"><x id="3"/></a>',
      tokens: ["{{first_name}}", "Acme", "Acme"],
    });
    expect(
      maskTags('<Acme Acme="Acme" title=Acme>Acme</Acme>', syntax, "html", {
        doNotTranslate: ["Acme"],
      }),
    ).toEqual({
      text: '<Acme Acme="__x1__" title=__x2__><x id="3"/></Acme>',
      tokens: ["Acme", "Acme", "Acme"],
    });
  });
});

describe("do-not-translate strings round trip", () => {
  it("masks terms and restores their original bytes in text and attributes", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({
        id: "p",
        content: '<p title="Sable">Try Sable today</p>',
      }),
    ];
    const extracted = localeStrings(content, "de", options);
    expect(extracted.strings[0].source).toBe(
      '<p title="__x1__">Try <x id="2"/> today</p>',
    );
    const result = applyLocaleStrings(
      content,
      "de",
      [
        {
          id: "p/content",
          text: '<p title="__x1__">Heute <x id="2"/> testen</p>',
          sourceHash: extracted.strings[0].sourceHash,
        },
      ],
      { ...options, tokens: extracted.tokens },
    );
    expect(result.rejected).toEqual([]);
    expect(
      applyOperations(content, result.operations).blocks[0].l10n?.de.text
        ?.content,
    ).toEqual({
      value: '<p title="Sable">Heute Sable testen</p>',
      sourceHash: sourceHash('<p title="Sable">Try Sable today</p>'),
    });
  });

  it("rejects a missing term placeholder as tags_changed", () => {
    const content = fixture();
    const extracted = localeStrings(content, "de", options);
    const result = applyLocaleStrings(
      content,
      "de",
      [
        {
          id: "p/content",
          text: "<p>Heute Zobel testen</p>",
          sourceHash: extracted.strings[0].sourceHash,
        },
      ],
      { ...options, tokens: extracted.tokens },
    );
    expect(result).toEqual({
      operations: [],
      rejected: [{ id: "p/content", reason: "tags_changed" }],
    });
  });

  it("checks terms again after restoring placeholders", () => {
    const content = fixture();
    const extracted = localeStrings(content, "de", options);
    expect(extracted.tokens["p/content"]).toEqual(["Sable"]);
    const result = applyLocaleStrings(
      content,
      "de",
      [
        {
          id: "p/content",
          text: '<p><x id="1"/> Sable</p>',
          sourceHash: extracted.strings[0].sourceHash,
        },
      ],
      { ...options, tokens: extracted.tokens },
    );
    expect(result).toEqual({
      operations: [],
      rejected: [{ id: "p/content", reason: "tags_changed" }],
    });
  });

  it("reuses source ids in a reordered existing translation", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({
        id: "p",
        content: "<p>Sable {{name}} Sable</p>",
        l10n: {
          de: {
            text: {
              content: {
                value: "<p>{{name}} Sable Sable</p>",
                sourceHash: "old",
              },
            },
          },
        },
      }),
    ];
    const extracted = localeStrings(content, "de", options);
    expect(extracted.strings[0]).toMatchObject({
      source: '<p><x id="1"/> <x id="2"/> <x id="3"/></p>',
      text: '<p><x id="2"/> <x id="1"/> <x id="3"/></p>',
    });
  });

  it("protects terms in wrapper children and settings", () => {
    const content = fixture();
    content.settings.preheaderText = "Try Sable";
    content.blocks = [
      createWrapperBlock({ id: "wrapper", children: content.blocks }),
    ];
    const extracted = localeStrings(content, "de", options);
    expect(extracted.strings.map(({ source }) => source)).toEqual([
      '<p>Try <x id="1"/> today</p>',
      'Try <x id="1"/>',
    ]);
    const result = applyLocaleStrings(
      content,
      "de",
      extracted.strings.map((field) => ({
        id: field.id,
        text: field.source.replace("Try", "Teste"),
        sourceHash: field.sourceHash,
      })),
      { ...options, tokens: extracted.tokens },
    );
    expect(result.rejected).toEqual([]);
    expect(result.operations).toMatchObject([
      {
        op: "updateBlockLocale",
        blockId: "p",
        text: { content: { value: "<p>Teste Sable today</p>" } },
      },
      {
        op: "updateSettingsLocale",
        text: { preheaderText: { value: "Teste Sable" } },
      },
    ]);
  });
});

describe("do-not-translate HTML entities", () => {
  it.each(["AT&amp;T", "AT&#38;T", "AT&#x26;T"])(
    "protects decoded AT&T in %s and restores the encoded bytes",
    (encoded) => {
      const html = `<p>Try ${encoded}</p>`;
      const masked = maskTags(html, syntax, "html", {
        doNotTranslate: ["AT&T"],
      });
      expect(masked).toEqual({
        text: '<p>Try <x id="1"/></p>',
        tokens: [encoded],
      });
      expect(unmaskTags(masked.text, masked.tokens)).toBe(html);
      expect(
        maskTags(encoded, syntax, "text", { doNotTranslate: ["AT&T"] }),
      ).toEqual({
        text: encoded,
        tokens: [],
      });
    },
  );

  it.each(["M&uuml;ller", "M&#252;ller", "M&#xFC;ller"])(
    "protects Müller in %s without changing its encoding",
    (encoded) => {
      const html = `<p>Frau ${encoded}.</p>`;
      const masked = maskTags(html, syntax, "html", {
        doNotTranslate: ["Müller"],
      });
      expect(masked).toEqual({
        text: '<p>Frau <x id="1"/>.</p>',
        tokens: [encoded],
      });
      expect(unmaskTags(masked.text, masked.tokens)).toBe(html);
    },
  );

  it("matches literal amp words without matching entity syntax", () => {
    expect(
      maskTags("<p>&amp; amp</p>", syntax, "html", { doNotTranslate: ["amp"] }),
    ).toEqual({
      text: '<p>&amp; <x id="1"/></p>',
      tokens: ["amp"],
    });
    expect(
      maskTags("&amp; amp", syntax, "text", { doNotTranslate: ["amp"] }),
    ).toEqual({
      text: '&<x id="1"/>; <x id="2"/>',
      tokens: ["amp", "amp"],
    });
  });

  it("uses quote-safe attribute tokens and shares ids with tags and text", () => {
    const html = '{{name}}<a title="AT&amp;T">AT&#38;T</a>';
    const masked = maskTags(html, syntax, "html", { doNotTranslate: ["AT&T"] });
    expect(masked).toEqual({
      text: '<x id="1"/><a title="__x2__"><x id="3"/></a>',
      tokens: ["{{name}}", "AT&amp;T", "AT&#38;T"],
    });
    expect(unmaskTags(masked.text, masked.tokens)).toBe(html);
  });

  it("checks word boundaries against decoded spaces and Unicode letters", () => {
    expect(
      maskTags(
        "<p>&nbsp;Templatical&nbsp; Templatical&uuml;</p>",
        syntax,
        "html",
        {
          doNotTranslate: ["Templatical"],
        },
      ),
    ).toEqual({
      text: '<p>&nbsp;<x id="1"/>&nbsp; Templatical&uuml;</p>',
      tokens: ["Templatical"],
    });
  });

  it("decodes named references from the Latin-1, symbol/Greek and special sets", () => {
    const encoded =
      "M&Uuml;LLER &eacute; &copy;&reg;&trade; &mdash;&hellip; &Alpha;&alpha; &quot;";
    const masked = maskTags(`<p>${encoded}</p>`, syntax, "html", {
      doNotTranslate: ["MÜLLER", "é", "©®™", "—…", "Αα", '"'],
    });
    expect(masked).toEqual({
      text: '<p><x id="1"/> <x id="2"/> <x id="3"/> <x id="4"/> <x id="5"/> <x id="6"/></p>',
      tokens: [
        "M&Uuml;LLER",
        "&eacute;",
        "&copy;&reg;&trade;",
        "&mdash;&hellip;",
        "&Alpha;&alpha;",
        "&quot;",
      ],
    });
    expect(unmaskTags(masked.text, masked.tokens)).toBe(`<p>${encoded}</p>`);
  });

  it("maps supplementary numeric characters and surrounding offsets without splitting references", () => {
    const html = "<p>😀 AT&#x26;T &#x1F600;</p>";
    const masked = maskTags(html, syntax, "html", {
      doNotTranslate: ["😀", "AT&T"],
    });
    expect(masked).toEqual({
      text: '<p><x id="1"/> <x id="2"/> <x id="3"/></p>',
      tokens: ["😀", "AT&#x26;T", "&#x1F600;"],
    });
    expect(unmaskTags(masked.text, masked.tokens)).toBe(html);
  });

  it("keeps unknown references literal and never starts or ends a match inside them", () => {
    const html = "<p>&unknown; unknown AT&amp;T</p>";
    const masked = maskTags(html, syntax, "html", {
      doNotTranslate: ["unknown", "AT&T"],
    });
    expect(masked).toEqual({
      text: '<p>&unknown; <x id="1"/> <x id="2"/></p>',
      tokens: ["unknown", "AT&amp;T"],
    });
    expect(unmaskTags(masked.text, masked.tokens)).toBe(html);
  });

  it("keeps unknown case variants literal rather than decoding them as known names", () => {
    expect(
      maskTags("<p>AT&aMp;T AT&amp;T</p>", syntax, "html", {
        doNotTranslate: ["AT&T"],
      }),
    ).toEqual({
      text: '<p>AT&aMp;T <x id="1"/></p>',
      tokens: ["AT&amp;T"],
    });
    expect(decodeHtmlEntities("&constructor; &unknown; &aMp;")).toBe(
      "&constructor; &unknown; &aMp;",
    );
  });

  it("rejects a returned field that drops an entity-encoded protected term", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({
        id: "p",
        content: '<p title="AT&amp;T">Try AT&amp;T</p>',
      }),
    ];
    const config = { ...options, doNotTranslate: ["AT&T"] };
    const extracted = localeStrings(content, "de", config);
    const result = applyLocaleStrings(
      content,
      "de",
      [
        {
          id: "p/content",
          text: '<p title="Other">Teste Other</p>',
          sourceHash: extracted.strings[0].sourceHash,
        },
      ],
      { ...config, tokens: extracted.tokens },
    );
    expect(result).toEqual({
      operations: [],
      rejected: [{ id: "p/content", reason: "tags_changed" }],
    });
  });

  it("reuses the source ids across different entity spellings in an existing translation", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({
        id: "p",
        content: '<p title="AT&amp;T">AT&amp;T {{name}} M&#252;ller</p>',
        l10n: {
          de: {
            text: {
              content: {
                value: '<p title="AT&#38;T">M&uuml;ller {{name}} AT&T</p>',
                sourceHash: "old",
              },
            },
          },
        },
      }),
    ];
    const config = { ...options, doNotTranslate: ["AT&T", "Müller"] };
    const extracted = localeStrings(content, "de", config);
    expect(extracted.strings[0]).toMatchObject({
      source: '<p title="__x1__"><x id="2"/> <x id="3"/> <x id="4"/></p>',
      text: '<p title="__x1__"><x id="4"/> <x id="3"/> <x id="2"/></p>',
    });
    expect(extracted.tokens["p/content"]).toEqual([
      "AT&amp;T",
      "AT&amp;T",
      "{{name}}",
      "M&#252;ller",
    ]);
    const result = applyLocaleStrings(
      content,
      "de",
      [
        {
          id: "p/content",
          text: extracted.strings[0].text!,
          sourceHash: extracted.strings[0].sourceHash,
        },
      ],
      { ...config, tokens: extracted.tokens },
    );
    expect(result.rejected).toEqual([]);
    expect(result.operations).toMatchObject([
      {
        text: {
          content: {
            value: '<p title="AT&amp;T">M&#252;ller {{name}} AT&amp;T</p>',
          },
        },
      },
    ]);
  });

  it("rechecks decoded protected terms after restoring source bytes", () => {
    const content = fixture();
    content.blocks = [
      createParagraphBlock({ id: "p", content: "<p>M&uuml;ller</p>" }),
    ];
    const config = { ...options, doNotTranslate: ["Müller"] };
    const extracted = localeStrings(content, "de", config);
    expect(extracted.tokens["p/content"]).toEqual(["M&uuml;ller"]);
    const result = applyLocaleStrings(
      content,
      "de",
      [
        {
          id: "p/content",
          text: '<p><x id="1"/> M&#252;ller</p>',
          sourceHash: extracted.strings[0].sourceHash,
        },
      ],
      { ...config, tokens: extracted.tokens },
    );
    expect(result).toEqual({
      operations: [],
      rejected: [{ id: "p/content", reason: "tags_changed" }],
    });
  });
});

describe("uppercase entity aliases", () => {
  it.each([
    ["text", "<p>AT&AMP;T</p>", '<p><x id="1"/></p>'],
    [
      "attribute",
      '<p title="AT&AMP;T">Other</p>',
      '<p title="__x1__">Other</p>',
    ],
  ])("masks and restores the original bytes in %s", (_label, html, masked) => {
    const result = maskTags(html, syntax, "html", { doNotTranslate: ["AT&T"] });
    expect(result).toEqual({ text: masked, tokens: ["AT&AMP;T"] });
    expect(unmaskTags(result.text, result.tokens)).toBe(html);
  });

  it.each([
    ["text", "<p>AT&AMP;T</p>", "<p>AT&amp;T</p>", '<p><x id="1"/></p>'],
    [
      "attribute",
      '<p title="AT&AMP;T">Other</p>',
      '<p title="AT&amp;T">Other</p>',
      '<p title="__x1__">Other</p>',
    ],
  ])(
    "reuses the source id for an existing %s translation",
    (_label, html, translated, masked) => {
      const content = fixture();
      content.blocks = [
        createParagraphBlock({
          id: "p",
          content: html,
          l10n: {
            de: {
              text: {
                content: { value: translated, sourceHash: sourceHash(html) },
              },
            },
          },
        }),
      ];
      const config = { ...options, doNotTranslate: ["AT&T"] };
      const extracted = localeStrings(content, "de", config);
      expect(extracted.strings[0]).toMatchObject({
        source: masked,
        text: masked,
      });
      expect(extracted.tokens["p/content"]).toEqual(["AT&AMP;T"]);
      const result = applyLocaleStrings(
        content,
        "de",
        [
          {
            id: "p/content",
            text: extracted.strings[0].text!,
            sourceHash: extracted.strings[0].sourceHash,
          },
        ],
        { ...config, tokens: extracted.tokens },
      );
      expect(result.rejected).toEqual([]);
      expect(result.operations).toMatchObject([
        { text: { content: { value: html } } },
      ]);
    },
  );

  it.each([
    ["text", "<p>AT&AMP;T</p>", "<p>Other</p>"],
    [
      "attribute",
      '<p title="AT&AMP;T">Other</p>',
      '<p title="Other">Other</p>',
    ],
  ])("rejects a removed %s placeholder", (_label, html, translated) => {
    const content = fixture();
    content.blocks = [createParagraphBlock({ id: "p", content: html })];
    const config = { ...options, doNotTranslate: ["AT&T"] };
    const extracted = localeStrings(content, "de", config);
    const result = applyLocaleStrings(
      content,
      "de",
      [
        {
          id: "p/content",
          text: translated,
          sourceHash: sourceHash(html),
        },
      ],
      { ...config, tokens: extracted.tokens },
    );
    expect(result).toEqual({
      operations: [],
      rejected: [{ id: "p/content", reason: "tags_changed" }],
    });
  });

  it("compares unsupported named references as written rather than decoding HTML5 names", () => {
    const html = "<p>&NotEqualTilde; &AMP;</p>";
    const result = maskTags(html, syntax, "html", {
      doNotTranslate: ["&NotEqualTilde;", "&"],
    });
    expect(result).toEqual({
      text: '<p><x id="1"/> <x id="2"/></p>',
      tokens: ["&NotEqualTilde;", "&AMP;"],
    });
    expect(unmaskTags(result.text, result.tokens)).toBe(html);
    expect(decodeHtmlEntities("&NotEqualTilde; &aMp;")).toBe(
      "&NotEqualTilde; &aMp;",
    );
  });
});

it("masks apos-encoded terms and restores their original HTML bytes", () => {
  const html = "<p>Try Rock &apos;n&apos; Roll</p>";
  const result = maskTags(html, syntax, "html", {
    doNotTranslate: ["Rock 'n' Roll"],
  });
  expect(result).toEqual({
    text: '<p>Try <x id="1"/></p>',
    tokens: ["Rock &apos;n&apos; Roll"],
  });
  expect(unmaskTags(result.text, result.tokens)).toBe(html);
});

it("decodes apos while keeping unsupported case variants literal", () => {
  expect(
    maskTags("<p>O&apos;Reilly &AMP;</p>", syntax, "html", {
      doNotTranslate: ["O'Reilly", "&"],
    }),
  ).toEqual({
    text: '<p><x id="1"/> <x id="2"/></p>',
    tokens: ["O&apos;Reilly", "&AMP;"],
  });
  expect(decodeHtmlEntities("&apos;")).toBe("'");
  expect(decodeHtmlEntities("&APOS; &Apos;")).toBe("&APOS; &Apos;");
});
