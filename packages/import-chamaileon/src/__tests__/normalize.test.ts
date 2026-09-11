import { describe, expect, it } from "vitest";
import {
  camelKey,
  isUnset,
  readStyle,
  unwrapValue,
  styleValue,
} from "../normalize";
import type { ChamaileonNode, ChamaileonVariable } from "../types";

describe("isUnset", () => {
  it("treats null as unset", () => {
    expect(isUnset(null)).toBe(true);
  });
  it("treats empty string as unset", () => {
    expect(isUnset("")).toBe(true);
  });
  it("treats url() as unset", () => {
    expect(isUnset("url()")).toBe(true);
  });
  it("treats transparent as unset", () => {
    expect(isUnset("transparent")).toBe(true);
  });
  it("treats undefined as unset", () => {
    expect(isUnset(undefined)).toBe(true);
  });
  it("keeps a real colour", () => {
    expect(isUnset("#00a591")).toBe(false);
  });
  it("keeps 0", () => {
    expect(isUnset(0)).toBe(false);
  });
});

describe("camelKey", () => {
  it("converts kebab-case", () => {
    expect(camelKey("background-color")).toBe("backgroundColor");
    expect(camelKey("body-width")).toBe("bodyWidth");
    expect(camelKey("content-background-color")).toBe("contentBackgroundColor");
  });
  it("leaves camelCase alone", () => {
    expect(camelKey("backgroundColor")).toBe("backgroundColor");
  });
});

describe("unwrapValue", () => {
  const variables: ChamaileonVariable[] = [
    { name: "SecondaryColor", value: "#5C9AEB", type: "color" },
  ];

  it("returns a plain string unchanged", () => {
    expect(unwrapValue("#00a591", variables)).toBe("#00a591");
  });

  it("resolves { reference, default } to default", () => {
    expect(
      unwrapValue(
        { reference: "SecondaryColor", default: "#5C9AEB" },
        variables,
      ),
    ).toBe("#5C9AEB");
  });

  it("looks up variables[] when default is missing", () => {
    expect(unwrapValue({ reference: "SecondaryColor" }, variables)).toBe(
      "#5C9AEB",
    );
  });

  it("returns undefined when neither default nor table has it", () => {
    expect(unwrapValue({ reference: "Missing" }, variables)).toBeUndefined();
  });
});

describe("readStyle", () => {
  it("camelCases 2.0 keys and drops unset values", () => {
    const node: ChamaileonNode = {
      type: "button",
      style: {
        "background-color": "#00a591",
        "background-image": "url()",
        color: "#ffffff",
      },
    };
    const style = readStyle(node, []);
    expect(style.backgroundColor).toBe("#00a591");
    expect(style.color).toBe("#ffffff");
    expect("backgroundImage" in style).toBe(false);
  });

  it("unwraps a 4.x variable object on a camelCase key", () => {
    const node: ChamaileonNode = {
      type: "button",
      style: {
        backgroundColor: { reference: "SecondaryColor", default: "#5C9AEB" },
      },
    };
    expect(readStyle(node, []).backgroundColor).toBe("#5C9AEB");
  });
});

describe("styleValue", () => {
  it("reads either spelling after normalize", () => {
    const style = readStyle({ type: "body", style: { "body-width": 600 } }, []);
    expect(styleValue(style, "bodyWidth")).toBe(600);
    expect(styleValue(style, "body-width")).toBe(600);
  });
});
