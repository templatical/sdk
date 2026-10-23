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
  it("reads a chat turn", async () => {
    expect(
      await readAiRequest(
        post("/templates/t-1/ai/generate", {
          message: "Hi",
          selectedBlockId: null,
          mergeTags: null,
          content,
          revision: null,
        }),
      ),
    ).toEqual({
      route: "generate",
      template: "t-1",
      sessionId: "s-1",
      body: { message: "Hi", selectedBlockId: null, mergeTags: null, content, revision: null },
    });
  });

  it("reads a design upload", async () => {
    const form = new FormData();
    form.set("image_upload", new Blob(["png"], { type: "image/png" }), "shot.png");
    form.set("content", JSON.stringify(content));
    form.set("mergeTags", "null");
    form.set("revision", "4");
    const read = await readAiRequest(
      new Request("https://x.test/templates/t-1/ai/generate-from-design", {
        method: "POST",
        body: form,
      }),
    );
    expect(read).toMatchObject({
      route: "generateFromDesign",
      body: { prompt: null, fileKind: "image", content, mergeTags: null, revision: 4 },
    });
    expect(read?.route === "generateFromDesign" && read.body.file.type).toBe("image/png");
  });

  it.each([
    [
      "/templates/t-1/ai/generate",
      {
        message: "",
        selectedBlockId: null,
        mergeTags: null,
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
        mergeTags: null,
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
        mergeTags: null,
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
    expect(await readAiRequest(new Request("https://x.test/health"))).toBe(null);
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
        tags: [{
          value: "v".repeat(200),
          label: "l".repeat(100),
          group: "g".repeat(100),
          description: "d".repeat(200),
        }],
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
        mergeTags: null,
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
      await expect(readAiRequest(post("/templates/t-1/ai/rewrite-text", {
        html: "<p>Hi</p>",
        preset: "translate",
        language,
        instruction: null,
        mergeTags: null,
      }))).rejects.toMatchObject({
        name: "SdkError",
        statusCode: 422,
        message: "language must be a BCP 47 tag.",
      });
    },
  );

  it("accepts pt-BR (guard)", async () => {
    expect(await readAiRequest(post("/templates/t-1/ai/rewrite-text", {
      html: "<p>Hi</p>",
      preset: "translate",
      language: "pt-BR",
      instruction: null,
      mergeTags: null,
    }))).toMatchObject({ route: "rewriteText", body: { language: "pt-BR" } });
  });

  it("accepts a language matching the required shape beyond the old length cap", async () => {
    expect(await readAiRequest(post("/templates/t-1/ai/rewrite-text", {
      html: "<p>Hi</p>",
      preset: "translate",
      language: "en-Latn-US-variant1-variant2-variant3",
      instruction: null,
      mergeTags: null,
    }))).toMatchObject({
      route: "rewriteText",
      body: { language: "en-Latn-US-variant1-variant2-variant3" },
    });
  });
});

it("reads replay settlement and refuses malformed outcomes", async () => {
  expect(await readAiRequest(post("/templates/t/ai/messages/m/replays/r", { direction: "undo", applied: false }))).toEqual({ route: "settleReplay", template: "t", message: "m", replayId: "r", sessionId: "s-1", body: { direction: "undo", applied: false } });
  await expect(readAiRequest(post("/templates/t/ai/messages/m/replays/r", { direction: "other", applied: true }))).rejects.toMatchObject({ statusCode: 422 });
  await expect(readAiRequest(post("/templates/t/ai/messages/m/replays/r", { direction: "undo", applied: "true" }))).rejects.toMatchObject({ statusCode: 422 });
});

