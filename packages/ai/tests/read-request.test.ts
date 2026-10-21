import { describe, expect, it } from "vitest";
import { readAiRequest } from "../src/server";

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
    ["/templates/t-1/ai/generate", { message: "", selectedBlockId: null, mergeTags: null, content, revision: null }, "The message must be 1 to 4,000 characters."],
    ["/templates/t-1/ai/rewrite-text", { html: "<p>x</p>", preset: null, language: null, instruction: null, mergeTags: null }, "Choose a preset or write an instruction."],
    ["/templates/t-1/ai/rewrite-text", { html: "<p>x</p>", preset: "translate", language: null, instruction: null, mergeTags: null }, "Choose a language to translate into."],
    ["/templates/t-1/ai/score", { lintFindings: "x", content }, "lintFindings must be a list of at most 200 findings."],
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
      readAiRequest(post("/templates/t-1/ai/suggestions", {
        content,
        mergeTags: { syntax: "liquid", tags: [entry] },
      })),
    ).rejects.toMatchObject({ name: "SdkError", statusCode: 422 });
  });

  it("rejects an unknown syntax with 422", async () => {
    await expect(
      readAiRequest(post("/templates/t-1/ai/suggestions", {
        content,
        mergeTags: { syntax: "unknown", tags: [tag] },
      })),
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
      expect(await readAiRequest(post("/templates/t-1/ai/suggestions", {
        content,
        mergeTags,
      }))).toMatchObject({ route: "suggestions", body: { mergeTags } });
    },
  );

  it("keeps the 500-tag cap (guard)", async () => {
    const body = { content, mergeTags: { syntax: "liquid", tags: Array(500).fill(tag) } };
    const result = await readAiRequest(post("/templates/t-1/ai/suggestions", body));
    expect(result?.route === "suggestions" && result.body.mergeTags?.tags).toHaveLength(500);
    await expect(readAiRequest(post("/templates/t-1/ai/suggestions", {
      ...body,
      mergeTags: { syntax: "liquid", tags: Array(501).fill(tag) },
    }))).rejects.toMatchObject({ name: "SdkError", statusCode: 422 });
  });
});

describe("readAiRequest lint-finding field validation", () => {
  const finding = { ruleId: "subject-length", blockId: null, message: "Too long." };

  it.each([
    ["a null entry", null],
    ["a scalar entry", 7],
    ["an array entry", []],
    ["a missing ruleId", { blockId: null, message: "Too long." }],
    ["a non-string ruleId", { ...finding, ruleId: 7 }],
    ["a 101-character ruleId", { ...finding, ruleId: "r".repeat(101) }],
    ["a missing blockId", { ruleId: "subject-length", message: "Too long." }],
    ["a non-string blockId", { ...finding, blockId: 7 }],
    ["a missing message", { ruleId: "subject-length", blockId: null }],
    ["a non-string message", { ...finding, message: null }],
    ["a 501-character message", { ...finding, message: "m".repeat(501) }],
  ])("rejects %s with 422", async (_name, entry) => {
    await expect(readAiRequest(post("/templates/t-1/ai/score", {
      content,
      lintFindings: [entry],
    }))).rejects.toMatchObject({ name: "SdkError", statusCode: 422 });
  });

  it("accepts field limits and null or string blockIds at the 200-entry cap (guard)", async () => {
    const lintFindings = Array.from({ length: 200 }, (_, index) => ({
      ruleId: "r".repeat(100),
      blockId: index % 2 === 0 ? null : "t1",
      message: "m".repeat(500),
    }));
    expect(await readAiRequest(post("/templates/t-1/ai/score", {
      content,
      lintFindings,
    }))).toMatchObject({ route: "score", body: { lintFindings } });
  });

  it("rejects 201 entries (guard)", async () => {
    await expect(readAiRequest(post("/templates/t-1/ai/score", {
      content,
      lintFindings: Array(201).fill(finding),
    }))).rejects.toMatchObject({ name: "SdkError", statusCode: 422 });
  });
});

