import { expect, it } from "vitest";
import type { TemplateContent } from "@templatical/types";
import { createHttpAiProvider } from "../src/client";
import { readAiRequest } from "../src/server";
import { runAiProviderConformance, runAiWireConformance } from "../src/testing";
import { createReferenceHandler } from "./helpers/reference-server";
import { serve } from "./helpers/serve";

const features = { rewrite: false, altText: false, conversation: false };

async function observingServer() {
  const snapshots: {
    multipart: boolean;
    locale: unknown;
    content: TemplateContent;
  }[] = [];
  const reference = createReferenceHandler();
  const server = await serve(async (request) => {
    const read = await readAiRequest(request.clone()).catch(() => null);
    if (read?.route === "generate")
      snapshots.push({
        multipart:
          request.headers
            .get("Content-Type")
            ?.startsWith("multipart/form-data") ?? false,
        locale: read.body.locale,
        content: read.body.content,
      });
    return reference(request);
  });
  return { ...server, snapshots };
}

it("sends the selected language's translated projection in JSON and multipart conformance probes", async () => {
  const content = {
    blocks: [
      {
        id: "p",
        type: "paragraph",
        content: "<p>Hello</p>",
        l10n: {
          de: {
            text: { content: { value: "<p>Hallo</p>", source: "00000000" } },
          },
        },
      },
      {
        id: "hidden",
        type: "paragraph",
        content: "<p>English only</p>",
        l10n: { de: { hidden: true } },
      },
    ],
    settings: {
      width: 600,
      locale: "en",
      locales: ["de"],
      preheaderText: "English",
      l10n: {
        de: {
          text: { preheaderText: { value: "Deutsch", source: "00000000" } },
        },
      },
    },
  } as TemplateContent;
  const original = structuredClone(content);
  const server = await observingServer();
  try {
    const report = await runAiProviderConformance(
      createHttpAiProvider({ baseUrl: server.baseUrl, features }),
      { content, locale: "de" },
    );
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    for (const multipart of [false, true]) {
      const snapshots = server.snapshots.filter(
        (snapshot) => snapshot.multipart === multipart,
      );
      expect(snapshots.length).toBeGreaterThan(0);
      for (const snapshot of snapshots) {
        expect(snapshot.locale).toBe("de");
        expect(snapshot.content).toMatchObject({
          blocks: [{ id: "p", content: "<p>Hallo</p>" }],
          settings: { locale: "de", preheaderText: "Deutsch" },
        });
        expect(snapshot.content.blocks[0]).not.toHaveProperty("l10n");
        expect(snapshot.content.settings).not.toHaveProperty("locales");
        expect(snapshot.content.settings).not.toHaveProperty("l10n");
      }
    }
    expect(content).toEqual(original);
  } finally {
    await server.close();
  }
});

it.each([
  { options: {}, expected: "de" },
  { options: { locale: "pt-BR" }, expected: "pt-BR" },
])(
  "projects the default wire fixture to $expected in JSON and multipart probes",
  async ({ options, expected }) => {
    const server = await observingServer();
    try {
      const report = await runAiWireConformance({
        baseUrl: server.baseUrl,
        features,
        ...options,
      });
      expect(report.checks.filter((check) => !check.ok)).toEqual([]);
      for (const multipart of [false, true]) {
        const snapshots = server.snapshots.filter(
          (snapshot) => snapshot.multipart === multipart,
        );
        expect(snapshots.length).toBeGreaterThan(0);
        for (const snapshot of snapshots) {
          expect(snapshot.locale).toBe(expected);
          expect(snapshot.content.settings.locale).toBe(expected);
        }
      }
    } finally {
      await server.close();
    }
  },
);
