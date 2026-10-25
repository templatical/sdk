import { afterEach, expect, it, vi } from "vitest";
import { mountScene } from "../src/host/useSceneInit";
import { minimum } from "../src/scenes/minimum";

// Mounting Vue needs a browser; keep the export boundary so this test checks
// the host's forwarding of render options without mounting the editor in Node.
vi.mock("@templatical/editor", () => ({
  init: async () => ({
    toMjml: async (options?: { locale?: string }) =>
      `<mjml lang="${options?.locale ?? "en"}">`,
  }),
  unmount: () => {},
}));

afterEach(() => vi.unstubAllGlobals());

it("forwards an explicit locale through the playground MJML export hook", async () => {
  const host = {
    location: { search: "" },
    __tplPlaygroundGetMjml: undefined as
      undefined | ((options?: { locale?: string }) => Promise<string>),
  };
  vi.stubGlobal("window", host);
  await mountScene(minimum, {} as HTMLElement, {
    search: new URLSearchParams(),
  });
  expect(await host.__tplPlaygroundGetMjml!({ locale: "de" })).toBe(
    '<mjml lang="de">',
  );
  expect(await host.__tplPlaygroundGetMjml!()).toBe('<mjml lang="en">');
});
