// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import { useEditor, useHistory } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createTitleBlock,
  applyOperationsInPlace,
  localeCoverage,
  SdkError,
  SYNTAX_PRESETS,
  type TranslationErrorCode,
  type TranslationProvider,
  type TranslationRequest,
} from "@templatical/types";
import { useTranslationFeature } from "../src/composables/useTranslationFeature";
import { FakeCollaborationServer } from "../../core/tests/helpers/fake-collaboration-server";
import {
  openClient,
  settle,
} from "../../core/tests/helpers/collaboration-harness";

const cleanups: (() => void)[] = [];
afterEach(() =>
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup()),
);
function content(count = 120) {
  const seed = createDefaultTemplateContent();
  seed.settings.locale = "en";
  seed.settings.locales = ["de", "fr"];
  seed.blocks = Array.from({ length: count }, (_, i) =>
    createTitleBlock({ id: `t${i}`, content: `<p>Hello ${i}</p>` }),
  );
  return seed;
}
const answer = (request: TranslationRequest) => ({
  fields: request.fields.map(({ id, text }) => ({
    id,
    text: text.replace("Hello", "Hallo"),
  })),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function open(
  provider: TranslationProvider,
  seed = content(),
  enabled = ["de"],
  doNotTranslate?: string[],
) {
  const scope = effectScope();
  const value = scope.run(() => {
    const editor = useEditor({
      content: seed,
      localization: { locales: enabled },
      templates: {
        load: async (id) => ({ id, content: content(2) }),
        create: false,
        save: false,
      },
    });
    editor.setActiveLocale("de");
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    const feature = useTranslationFeature({
      provider,
      editor,
      localization: { locales: enabled, doNotTranslate },
      history: () => history,
      syntax: () => SYNTAX_PRESETS.liquid,
      definitions: () => [],
    });
    cleanups.push(history.destroy);
    return { editor, history, feature };
  })!;
  cleanups.push(() => scope.stop());
  return { ...value, scope };
}

class ExternalSdkError extends Error {
  readonly name = "SdkError";
  constructor(
    message: string,
    readonly code: TranslationErrorCode,
    readonly statusCode?: number,
  ) {
    super(message);
  }
}
const providerError = (
  kind: string,
  code: TranslationErrorCode,
  statusCode?: number,
) =>
  kind === "plain"
    ? {
        name: "SdkError",
        code,
        message: "Provider message",
        ...(statusCode === undefined ? {} : { statusCode }),
      }
    : new ExternalSdkError("Provider message", code, statusCode);

async function collaborative(provider: TranslationProvider) {
  const server = new FakeCollaborationServer(content(1));
  const client = await openClient(server, "Ada");
  const scope = effectScope();
  cleanups.push(() => {
    client.collaboration.destroy();
    client.scope.stop();
    scope.stop();
  });
  client.editor.setActiveLocale("de");
  const feature = scope.run(() =>
    useTranslationFeature({
      provider,
      editor: client.editor,
      localization: { locales: ["de"] },
      collaboration: { core: client.collaboration },
      history: () => ({ record: () => {} }),
      syntax: () => SYNTAX_PRESETS.liquid,
      definitions: () => [],
    }),
  )!;
  return { server, client, feature };
}

describe("translation runs", () => {
  it("masks Sable before the provider and preserves it when the provider tries to translate it", async () => {
    const seed = content(1);
    (seed.blocks[0] as any).content = "<p>Hello Sable</p>";
    const translate = vi.fn(async (request: TranslationRequest) => ({
      fields: request.fields.map(({ id, text }) => ({
        id,
        text: text.replace("Hello", "Hallo").replaceAll("Sable", "Zobel"),
      })),
    }));
    const { feature, editor } = open({ translate }, seed, ["de"], ["Sable"]);
    const result = await feature.translate({ only: "gaps" });
    expect(translate.mock.calls[0][0].fields).toEqual([
      { id: "t0/content", text: '<p>Hello <x id="1"/></p>', format: "html" },
    ]);
    expect(result.translated).toBe(1);
    expect(result.tagsChanged).toEqual([]);
    expect(editor.content.value.blocks[0].l10n?.de.text?.content.value).toBe(
      "<p>Hallo Sable</p>",
    );
  });

  it("keeps the previous value when a provider drops a protected term", async () => {
    const seed = content(1);
    (seed.blocks[0] as any).content = "<p>Hello Sable</p>";
    const { feature, editor } = open(
      {
        translate: async () => ({
          fields: [{ id: "t0/content", text: "<p>Hallo Zobel</p>" }],
        }),
      },
      seed,
      ["de"],
      ["Sable"],
    );
    const result = await feature.translate({ only: "gaps" });
    expect(result.translated).toBe(0);
    expect(result.tagsChanged).toEqual(["t0/content"]);
    expect(editor.content.value.blocks[0].l10n).toBeUndefined();
  });

  it("sends 120 consecutive fields in three sequential calls and undoes the batch once", async () => {
    const translate = vi.fn(async (request: TranslationRequest) =>
      answer(request),
    );
    const { feature, editor, history } = open({ translate });
    const before = JSON.stringify(editor.content.value);
    expect(feature.counts.value).toEqual({ gaps: 120, all: 120 });
    const result = await feature.translate({ only: "gaps" });
    expect(
      translate.mock.calls.map(([request]) => request.fields.length),
    ).toEqual([50, 50, 20]);
    expect(translate.mock.calls[0][0]).toMatchObject({
      templateId: null,
      sourceLocale: "en",
      targetLocale: "de",
    });
    expect(result.translated).toBe(120);
    expect(editor.state.isDirty).toBe(true);
    expect(localeCoverage(editor.content.value, "de").missing).toEqual([]);
    expect(feature.counts.value).toEqual({ gaps: 0, all: 120 });
    history.undo();
    expect(JSON.stringify(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });

  it("halves content_too_large batches from 50 to 25 to 12 to 6", async () => {
    const sizes: number[] = [];
    const { feature } = open({
      translate: async (request) => {
        sizes.push(request.fields.length);
        if (request.fields.length > 10)
          throw new SdkError("Smaller calls", 413, "content_too_large");
        return answer(request);
      },
    });
    expect((await feature.translate({ only: "all" })).translated).toBe(120);
    expect(sizes.slice(0, 4)).toEqual([50, 25, 12, 6]);
  });

  it("keeps calls under the character cap and stops a rejected single field", async () => {
    const seed = content(3);
    seed.blocks = seed.blocks.map((block) => ({
      ...block,
      content: "A".repeat(10000),
    }));
    const sizes: number[] = [];
    const { feature } = open(
      {
        translate: async (request) => {
          sizes.push(
            request.fields.reduce((sum, field) => sum + field.text.length, 0),
          );
          return answer(request);
        },
      },
      seed,
    );
    await feature.translate({ only: "all" });
    expect(sizes).toEqual([20000, 10000]);
    const single = open(
      {
        translate: async () => {
          throw new SdkError("Too big", 413, "content_too_large");
        },
      },
      content(1),
    );
    expect((await single.feature.translate({ only: "all" })).error).toEqual({
      code: "content_too_large",
      message: "Too big",
    });
  });

  it.each(["cancel", "error", "switch"])(
    "keeps earlier chunks after %s and ignores late answers",
    async (ending) => {
      const gate = deferred<ReturnType<typeof answer>>();
      const requests: TranslationRequest[] = [];
      let signal!: AbortSignal;
      const { feature, editor } = open({
        translate: async (request, abort) => {
          requests.push(request);
          signal = abort;
          if (requests.length === 1) return answer(request);
          if (ending === "error")
            throw new SdkError("Try later", 429, "rate_limited");
          return gate.promise; // Deliberately ignores abort.
        },
      });
      const run = feature.translate({ only: "gaps" });
      await vi.waitFor(() => expect(requests).toHaveLength(2));
      if (ending === "cancel") feature.cancel();
      if (ending === "switch") editor.setActiveLocale("fr");
      const result = await run;
      expect(result.translated).toBe(50);
      expect(result.cancelled).toBe(ending !== "error");
      expect(result.error).toEqual(
        ending === "error"
          ? { code: "rate_limited", message: "Try later" }
          : null,
      );
      if (ending !== "error") expect(signal.aborted).toBe(true);
      gate.resolve(answer(requests[1]));
      await nextTick();
      expect(
        localeCoverage(editor.content.value, "de").translated,
      ).toHaveLength(50);
      expect(
        localeCoverage(editor.content.value, "fr").translated,
      ).toHaveLength(0);
    },
  );

  it.each(["reload", "replace", "dispose"])(
    "discards partial and late values after %s",
    async (ending) => {
      const gate = deferred<ReturnType<typeof answer>>();
      const requests: TranslationRequest[] = [];
      let signal!: AbortSignal;
      const { feature, editor, scope } = open({
        translate: async (request, abort) => {
          requests.push(request);
          signal = abort;
          return requests.length === 1 ? answer(request) : gate.promise;
        },
      });
      await editor.load("same-id");
      editor.setContent(content());
      const run = feature.translate({ only: "all" });
      await vi.waitFor(() => expect(requests).toHaveLength(2));
      if (ending === "reload") await editor.load("same-id");
      if (ending === "replace") editor.setContent(content(2));
      if (ending === "dispose") scope.stop();
      const result = await run;
      expect(signal.aborted).toBe(true);
      expect(result.translated).toBe(0);
      expect(result.cancelled).toBe(true);
      gate.resolve(answer(requests[1]));
      await nextTick();
      expect(localeCoverage(editor.content.value, "de").translated).toEqual([]);
    },
  );

  it("cannot start another run after disposal", async () => {
    const { feature, scope } = open(
      { translate: async (request) => answer(request) },
      content(1),
    );
    expect(feature.isAvailable.value).toBe(true);
    scope.stop();
    expect(feature.isAvailable.value).toBe(false);
    await expect(feature.translate({ only: "all" })).rejects.toMatchObject({
      code: "feature_unavailable",
    });
  });

  it("rejects a second run with the editor-local SdkError code", async () => {
    const gate = deferred<ReturnType<typeof answer>>();
    const { feature } = open({ translate: () => gate.promise }, content(1));
    const run = feature.translate({ only: "all" });
    await expect(feature.translate({ only: "all" })).rejects.toMatchObject({
      name: "SdkError",
      code: "translation_running",
    });
    feature.cancel();
    await run;
  });

  it("keeps a changed placeholder's old value, reports missing ids and sanitizes HTML around intact tokens", async () => {
    const seed = content(3);
    (seed.blocks[0] as any).content = "<p>Hello {{name}}</p>";
    seed.blocks[0].l10n = {
      de: {
        text: { content: { value: "<p>Alt {{name}}</p>", sourceHash: "old" } },
      },
    };
    (seed.blocks[1] as any).content =
      '<p>Hello <span data-merge-tag="{{name}}">Name</span> <a href="{{url}}">Link</a></p>';
    const { feature, editor } = open(
      {
        translate: async (request) => ({
          fields: [
            { id: "t0/content", text: "No placeholder" },
            {
              id: "t1/content",
              text:
                request.fields[1].text
                  .replace("Hello", "Hallo")
                  .replace("<p>", '<p onclick="evil()">') +
                "<script>evil()</script>",
            },
            { id: "unknown/content", text: "Ignore" },
          ],
        }),
      },
      seed,
    );
    const result = await feature.translate({ only: "all" });
    expect(result.tagsChanged).toEqual(["t0/content"]);
    expect(result.missing).toEqual(["t2/content"]);
    expect(result.translated).toBe(1);
    expect(editor.content.value.blocks[0].l10n?.de.text?.content.value).toBe(
      "<p>Alt {{name}}</p>",
    );
    expect(editor.content.value.blocks[1].l10n?.de.text?.content.value).toBe(
      '<p>Hallo <span data-merge-tag="{{name}}">Name</span> <a href="{{url}}">Link</a></p>',
    );
  });

  it("stamps the extraction hash when the default changes during a run", async () => {
    const gate = deferred<ReturnType<typeof answer>>();
    let request!: TranslationRequest;
    const { feature, editor } = open(
      {
        translate: (input) => {
          request = input;
          return gate.promise;
        },
      },
      content(1),
    );
    const run = feature.translate({ only: "gaps" });
    (editor.content.value.blocks[0] as any).content = "New default";
    expect(request).toBeDefined();
    gate.resolve(answer(request));
    await run;
    expect(localeCoverage(editor.content.value, "de").stale).toEqual([
      "t0/content",
    ]);
  });

  it.each(["de", null, "fr"])(
    "checks peer locks in captured German with a %s lock and submits ordinary local edits",
    async (lockLocale) => {
      const server = new FakeCollaborationServer(content(51));
      const client = await openClient(server, "Ada");
      const peer = await openClient(server, "Grace");
      cleanups.push(() => {
        for (const c of [client, peer]) {
          c.collaboration.destroy();
          c.scope.stop();
        }
      });
      peer.collaboration.setLockLocale(lockLocale);
      peer.editor.selectBlock("t0");
      await settle();
      server.deliverAll();
      const scope = effectScope();
      cleanups.push(() => scope.stop());
      client.editor.setActiveLocale("de");
      const gate = deferred<ReturnType<typeof answer>>();
      let request!: TranslationRequest;
      let calls = 0;
      const feature = scope.run(() =>
        useTranslationFeature({
          provider: {
            translate: async (input) => {
              request = input;
              return ++calls === 1 ? answer(input) : gate.promise;
            },
          },
          editor: client.editor,
          localization: { locales: ["de", "fr"] },
          collaboration: { core: client.collaboration },
          history: () => ({ record: () => {} }),
          syntax: () => SYNTAX_PRESETS.liquid,
          definitions: () => [],
        }),
      )!;
      const run = feature.translate({ only: "all" });
      await vi.waitFor(() => expect(calls).toBe(2));
      client.editor.setActiveLocale("fr");
      gate.resolve(answer(request));
      const result = await run;
      await client.collaboration.settle();
      const blocked = lockLocale !== "fr";
      expect(result.skippedLocked).toEqual(blocked ? ["t0/content"] : []);
      expect(result.translated).toBe(blocked ? 49 : 50);
      expect(server.submitted).toHaveLength(1);
      expect(server.submitted[0].ops).toHaveLength(blocked ? 49 : 50);
      expect(
        server.submitted
          .flatMap((batch) => batch.ops)
          .every(
            (op) =>
              op.op === "updateBlockLocale" &&
              op.locale === "de" &&
              (!blocked || op.blockId !== "t0"),
          ),
      ).toBe(true);
      client.collaboration.undo();
      await client.collaboration.settle();
      expect(
        localeCoverage(client.editor.content.value, "de").translated,
      ).toEqual([]);
    },
  );

  it.each(["plain", "external"])(
    "halves SDK-shaped %s provider errors across constructors",
    async (kind) => {
      const sizes: number[] = [];
      const { feature } = open(
        {
          translate: async (request) => {
            sizes.push(request.fields.length);
            if (request.fields.length > 10)
              throw providerError(
                kind,
                "content_too_large",
                kind === "external" ? 413 : undefined,
              );
            return answer(request);
          },
        },
        content(50),
      );
      const result = await feature.translate({ only: "all" });
      expect(result.translated).toBe(50);
      expect(sizes.slice(0, 4)).toEqual([50, 25, 12, 6]);
      expect(result.error).toBeNull();
    },
  );

  it.each(
    ["plain", "external"].flatMap((kind) =>
      (
        [
          "rate_limited",
          "limit_reached",
          "content_too_large",
          "translation_failed",
        ] as const
      ).map((code) => ({ kind, code })),
    ),
  )(
    "preserves $code and the message from a $kind provider error",
    async ({ kind, code }) => {
      const translate = vi.fn(async () => {
        throw providerError(kind, code);
      });
      const { feature } = open({ translate }, content(1));
      const result = await feature.translate({ only: "all" });
      expect(result.error).toEqual({ code, message: "Provider message" });
      expect(translate).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps pending typing before a collaborative run in its own undo step", async () => {
    const translate = vi.fn(async (request: TranslationRequest) =>
      answer(request),
    );
    const { server, client, feature } = await collaborative({ translate });
    client.editor.setActiveLocale(null);
    client.editor.updateBlock("t0", { content: "Hello before" } as any);
    client.editor.setActiveLocale("de");
    expect(server.submitted).toHaveLength(0);
    await feature.translate({ only: "all", blockId: "t0" });
    expect(translate).toHaveBeenCalledTimes(1);
    await client.collaboration.settle();
    expect(server.submitted).toHaveLength(2);
    client.collaboration.undo();
    await client.collaboration.settle();
    expect(client.editor.content.value.blocks[0]).toMatchObject({
      content: "Hello before",
    });
    expect(client.editor.content.value.blocks[0].l10n).toBeUndefined();
    client.collaboration.undo();
    await client.collaboration.settle();
    expect(client.editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Hello 0</p>",
    });
  });

  it("separates typing during and immediately after a single-block collaborative run", async () => {
    const gate = deferred<ReturnType<typeof answer>>();
    let request!: TranslationRequest;
    const { server, client, feature } = await collaborative({
      translate: (input) => {
        request = input;
        return gate.promise;
      },
    });
    const run = feature.translate({ only: "all", blockId: "t0" });
    expect(request).toBeDefined();
    const typeColor = (color: string) => {
      applyOperationsInPlace(client.editor.content.value, [
        {
          op: "updateBlockLocale",
          blockId: "t0",
          locale: "de",
          set: { color },
        },
      ]);
      client.editor.markDirty();
    };
    typeColor("#123456");
    gate.resolve(answer(request));
    await run;
    typeColor("#654321");
    await client.collaboration.settle();
    expect(server.submitted).toHaveLength(3);
    client.collaboration.undo();
    await client.collaboration.settle();
    expect(client.editor.content.value.blocks[0].l10n?.de).toMatchObject({
      set: { color: "#123456" },
      text: { content: { value: "<p>Hallo 0</p>" } },
    });
    client.collaboration.undo();
    await client.collaboration.settle();
    expect(client.editor.content.value.blocks[0].l10n?.de).toEqual({
      set: { color: "#123456" },
    });
    client.collaboration.undo();
    await client.collaboration.settle();
    expect(client.editor.content.value.blocks[0].l10n).toBeUndefined();
  });
});
