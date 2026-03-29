import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Cannot import .vue files directly in vitest without vue plugin,
// so we verify the resolver logic by reading the source file.

const indexSrc = readFileSync(
  resolve(__dirname, "../src/components/toolbar/fields/index.ts"),
  "utf-8",
);

describe("resolveFieldComponent", () => {
  const expectedTypes = [
    "text",
    "textarea",
    "image",
    "color",
    "number",
    "select",
    "boolean",
    "repeatable",
  ];

  const expectedComponents: Record<string, string> = {
    text: "TextField",
    textarea: "TextareaField",
    image: "ImageField",
    color: "ColorField",
    number: "NumberField",
    select: "SelectField",
    boolean: "BooleanField",
    repeatable: "RepeatableField",
  };

  it("fieldComponentMap contains all 8 field types", () => {
    for (const type of expectedTypes) {
      const pattern = new RegExp(`${type}:\\s*\\w+Field`);
      expect(indexSrc).toMatch(pattern);
    }
  });

  it("maps each type to its expected component", () => {
    for (const [type, component] of Object.entries(expectedComponents)) {
      const pattern = new RegExp(`${type}:\\s*${component}`);
      expect(indexSrc).toMatch(pattern);
    }
  });

  it("imports all 8 field components", () => {
    for (const component of Object.values(expectedComponents)) {
      expect(indexSrc).toContain(`import ${component} from`);
    }
  });

  it("resolveFieldComponent falls back to TextField", () => {
    expect(indexSrc).toMatch(/fieldComponentMap\[type\]\s*\?\?\s*TextField/);
  });

  it("exports fieldComponentMap and resolveFieldComponent", () => {
    expect(indexSrc).toMatch(/export const fieldComponentMap/);
    expect(indexSrc).toMatch(/export function resolveFieldComponent/);
  });
});
