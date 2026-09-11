import { describe, expect, it } from "vitest";
import {
  buildVariableTable,
  contextFromPage,
  isUnset,
  readAttr,
  substituteVars,
  unwrapDocument,
  withWidgetInput,
} from "../normalize";
import type { EasyEmailProNode } from "../types";

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
  it("treats leftover $var as unset", () => {
    expect(isUnset("$var(missing)")).toBe(true);
  });
  it("keeps a real colour", () => {
    expect(isUnset("#8C9A80")).toBe(false);
  });
  it("keeps 0", () => {
    expect(isUnset(0)).toBe(false);
  });
});

describe("substituteVars", () => {
  const vars = { "primary-color": "#8C9A80" };
  it("replaces $var(name)", () => {
    expect(substituteVars("$var(primary-color)", vars)).toEqual({
      value: "#8C9A80",
      unresolved: false,
    });
  });
  it("leaves unknown $var marked unresolved", () => {
    expect(substituteVars("$var(nope)", vars)).toEqual({
      value: "$var(nope)",
      unresolved: true,
    });
  });
  it("passes through a plain colour", () => {
    expect(substituteVars("#fff", vars)).toEqual({
      value: "#fff",
      unresolved: false,
    });
  });
});

describe("readAttr cascade", () => {
  const page: EasyEmailProNode = {
    type: "page",
    data: {
      globalAttributes: {
        "font-family": "Arial, sans-serif",
        color: "#111111",
      },
      blockAttributes: { "standard-paragraph": { color: "#FFFFFF" } },
      categoryAttributes: { BUTTON: { "padding-right": "25px" } },
    },
    attributes: {},
    children: [],
  };
  const ctx = contextFromPage(page);

  it("reads element attributes first", () => {
    const node: EasyEmailProNode = {
      type: "standard-paragraph",
      attributes: { color: "#000000" },
    };
    expect(readAttr(node, "color", ctx)).toBe("#000000");
  });

  it("falls through to blockAttributes", () => {
    const node: EasyEmailProNode = {
      type: "standard-paragraph",
      attributes: {},
    };
    expect(readAttr(node, "color", ctx)).toBe("#FFFFFF");
  });

  it("falls through to categoryAttributes via the type map", () => {
    const node: EasyEmailProNode = {
      type: "standard-button",
      attributes: {},
    };
    expect(readAttr(node, "padding-right", ctx)).toBe("25px");
  });

  it("falls through to globalAttributes", () => {
    const node: EasyEmailProNode = {
      type: "standard-paragraph",
      attributes: {},
    };
    expect(readAttr(node, "font-family", ctx)).toBe("Arial, sans-serif");
  });

  it("resolves $var from the page variable table", () => {
    const withVars: EasyEmailProNode = {
      ...page,
      data: {
        ...(page.data as object),
        variables: [{ name: "primary-color", value: "#8C9A80", type: "color" }],
      },
      attributes: { "background-color": "$var(primary-color)" },
    };
    const c = contextFromPage(withVars);
    expect(readAttr(withVars, "background-color", c)).toBe("#8C9A80");
  });

  it("lets widget input override page variables", () => {
    const withVars: EasyEmailProNode = {
      ...page,
      data: {
        variables: [{ name: "primary-color", value: "#8C9A80", type: "color" }],
      },
    };
    const c = withWidgetInput(contextFromPage(withVars), {
      "primary-color": "#d3943c",
    });
    const node: EasyEmailProNode = {
      type: "standard-button",
      attributes: { "background-color": "$var(primary-color)" },
    };
    expect(readAttr(node, "background-color", c)).toBe("#d3943c");
  });
});

describe("unwrapDocument", () => {
  it("returns a bare page as the page", () => {
    const { page, subject } = unwrapDocument({
      type: "page",
      children: [],
    });
    expect(page.type).toBe("page");
    expect(subject).toBe(undefined);
  });

  it("unwraps { subject, content }", () => {
    const { page, subject } = unwrapDocument({
      subject: "Hi",
      content: { type: "page", children: [] },
      html: "<html></html>",
    });
    expect(page.type).toBe("page");
    expect(subject).toBe("Hi");
  });
});

// Touch buildVariableTable so the brief's import stays live under lint.
describe("buildVariableTable", () => {
  it("indexes variables by name", () => {
    expect(
      buildVariableTable([
        { name: "primary-color", value: "#8C9A80", type: "color" },
      ]),
    ).toEqual({ "primary-color": "#8C9A80" });
  });
});
