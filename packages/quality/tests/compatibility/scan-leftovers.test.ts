import { describe, expect, it } from "vitest";
import { detect } from "../../src/compatibility/detect";
import { formatClientGroups } from "../../src/compatibility/support";
import type { CssMatch, Scan } from "../../src/compatibility/scan";
import type { ClientSupport } from "../../src/types";
import { expectLinear } from "../helpers/expectLinear";

const declaration = (
  prop: string,
  value: string,
  group = "same",
): CssMatch => ({
  prop,
  value,
  group,
  tag: "div",
  attrs: {},
  inline: true,
});

const scan = (css: CssMatch[]): Scan => ({
  tags: [],
  css,
  cssTexts: [],
  urls: [],
});

const client = (
  id: string,
  support: ClientSupport["support"],
): ClientSupport => ({
  id,
  name: id,
  support,
  notes: [],
  testedAt: "2026-01-01",
});

describe("compatibility grouping", () => {
  it("keeps same-group fallback decisions and the first image excerpt", () => {
    expect(
      detect(
        scan([
          declaration("background-image", "url(first.png)"),
          declaration("background-image", "url(second.png)"),
          declaration("background-color", "red", "other"),
        ]),
        "compat.css-background-image",
      ),
    ).toEqual({ excerpt: "background-image: url(first.png)" });
    expect(
      detect(
        scan([
          declaration("background-image", "url(first.png)"),
          declaration("background-color", "red"),
        ]),
        "compat.css-background-image",
      ),
    ).toBeNull();
  });

  it("groups selected clients in the same order and format", () => {
    expect(
      formatClientGroups(
        [
          client("gmail.web", "unsupported"),
          client("gmail.ios", "partial"),
          client("outlook.windows", "unsupported"),
        ],
        "unsupported",
        "en",
      ),
    ).toBe("Gmail (gmail.web) and Outlook");
  });

  it("scales same-group declaration collection linearly", () => {
    expectLinear(
      (n) => {
        const css = Array.from({ length: n }, () =>
          declaration("background", "url(hero.png)"),
        );
        const input = scan(css);
        return () => detect(input, "compat.css-background-image");
      },
      4_000,
      7,
    );
  }, 30_000);

  it("scales client family collection linearly", () => {
    expectLinear(
      (n) => {
        const clients = Array.from({ length: n }, (_, i) =>
          client(`gmail.web${i}`, "unsupported"),
        );
        return () => formatClientGroups(clients, "unsupported", "en");
      },
      3_000,
      16,
    );
  }, 30_000);
});
