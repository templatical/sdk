import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAnthropicAdapter } from "../src/adapters/anthropic";
import { createHttpAiProvider } from "../src/client";
import { runAiProviderConformance } from "../src/testing";
import { referenceAnthropicClient } from "./helpers/reference-anthropic";
import { createReferenceHandler } from "./helpers/reference-server";
import { serve } from "./helpers/serve";

const failed = (report: {
  checks: { name: string; ok: boolean; detail: string }[];
}) => report.checks.filter((check) => !check.ok);

describe("the reference server through the Anthropic adapter", () => {
  let server: Awaited<ReturnType<typeof serve>>;
  beforeAll(async () => {
    server = await serve(
      createReferenceHandler(
        createAnthropicAdapter({
          client: referenceAnthropicClient(),
          model: "claude-test",
        }),
      ),
    );
  });
  afterAll(() => server.close());

  it("passes the provider conformance suite", async () => {
    const report = await runAiProviderConformance(
      createHttpAiProvider({ baseUrl: server.baseUrl }),
    );
    expect(failed(report)).toEqual([]);
  });
});
