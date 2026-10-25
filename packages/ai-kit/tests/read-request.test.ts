import { describe, expect, it } from "vitest";
import { readAiRequest, SdkError } from "../src/server";

const content = { blocks: [], settings: { width: 600 } };

function post(path: string, body: unknown, session = "s-1"): Request {
  return new Request(`https://api.example.com/ai${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Templatical-AI-Wire": "1",
      "X-Templatical-Session": session,
    },
    body: JSON.stringify(body),
  });
}

describe("readAiRequest", () => {
  it("refuses a non-JSON body on a JSON route with 422", async () => {
    const request = new Request(post("/templates/t-1/ai/rewrite-text", {}), {
      body: "this is not JSON",
    });
    await expect(readAiRequest(request)).rejects.toMatchObject({
      name: "SdkError",
      statusCode: 422,
      message: "Send a JSON body.",
    });
  });
  it("reads a chat turn", async () => {
    expect(
      await readAiRequest(
        post("/templates/t-1/ai/generate", {
          message: "Hi",
          selectedBlockId: null,
          mergeTags: { syntax: "liquid" as const, tags: [] },
          content,
          revision: null,
        }),
      ),
    ).toEqual({
      route: "generate",
      template: "t-1",
      sessionId: "s-1",
      body: {
        message: "Hi",
        selectedBlockId: null,
        mergeTags: { syntax: "liquid" as const, tags: [] },
        content,
        revision: null,
        attachments: [],
      },
    });
  });

  it.each([
    [
      "/templates/t-1/ai/generate",
      {
        message: "",
        selectedBlockId: null,
        mergeTags: { syntax: "liquid" as const, tags: [] },
        content,
        revision: null,
      },
      "The message must be 1 to 4,000 characters.",
    ],
    [
      "/templates/t-1/ai/rewrite-text",
      {
        html: "<p>x</p>",
        preset: null,
        language: null,
        instruction: null,
        mergeTags: { syntax: "liquid" as const, tags: [] },
      },
      "Choose a preset or write an instruction.",
    ],
    [
      "/templates/t-1/ai/rewrite-text",
      {
        html: "<p>x</p>",
        preset: "translate",
        language: null,
        instruction: null,
        mergeTags: { syntax: "liquid" as const, tags: [] },
      },
      "Choose a language to translate into.",
    ],
  ])("refuses a bad %s body with a 422", async (path, body, message) => {
    await expect(readAiRequest(post(path, body))).rejects.toMatchObject({
      name: "SdkError",
      statusCode: 422,
      message,
    });
  });

  it("answers null for a request that isn't the wire's", async () => {
    expect(await readAiRequest(new Request("https://x.test/health"))).toBe(
      null,
    );
  });
});

describe("readAiRequest merge-tag field validation", () => {
  const tag = { value: "{{first_name}}", label: "First name" };

  it.each([
    ["a null entry", null],
    ["a scalar entry", 7],
    ["an array entry", []],
    ["a missing value", { label: "First name" }],
    ["a non-string value", { ...tag, value: 7 }],
    ["a 201-character value", { ...tag, value: "v".repeat(201) }],
    ["a missing label", { value: "{{first_name}}" }],
    ["a non-string label", { ...tag, label: null }],
    ["a 101-character label", { ...tag, label: "l".repeat(101) }],
    ["a non-string group", { ...tag, group: null }],
    ["a 101-character group", { ...tag, group: "g".repeat(101) }],
    ["a non-string description", { ...tag, description: 7 }],
    ["a 201-character description", { ...tag, description: "d".repeat(201) }],
  ])("rejects %s with 422", async (_name, entry) => {
    await expect(
      readAiRequest(
        post("/templates/t-1/ai/generate", {
          message: "Hi",
          content,
          mergeTags: { syntax: "liquid", tags: [entry] },
        }),
      ),
    ).rejects.toMatchObject({ name: "SdkError", statusCode: 422 });
  });

  it("rejects an unknown syntax with 422", async () => {
    await expect(
      readAiRequest(
        post("/templates/t-1/ai/generate", {
          message: "Hi",
          content,
          mergeTags: { syntax: "unknown", tags: [tag] },
        }),
      ),
    ).rejects.toMatchObject({ name: "SdkError", statusCode: 422 });
  });

  it.each(["liquid", "handlebars", "mailchimp", "ampscript", "custom"])(
    "accepts %s and metadata at the string limits (guard)",
    async (syntax) => {
      const mergeTags = {
        syntax,
        tags: [
          {
            value: "v".repeat(200),
            label: "l".repeat(100),
            group: "g".repeat(100),
            description: "d".repeat(200),
          },
        ],
      };
      expect(
        await readAiRequest(
          post("/templates/t-1/ai/generate", {
            message: "Hi",
            content,
            mergeTags,
          }),
        ),
      ).toMatchObject({ route: "generate", body: { mergeTags } });
    },
  );

  it("keeps the 500-tag cap (guard)", async () => {
    const body = {
      message: "Hi",
      content,
      mergeTags: { syntax: "liquid", tags: Array(500).fill(tag) },
    };
    const result = await readAiRequest(
      post("/templates/t-1/ai/generate", body),
    );
    expect(
      result?.route === "generate" && result.body.mergeTags?.tags,
    ).toHaveLength(500);
    await expect(
      readAiRequest(
        post("/templates/t-1/ai/generate", {
          ...body,
          mergeTags: { syntax: "liquid", tags: Array(501).fill(tag) },
        }),
      ),
    ).rejects.toMatchObject({ name: "SdkError", statusCode: 422 });
  });
});

const lintFinding = {
  ruleId: "a11y.text-all-caps",
  message: "All caps.",
  suggestion: "Use sentence case.",
  reference: "https://docs.templatical.com/quality/",
  blockId: null,
};

describe("readAiRequest fix-finding field validation", () => {
  const read = (finding: unknown) =>
    readAiRequest(
      post("/templates/t-1/ai/fix-finding", {
        content,
        mergeTags: { syntax: "liquid" as const, tags: [] },
        revision: null,
        finding,
      }),
    );
  it.each([
    ["ruleId", "", "finding.ruleId must be 1 to 200 characters."],
    ["ruleId", "r".repeat(201), "finding.ruleId must be 1 to 200 characters."],
    [
      "message",
      "m".repeat(1001),
      "finding.message must be at most 1,000 code points.",
    ],
    [
      "suggestion",
      "s".repeat(1001),
      "finding.suggestion must be at most 1,000 code points.",
    ],
    [
      "reference",
      "https://example.com/" + "x".repeat(2048),
      "finding.reference must be an http: or https: URL of at most 2,048 characters.",
    ],
    [
      "reference",
      "ftp://example.com/",
      "finding.reference must be an http: or https: URL of at most 2,048 characters.",
    ],
    [
      "reference",
      "not a URL",
      "finding.reference must be an http: or https: URL of at most 2,048 characters.",
    ],
    [
      "reference",
      "",
      "finding.reference must be an http: or https: URL of at most 2,048 characters.",
    ],
    [
      "blockId",
      "b".repeat(201),
      "finding.blockId must be a string of at most 200 characters or null.",
    ],
    [
      "excerpt",
      "😀".repeat(1001),
      "finding.excerpt must be at most 1,000 code points when present.",
    ],
  ])("refuses invalid %s without truncating", async (field, value, message) => {
    await expect(
      read({ ...lintFinding, [field]: value }),
    ).rejects.toMatchObject({
      name: "SdkError",
      statusCode: 422,
      code: undefined,
      message,
    });
  });
  it.each([
    "ruleId",
    "message",
    "suggestion",
    "reference",
    "blockId",
    "excerpt",
  ])("rejects a non-string %s", async (field) => {
    await expect(read({ ...lintFinding, [field]: 7 })).rejects.toMatchObject({
      name: "SdkError",
      statusCode: 422,
      code: undefined,
      message:
        field === "ruleId"
          ? "finding.ruleId must be 1 to 200 characters."
          : field === "reference"
            ? "finding.reference must be an http: or https: URL of at most 2,048 characters."
            : field === "blockId"
              ? "finding.blockId must be a string of at most 200 characters or null."
              : field === "excerpt"
                ? "finding.excerpt must be at most 1,000 code points when present."
                : `finding.${field} must be at most 1,000 code points.`,
    });
  });
  it.each([
    ["null", null],
    ["array", []],
    ["scalar", 7],
  ])("rejects a non-object finding %s", async (_label, finding) => {
    await expect(read(finding)).rejects.toMatchObject({
      name: "SdkError",
      statusCode: 422,
      code: undefined,
      message:
        "finding must be { ruleId, message, suggestion, reference, blockId, excerpt? }.",
    });
  });
  it("preserves every field exactly at its limit, counting diagnostic prose in code points", async () => {
    const atLimits = {
      ruleId: "r".repeat(200),
      message: "😀".repeat(1000),
      suggestion: "😀".repeat(1000),
      reference: "https://example.com/" + "x".repeat(2028),
      blockId: "b".repeat(200),
      excerpt: "😀".repeat(1000),
    };
    expect(atLimits.reference).toHaveLength(2048);
    expect(await read(atLimits)).toMatchObject({
      route: "fixFinding",
      body: { finding: atLimits },
    });
  });
  it.each(["http://example.com/", "https://example.com/"])(
    "accepts %s, null block and an absent excerpt",
    async (reference) => {
      const result = await read({ ...lintFinding, reference });
      expect(result).toMatchObject({
        route: "fixFinding",
        body: { finding: { ...lintFinding, reference } },
      });
      if (result?.route !== "fixFinding")
        throw new Error("Expected fixFinding");
      expect(result.body.finding).not.toHaveProperty("excerpt");
    },
  );
  it.each(["ruleId", "message", "suggestion", "reference", "blockId"])(
    "refuses a missing %s",
    async (field) => {
      const finding: Record<string, unknown> = { ...lintFinding };
      delete finding[field];
      const messages: Record<string, string> = {
        ruleId: "finding.ruleId must be 1 to 200 characters.",
        message: "finding.message must be at most 1,000 code points.",
        suggestion: "finding.suggestion must be at most 1,000 code points.",
        reference:
          "finding.reference must be an http: or https: URL of at most 2,048 characters.",
        blockId:
          "finding.blockId must be a string of at most 200 characters or null.",
      };
      await expect(read(finding)).rejects.toMatchObject({
        name: "SdkError",
        statusCode: 422,
        code: undefined,
        message: messages[field],
      });
    },
  );
});

describe("readAiRequest language field validation", () => {
  it.each(["!!!", " ", "p", "pt_BR", "pt-", "eng-123456789"])(
    "rejects malformed language %j with 422",
    async (language) => {
      await expect(
        readAiRequest(
          post("/templates/t-1/ai/rewrite-text", {
            html: "<p>Hi</p>",
            preset: "translate",
            language,
            instruction: null,
            mergeTags: { syntax: "liquid" as const, tags: [] },
          }),
        ),
      ).rejects.toMatchObject({
        name: "SdkError",
        statusCode: 422,
        message: "language must be a BCP 47 tag.",
      });
    },
  );

  it("accepts pt-BR (guard)", async () => {
    expect(
      await readAiRequest(
        post("/templates/t-1/ai/rewrite-text", {
          html: "<p>Hi</p>",
          preset: "translate",
          language: "pt-BR",
          instruction: null,
          mergeTags: { syntax: "liquid" as const, tags: [] },
        }),
      ),
    ).toMatchObject({ route: "rewriteText", body: { language: "pt-BR" } });
  });

  it("accepts a language matching the required shape beyond the old length cap", async () => {
    expect(
      await readAiRequest(
        post("/templates/t-1/ai/rewrite-text", {
          html: "<p>Hi</p>",
          preset: "translate",
          language: "en-Latn-US-variant1-variant2-variant3",
          instruction: null,
          mergeTags: { syntax: "liquid" as const, tags: [] },
        }),
      ),
    ).toMatchObject({
      route: "rewriteText",
      body: { language: "en-Latn-US-variant1-variant2-variant3" },
    });
  });
});

it("reads replay settlement and refuses malformed outcomes", async () => {
  expect(
    await readAiRequest(
      post("/templates/t/ai/messages/m/replays/r", {
        direction: "undo",
        applied: false,
      }),
    ),
  ).toEqual({
    route: "settleReplay",
    template: "t",
    message: "m",
    replayId: "r",
    sessionId: "s-1",
    body: { direction: "undo", applied: false },
  });
  await expect(
    readAiRequest(
      post("/templates/t/ai/messages/m/replays/r", {
        direction: "other",
        applied: true,
      }),
    ),
  ).rejects.toMatchObject({ statusCode: 422 });
  await expect(
    readAiRequest(
      post("/templates/t/ai/messages/m/replays/r", {
        direction: "undo",
        applied: "true",
      }),
    ),
  ).rejects.toMatchObject({ statusCode: 422 });
});

describe("final fix: request boundaries", () => {
  it.each(["generate", "fix-finding"])(
    "caps serialized content bytes on %s",
    async (route) => {
      const content = {
        blocks: [],
        settings: { padding: "é".repeat(100_000) },
      };
      await expect(
        readAiRequest(
          post(`/templates/t/ai/${route}`, { mergeTags: { syntax: "liquid", tags: [] },
            message: "Hi",
            selectedBlockId: null,
            content,
            finding: {
              ...lintFinding,
            },
          }),
        ),
      ).rejects.toMatchObject({
        statusCode: 413,
        code: "content_too_large",
        message: "This template is too large for AI.",
      });
    },
  );
  it("accepts exactly 200,000 UTF-8 content bytes and refuses the next byte", async () => {
    const content = { blocks: [], settings: { padding: "" } };
    content.settings.padding = "x".repeat(
      200_000 - new TextEncoder().encode(JSON.stringify(content)).length,
    );
    expect(
      await readAiRequest(
        post("/templates/t/ai/generate", { mergeTags: { syntax: "liquid", tags: [] },  message: "Hi", content }),
      ),
    ).toMatchObject({ route: "generate" });
    content.settings.padding += "x";
    await expect(
      readAiRequest(
        post("/templates/t/ai/generate", { mergeTags: { syntax: "liquid", tags: [] },  message: "Hi", content }),
      ),
    ).rejects.toMatchObject({ statusCode: 413, code: "content_too_large" });
  });
  it.each(["session", "selected"])(
    "caps the %s id at 200 characters",
    async (kind) => {
      const body = {
        message: "Hi",
        content,
        selectedBlockId: kind === "selected" ? "x".repeat(201) : null,
      };
      await expect(
        readAiRequest(
          post(
            "/templates/t/ai/generate",
            body,
            kind === "session" ? "s".repeat(201) : "s",
          ),
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
    },
  );
  it("counts every string boundary in code points", async () => {
    const emoji = "😀";
    expect(
      await readAiRequest(
        post(
          "/templates/t/ai/generate",
          {
            message: emoji.repeat(4000),
            content,
            selectedBlockId: emoji.repeat(200),
            mergeTags: {
              syntax: "custom",
              tags: [
                {
                  value: emoji.repeat(200),
                  label: emoji.repeat(100),
                  group: emoji.repeat(100),
                  description: emoji.repeat(200),
                },
              ],
            },
          },
          "s".repeat(200),
        ),
      ),
    ).toMatchObject({ route: "generate" });
    expect(
      await readAiRequest(
        post("/templates/t/ai/fix-finding", { mergeTags: { syntax: "liquid", tags: [] },
          content,
          finding: {
            ...lintFinding,
            message: emoji.repeat(1000),
            suggestion: emoji.repeat(1000),
          },
        }),
      ),
    ).toMatchObject({ route: "fixFinding" });
    expect(
      await readAiRequest(
        post("/templates/t/ai/rewrite-text", { mergeTags: { syntax: "liquid", tags: [] },
          html: emoji.repeat(20_000),
          instruction: emoji.repeat(500),
        }),
      ),
    ).toMatchObject({ route: "rewriteText" });
  });
});

describe("readAiRequest validation messages", () => {
  async function validation(request: Request, message: string): Promise<void> {
    const error = await readAiRequest(request).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(SdkError);
    expect(error).toMatchObject({ statusCode: 422, code: undefined, message });
  }

  it.each([
    ["null", null],
    ["non-object", "template"],
    ["missing blocks", { settings: {} }],
    ["non-list blocks", { blocks: {}, settings: {} }],
    ["missing settings", { blocks: [] }],
    ["non-object settings", { blocks: [], settings: [] }],
  ])(
    "rejects %s content with the exact validation error",
    async (_label, content) => {
      await validation(
        post("/templates/t/ai/generate", { mergeTags: { syntax: "liquid", tags: [] },  message: "Hi", content }),
        "content must be the template's content.",
      );
    },
  );

  it.each([-1, 1.5, "NaN", {}, true])(
    "rejects revision %j with the exact validation error",
    async (revision) => {
      await validation(
        post("/templates/t/ai/generate", { mergeTags: { syntax: "liquid", tags: [] },  message: "Hi", content, revision }),
        "revision must be a whole number or null.",
      );
    },
  );

  it.each([
    ["a non-string instruction", 7],
    ["an oversized instruction", "x".repeat(501)],
  ])(
    "rejects %s with the exact validation error",
    async (_label, instruction) => {
      await validation(
        post("/templates/t/ai/rewrite-text", { mergeTags: { syntax: "liquid", tags: [] },
          html: "<p>Hi</p>",
          preset: "shorten",
          instruction,
        }),
        "The instruction must be at most 500 characters.",
      );
    },
  );

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["non-string", 7],
    ["oversized", "x".repeat(20_001)],
  ])(
    "rejects %s rewrite HTML with the exact validation error",
    async (_label, html) => {
      await validation(
        post("/templates/t/ai/rewrite-text", { mergeTags: { syntax: "liquid", tags: [] },  html, preset: "shorten" }),
        "html must be 1 to 20,000 characters.",
      );
    },
  );

  it("rejects an unknown rewrite preset with the exact validation error", async () => {
    await validation(
      post("/templates/t/ai/rewrite-text", { mergeTags: { syntax: "liquid", tags: [] },
        html: "<p>Hi</p>",
        preset: "poetic",
      }),
      "Unknown preset.",
    );
  });
});

describe("readAiRequest alt text", () => {
  const body = {
    blockId: "image",
    image: { url: "https://example.com/image.png" },
    currentAlt: null,
    linkHref: null,
    nearbyText: "Buy now",
    locale: "en-US",
    maxLength: 125,
  };
  const read = (patch = {}) =>
    readAiRequest(post("/templates/t-1/ai/alt-text", { mergeTags: { syntax: "liquid", tags: [] },  ...body, ...patch }));
  it("reads the exact body and session", async () => {
    expect(await read()).toEqual({
      route: "altText",
      template: "t-1",
      sessionId: "s-1",
      body,
    });
  });
  it("accepts every inclusive boundary and counts nearby text in code points", async () => {
    const boundary = {
      blockId: "b".repeat(200),
      image: { url: "https://x.test/" + "a".repeat(2033) },
      currentAlt: "a".repeat(2048),
      linkHref: "h".repeat(2048),
      nearbyText: "😀".repeat(2000),
      locale: "en-12345678-12345678-12345678-12345",
      maxLength: 1000,
    };
    expect(boundary.image.url).toHaveLength(2048);
    expect(boundary.locale).toHaveLength(35);
    expect(await read(boundary)).toMatchObject({ body: boundary });
    expect(
      await read({
        maxLength: 1,
        image: { url: "http://x.test" },
        currentAlt: "",
        linkHref: "",
      }),
    ).toMatchObject({ body: { maxLength: 1, currentAlt: "", linkHref: "" } });
  });
  it.each([
    [{ blockId: "" }, "blockId must be 1 to 200 characters."],
    [{ blockId: "x".repeat(201) }, "blockId must be 1 to 200 characters."],
    [{ blockId: null }, "blockId must be 1 to 200 characters."],
    ...[
      null,
      {},
      { url: "ftp://x.test/a" },
      { url: "//x.test" },
      { url: "nonsense" },
      { url: "https://x.test/" + "a".repeat(2034) },
    ].map((image) => [
      { image },
      "image.url must be an http: or https: URL of at most 2,048 characters.",
    ]),
    ...["currentAlt", "linkHref"].flatMap((key) =>
      [42, undefined, "x".repeat(2049)].map((value) => [
        { [key]: value },
        `${key} must be a string of at most 2,048 characters or null.`,
      ]),
    ),
    ...[42, undefined, "😀".repeat(2001)].map((nearbyText) => [
      { nearbyText },
      "nearbyText must be at most 2,000 code points.",
    ]),
    ...[
      "",
      "x",
      "en_XX",
      "en-123456789",
      "en-12345678-12345678-12345678-123456",
      42,
    ].map((locale) => [
      { locale },
      "locale must be a BCP 47 tag of at most 35 characters.",
    ]),
    ...[0, 1001, 1.5, "60", null].map((maxLength) => [
      { maxLength },
      "maxLength must be an integer from 1 to 1,000.",
    ]),
  ])("rejects invalid alt-text input %#", async (patch, message) => {
    await expect(read(patch as object)).rejects.toMatchObject({
      name: "SdkError",
      statusCode: 422,
      message,
    });
  });
});

describe("generate multipart attachments", () => {
  const mb = 1024 * 1024;
  function form(files: { type: string; size?: number; name?: string }[] = []) {
    const data = new FormData();
    data.set("message", "Use these references");
    data.set("content", JSON.stringify(content));
    data.set("mergeTags", JSON.stringify({ syntax: "liquid", tags: [] }));
    data.set("revision", "4");
    for (const file of files)
      data.append(
        "attachment",
        new Blob([new Uint8Array(file.size ?? 1)], { type: file.type }),
        file.name ?? "reference.png",
      );
    return data;
  }
  const read = (data: FormData) =>
    readAiRequest(
      new Request("https://x.test/templates/t/ai/generate", {
        method: "POST",
        body: data,
      }),
    );
  it.each([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
  ])("maps %s with the original name and bytes", async (type) => {
    const result = await read(form([{ type, name: "reference", size: 7 }]));
    expect(result).toMatchObject({
      route: "generate",
      body: {
        message: "Use these references",
        selectedBlockId: null,
        revision: 4,
        content,
        mergeTags: { syntax: "liquid" as const, tags: [] },
        attachments: [
          {
            kind: type === "application/pdf" ? "pdf" : "image",
            name: "reference",
          },
        ],
      },
    });
    if (result?.route !== "generate") throw new Error("Expected generate");
    expect(result.body.attachments[0].file.type).toBe(type);
    expect(result.body.attachments[0].file.size).toBe(7);
  });
  it("accepts no attachments and preserves selectedBlockId", async () => {
    const data = form();
    data.set("selectedBlockId", "p1");
    expect(await read(data)).toMatchObject({
      body: { attachments: [], selectedBlockId: "p1" },
    });
  });
  it("accepts four files and inclusive size, total and filename boundaries", async () => {
    const result = await read(
      form([
        { type: "image/png", size: 5 * mb, name: "n".repeat(255) },
        { type: "application/pdf", size: 5 * mb },
        { type: "image/jpeg", size: 0 },
        { type: "image/gif", size: 0 },
      ]),
    );
    expect(
      result?.route === "generate" && result.body.attachments,
    ).toHaveLength(4);
  });
  it("rejects an unparseable multipart form with its exact error", async () => {
    await expect(
      readAiRequest(
        new Request("https://x.test/templates/t/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "multipart/form-data" },
          body: "broken",
        }),
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: undefined,
      message: "Send the message as multipart form data.",
    });
  });
  it.each([
    [
      "count before type",
      Array.from({ length: 5 }, () => ({ type: "text/plain" })),
      "Attach at most 4 files.",
    ],
    [
      "type before size",
      [{ type: "image/svg+xml", size: 5 * mb + 1 }],
      "Attach PNG, JPEG, WebP or GIF images, or PDFs.",
    ],
    [
      "per file before total",
      [
        { type: "image/png", size: 6 * mb },
        { type: "image/png", size: 5 * mb },
      ],
      "Each attachment must be 5 MB or smaller.",
    ],
    [
      "total before name",
      [
        { type: "image/png", size: 5 * mb, name: "n".repeat(256) },
        { type: "image/png", size: 5 * mb },
        { type: "image/png" },
      ],
      "Attachments must be 10 MB or smaller together.",
    ],
    [
      "filename",
      [{ type: "image/png", name: "n".repeat(256) }],
      "An attachment's file name must be at most 255 characters.",
    ],
  ] as const)(
    "refuses %s without truncation",
    async (_label, files, message) => {
      await expect(read(form([...files]))).rejects.toMatchObject({
        name: "SdkError",
        statusCode: 422,
        code: undefined,
        message,
      });
    },
  );
  it("rejects a string attachment part", async () => {
    const data = form();
    data.append("attachment", "file.png");
    await expect(read(data)).rejects.toMatchObject({
      statusCode: 422,
      message: "Attach PNG, JPEG, WebP or GIF images, or PDFs.",
    });
  });
  it.each(["content", "mergeTags"])(
    "keeps %s JSON validation",
    async (field) => {
      const data = form();
      data.set(field, "{broken");
      await expect(read(data)).rejects.toMatchObject({
        statusCode: 422,
        message: `${field} must be JSON.`,
      });
    },
  );
  it("keeps message, revision, selected block, merge tags and content limits", async () => {
    for (const [key, value, message] of [
      ["message", "", "The message must be 1 to 4,000 characters."],
      ["revision", "-1", "revision must be a whole number or null."],
      [
        "selectedBlockId",
        "x".repeat(201),
        "selectedBlockId must be at most 200 characters.",
      ],
    ]) {
      const data = form();
      data.set(key, value);
      await expect(read(data)).rejects.toMatchObject({
        statusCode: 422,
        message,
      });
    }
    const data = form();
    data.set(
      "content",
      JSON.stringify({
        blocks: [],
        settings: { padding: "é".repeat(100_000) },
      }),
    );
    await expect(read(data)).rejects.toMatchObject({
      statusCode: 413,
      code: "content_too_large",
    });
  });
});


describe("required merge-tag context", () => {
  it.each(["generate", "rewrite-text", "fix-finding"])(
    "refuses null and missing mergeTags on %s with 422",
    async (route) => {
      for (const mergeTags of [null, undefined]) {
        await expect(readAiRequest(post(`/templates/t-1/ai/${route}`, {
          message: "Hi", content, html: "<p>Hi</p>", preset: "shorten",
          finding: lintFinding, mergeTags,
        }))).rejects.toMatchObject({
          statusCode: 422,
          message: "mergeTags must be { syntax, tags } with at most 500 tags.",
        });
      }
    },
  );
  it.each(["null", "missing"])("refuses %s mergeTags in multipart", async (value) => {
    const body = new FormData();
    body.set("message", "Hi");
    body.set("content", JSON.stringify(content));
    if (value === "null") body.set("mergeTags", "null");
    await expect(readAiRequest(new Request("https://x.test/templates/t/ai/generate", {
      method: "POST", body,
    }))).rejects.toMatchObject({
      statusCode: 422,
      message: "mergeTags must be { syntax, tags } with at most 500 tags.",
    });
  });
});
