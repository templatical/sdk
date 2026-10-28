// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { init } from "../src/index";

it("validates trimmed do-not-translate terms and accepts the maximum list", async () => {
  const container = document.createElement("div");
  const message =
    "localization.doNotTranslate must be an array of at most 500 terms, each 1–100 characters.";
  for (const doNotTranslate of [
    Array(501).fill("Sable"),
    [""],
    ["   "],
    ["a".repeat(101)],
    "Sable",
    null,
    [42],
  ]) {
    await expect
      .soft(
        init({
          container,
          shadowDom: false,
          localization: { locales: ["de"], doNotTranslate } as never,
        }),
      )
      .rejects.toMatchObject({ name: "SdkError", message });
  }
  const editor = await init({
    container,
    shadowDom: false,
    localization: {
      locales: ["de"],
      doNotTranslate: Array(500).fill(` ${"a".repeat(100)} `),
    },
  });
  editor.unmount();
});