describe("readAiRequest fix-finding field validation", () => {
  const finding = {
    id: "f1",
    message: "Too long.",
    suggestion: "Shorten it.",
    category: "readability",
    blockId: null,
  };

  it.each([
    ["id", "i".repeat(65)],
    ["message", "m".repeat(1001)],
    ["suggestion", "s".repeat(1001)],
  ])("rejects an oversized %s with 422", async (field, value) => {
    await expect(readAiRequest(post("/templates/t-1/ai/fix-finding", {
      content,
      mergeTags: null,
      revision: null,
      finding: { ...finding, [field]: value },
    }))).rejects.toMatchObject({ name: "SdkError", statusCode: 422 });
  });

  it("accepts strings at all three limits (guard)", async () => {
    const atLimits = {
      ...finding,
      id: "i".repeat(64),
      message: "m".repeat(1000),
      suggestion: "s".repeat(1000),
    };
    expect(await readAiRequest(post("/templates/t-1/ai/fix-finding", {
      content,
      mergeTags: null,
      revision: null,
      finding: atLimits,
    }))).toMatchObject({ route: "fixFinding", body: { finding: atLimits } });
  });
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
  it.each(["generate", "fix-finding", "score", "suggestions"])("caps serialized content bytes on %s", async (route) => {
    const content = { blocks: [], settings: { padding: "é".repeat(100_000) } };
    await expect(readAiRequest(post(`/templates/t/ai/${route}`, { message: "Hi", selectedBlockId: null, content, lintFindings: [], finding: { id: "f", message: "m", suggestion: "s", category: "spam", blockId: null } }))).rejects.toMatchObject({ statusCode: 413, code: "content_too_large", message: "This template is too large for AI." });
  });
  it("checks design content bytes too", async () => {
    const form = new FormData();
    form.set("image_upload", new Blob(["png"], { type: "image/png" }));
    form.set("content", JSON.stringify({ blocks: [], settings: { padding: "é".repeat(100_000) } }));
    await expect(readAiRequest(new Request("https://x.test/templates/t/ai/generate-from-design", { method: "POST", body: form }))).rejects.toMatchObject({ statusCode: 413, code: "content_too_large" });
  });
  it("accepts exactly 200,000 UTF-8 content bytes and refuses the next byte", async () => {
    const content = { blocks: [], settings: { padding: "" } };
    content.settings.padding = "x".repeat(200_000 - new TextEncoder().encode(JSON.stringify(content)).length);
    expect(await readAiRequest(post("/templates/t/ai/suggestions", { content }))).toMatchObject({ route: "suggestions" });
    content.settings.padding += "x";
    await expect(readAiRequest(post("/templates/t/ai/suggestions", { content }))).rejects.toMatchObject({ statusCode: 413, code: "content_too_large" });
  });
  it.each(["session", "selected"])("caps the %s id at 200 characters", async (kind) => {
    const body = { message: "Hi", content, selectedBlockId: kind === "selected" ? "x".repeat(201) : null };
    await expect(readAiRequest(post("/templates/t/ai/generate", body, kind === "session" ? "s".repeat(201) : "s"))).rejects.toMatchObject({ statusCode: 422 });
  });
  it("counts every string boundary in code points", async () => {
    const emoji = "😀";
    expect(await readAiRequest(post("/templates/t/ai/generate", { message: emoji.repeat(4000), content, selectedBlockId: emoji.repeat(200), mergeTags: { syntax: "custom", tags: [{ value: emoji.repeat(200), label: emoji.repeat(100), group: emoji.repeat(100), description: emoji.repeat(200) }] } }, "s".repeat(200)))).toMatchObject({ route: "generate" });
    expect(await readAiRequest(post("/templates/t/ai/fix-finding", { content, finding: { id: emoji.repeat(64), message: emoji.repeat(1000), suggestion: emoji.repeat(1000), category: "spam", blockId: null } }))).toMatchObject({ route: "fixFinding" });
    expect(await readAiRequest(post("/templates/t/ai/score", { content, lintFindings: [{ ruleId: emoji.repeat(100), message: emoji.repeat(500), blockId: null }] }))).toMatchObject({ route: "score" });
    expect(await readAiRequest(post("/templates/t/ai/rewrite-text", { html: emoji.repeat(20_000), instruction: emoji.repeat(500) }))).toMatchObject({ route: "rewriteText" });
  });
});
