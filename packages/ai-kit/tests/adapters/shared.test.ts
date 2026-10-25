import { describe, expect, it } from "vitest";
import { SdkError, ThrottledError } from "@templatical/types";
import {
  blobBase64,
  cutOff,
  ownState,
  providerError,
  refused,
  toolArguments,
  toolInput,
} from "../../src/adapters/shared";
import { parseRetryAfter } from "../../src/client/errors";

describe("adapter helpers", () => {
  it("returns an adapter's own state content and ignores any other", () => {
    const content = [{ type: "thinking", signature: "s" }];
    expect(ownState({ adapter: "anthropic", content }, "anthropic")).toBe(
      content,
    );
    expect(
      ownState({ adapter: "vercel", content }, "anthropic"),
    ).toBeUndefined();
    expect(
      ownState({ adapter: "anthropic", content: "x" }, "anthropic"),
    ).toBeUndefined();
    expect(ownState(undefined, "anthropic")).toBeUndefined();
  });

  it("reads tool input as an object and writes it as a JSON string", () => {
    expect(toolInput('{"ops":"[]"}')).toEqual({ ops: "[]" });
    expect(toolInput({ ops: "[]" })).toEqual({ ops: "[]" });
    expect(toolInput("not json")).toEqual({});
    expect(toolInput("[1]")).toEqual({});
    expect(toolArguments({ ops: "[]" })).toBe('{"ops":"[]"}');
    expect(toolArguments('{"ops":"[]"}')).toBe('{"ops":"[]"}');
  });

  it("encodes a Blob as base64 without Buffer, across chunk boundaries", async () => {
    const bytes = new Uint8Array(70_000).map((_, index) => index % 256);
    const encoded = await blobBase64(new Blob([bytes]));
    expect(
      Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
    ).toEqual(bytes);
  });

  it("builds the refusal and cut-off errors with the wire's codes", () => {
    expect(refused()).toMatchObject({
      statusCode: 502,
      code: "ai_provider_error",
    });
    expect(refused()).toBeInstanceOf(SdkError);
    expect(cutOff()).toMatchObject({
      statusCode: 422,
      code: "ai_output_invalid",
    });
  });

  it("turns a provider 429 into a ThrottledError and leaves anything else alone", () => {
    const sdk429 = Object.assign(new Error("rate"), {
      status: 429,
      headers: new Headers({ "retry-after": "7" }),
    });
    const aiSdk429 = Object.assign(new Error("rate"), {
      statusCode: 429,
      responseHeaders: { "Retry-After": "3" },
    });
    const retried = Object.assign(new Error("retries"), {
      lastError: aiSdk429,
    });
    const bare429 = Object.assign(new Error("rate"), { status: 429 });
    const other = Object.assign(new Error("boom"), { status: 500 });
    const otherHeaders429 = Object.assign(new Error("rate"), {
      statusCode: 429,
      responseHeaders: { "x-request-id": "r1" },
    });

    expect(providerError(sdk429)).toBeInstanceOf(ThrottledError);
    expect((providerError(sdk429) as ThrottledError).retryAfterMs).toBe(7000);
    expect((providerError(aiSdk429) as ThrottledError).retryAfterMs).toBe(3000);
    expect((providerError(retried) as ThrottledError).retryAfterMs).toBe(3000);
    expect((providerError(bare429) as ThrottledError).retryAfterMs).toBe(
      parseRetryAfter(null),
    );
    expect(
      (providerError(otherHeaders429) as ThrottledError).retryAfterMs,
    ).toBe(parseRetryAfter(null));
    expect(providerError(other)).toBe(other);
    expect(providerError("text")).toBe("text");
  });
});