describe("final fix: request boundaries", () => {
  it.each(["generate", "fix-finding"])(
    "caps serialized content bytes on %s",
    async (route) => {
      const content = { blocks: [], settings: { padding: "é".repeat(100_000) } };
      await expect(
        readAiRequest(
          post(`/templates/t/ai/${route}`, {
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
  it("checks design content bytes too", async () => {
    const form = new FormData();
    form.set("image_upload", new Blob(["png"], { type: "image/png" }));
    form.set("content", JSON.stringify({ blocks: [], settings: { padding: "é".repeat(100_000) } }));
    await expect(readAiRequest(new Request("https://x.test/templates/t/ai/generate-from-design", { method: "POST", body: form }))).rejects.toMatchObject({ statusCode: 413, code: "content_too_large" });
  });
  it("accepts exactly 200,000 UTF-8 content bytes and refuses the next byte", async () => {
    const content = { blocks: [], settings: { padding: "" } };
    content.settings.padding = "x".repeat(200_000 - new TextEncoder().encode(JSON.stringify(content)).length);
    expect(
      await readAiRequest(
        post("/templates/t/ai/generate", { message: "Hi", content }),
      ),
    ).toMatchObject({ route: "generate" });
    content.settings.padding += "x";
    await expect(
      readAiRequest(
        post("/templates/t/ai/generate", { message: "Hi", content }),
      ),
    ).rejects.toMatchObject({ statusCode: 413, code: "content_too_large" });
  });
  it.each(["session", "selected"])("caps the %s id at 200 characters", async (kind) => {
    const body = { message: "Hi", content, selectedBlockId: kind === "selected" ? "x".repeat(201) : null };
    await expect(readAiRequest(post("/templates/t/ai/generate", body, kind === "session" ? "s".repeat(201) : "s"))).rejects.toMatchObject({ statusCode: 422 });
  });
  it("counts every string boundary in code points", async () => {
    const emoji = "😀";
    expect(await readAiRequest(post("/templates/t/ai/generate", { message: emoji.repeat(4000), content, selectedBlockId: emoji.repeat(200), mergeTags: { syntax: "custom", tags: [{ value: emoji.repeat(200), label: emoji.repeat(100), group: emoji.repeat(100), description: emoji.repeat(200) }] } }, "s".repeat(200)))).toMatchObject({ route: "generate" });
    expect(await readAiRequest(post("/templates/t/ai/fix-finding", { content, finding: { ...lintFinding, message: emoji.repeat(1000), suggestion: emoji.repeat(1000) } }))).toMatchObject({ route: "fixFinding" });
    expect(await readAiRequest(post("/templates/t/ai/rewrite-text", { html: emoji.repeat(20_000), instruction: emoji.repeat(500) }))).toMatchObject({ route: "rewriteText" });
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
        post("/templates/t/ai/generate", { message: "Hi", content }),
        "content must be the template's content.",
      );
    },
  );

  it.each([-1, 1.5, "NaN", {}, true])(
    "rejects revision %j with the exact validation error",
    async (revision) => {
      await validation(
        post("/templates/t/ai/generate", { message: "Hi", content, revision }),
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
        post("/templates/t/ai/rewrite-text", {
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
        post("/templates/t/ai/rewrite-text", { html, preset: "shorten" }),
        "html must be 1 to 20,000 characters.",
      );
    },
  );

  it("rejects an unknown rewrite preset with the exact validation error", async () => {
    await validation(
      post("/templates/t/ai/rewrite-text", {
        html: "<p>Hi</p>",
        preset: "poetic",
      }),
      "Unknown preset.",
    );
  });

  it("rejects a non-multipart design request with the exact validation error", async () => {
    await validation(
      post("/templates/t/ai/generate-from-design", { content }),
      "Send the design as multipart form data.",
    );
  });

  it.each([
    "no file",
    "a text file field",
    "both upload fields",
    "unsupported image type",
    "unsupported PDF type",
    "oversized image",
    "malformed content JSON",
    "malformed mergeTags JSON",
    "oversized prompt",
  ])(
    "rejects a design with %s and the exact validation error",
    async (scenario) => {
      const form = new FormData();
      form.set("content", JSON.stringify(content));
      form.set(
        "image_upload",
        new Blob(["png"], { type: "image/png" }),
        "design.png",
      );
      let message: string;
      switch (scenario) {
        case "no file":
          form.delete("image_upload");
          message = "Upload one image or one PDF.";
          break;
        case "a text file field":
          form.set("image_upload", "design.png");
          message = "Upload one image or one PDF.";
          break;
        case "both upload fields":
          form.set(
            "pdf_upload",
            new Blob(["pdf"], { type: "application/pdf" }),
            "design.pdf",
          );
          message = "Upload one image or one PDF.";
          break;
        case "unsupported image type":
          form.set(
            "image_upload",
            new Blob(["svg"], { type: "image/svg+xml" }),
            "design.svg",
          );
          message = "Upload a PNG, JPEG, WebP or GIF image, or a PDF.";
          break;
        case "unsupported PDF type":
          form.delete("image_upload");
          form.set(
            "pdf_upload",
            new Blob(["text"], { type: "text/plain" }),
            "design.txt",
          );
          message = "Upload a PNG, JPEG, WebP or GIF image, or a PDF.";
          break;
        case "oversized image":
          form.set(
            "image_upload",
            new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], {
              type: "image/png",
            }),
            "large.png",
          );
          message = "The file must be 5 MB or smaller.";
          break;
        case "malformed content JSON":
          form.set("content", "{broken");
          message = "content must be JSON.";
          break;
        case "malformed mergeTags JSON":
          form.set("mergeTags", "{broken");
          message = "mergeTags must be JSON.";
          break;
        default:
          form.set("prompt", "x".repeat(2001));
          message = "The prompt must be at most 2,000 characters.";
      }
      await validation(
        new Request("https://x.test/templates/t/ai/generate-from-design", {
          method: "POST",
          body: form,
        }),
        message,
      );
    },
  );

  it("reads a PDF design with omitted optional fields", async () => {
    const form = new FormData();
    form.set(
      "pdf_upload",
      new Blob(["PDF content"], { type: "application/pdf" }),
      "design.pdf",
    );
    form.set("content", JSON.stringify(content));
    const result = await readAiRequest(
      new Request("https://x.test/templates/t/ai/generate-from-design", {
        method: "POST",
        body: form,
      }),
    );

    expect(result).toMatchObject({
      route: "generateFromDesign",
      template: "t",
      sessionId: null,
      body: {
        prompt: null,
        fileKind: "pdf",
        content,
        mergeTags: null,
        revision: null,
      },
    });
    if (result?.route !== "generateFromDesign")
      throw new Error("Expected a design request");
    expect(result.body.file.type).toBe("application/pdf");
    expect(await result.body.file.text()).toBe("PDF content");
  });
});


describe("readAiRequest alt text", () => {
  const body = { blockId: "image", image: { url: "https://example.com/image.png" }, currentAlt: null, linkHref: null, nearbyText: "Buy now", locale: "en-US", maxLength: 125 };
  const read = (patch = {}) => readAiRequest(post("/templates/t-1/ai/alt-text", { ...body, ...patch }));
  it("reads the exact body and session", async () => {
    expect(await read()).toEqual({ route: "altText", template: "t-1", sessionId: "s-1", body });
  });
  it("accepts every inclusive boundary and counts nearby text in code points", async () => {
    const boundary = { blockId: "b".repeat(200), image: { url: "https://x.test/" + "a".repeat(2033) }, currentAlt: "a".repeat(2048), linkHref: "h".repeat(2048), nearbyText: "😀".repeat(2000), locale: "en-12345678-12345678-12345678-12345", maxLength: 1000 };
    expect(boundary.image.url).toHaveLength(2048);
    expect(boundary.locale).toHaveLength(35);
    expect(await read(boundary)).toMatchObject({ body: boundary });
    expect(await read({ maxLength: 1, image: { url: "http://x.test" }, currentAlt: "", linkHref: "" })).toMatchObject({ body: { maxLength: 1, currentAlt: "", linkHref: "" } });
  });
  it.each([
    [{ blockId: "" }, "blockId must be 1 to 200 characters."],
    [{ blockId: "x".repeat(201) }, "blockId must be 1 to 200 characters."],
    [{ blockId: null }, "blockId must be 1 to 200 characters."],
    ...[null, {}, { url: "ftp://x.test/a" }, { url: "//x.test" }, { url: "nonsense" }, { url: "https://x.test/" + "a".repeat(2034) }].map(image => [{ image }, "image.url must be an http: or https: URL of at most 2,048 characters."]),
    ...["currentAlt", "linkHref"].flatMap(key => [42, undefined, "x".repeat(2049)].map(value => [{ [key]: value }, `${key} must be a string of at most 2,048 characters or null.`])),
    ...[42, undefined, "😀".repeat(2001)].map(nearbyText => [{ nearbyText }, "nearbyText must be at most 2,000 code points."]),
    ...["", "x", "en_XX", "en-123456789", "en-12345678-12345678-12345678-123456", 42].map(locale => [{ locale }, "locale must be a BCP 47 tag of at most 35 characters."]),
    ...[0, 1001, 1.5, "60", null].map(maxLength => [{ maxLength }, "maxLength must be an integer from 1 to 1,000."]),
  ])("rejects invalid alt-text input %#", async (patch, message) => {
    await expect(read(patch as object)).rejects.toMatchObject({ name: "SdkError", statusCode: 422, message });
  });
});
