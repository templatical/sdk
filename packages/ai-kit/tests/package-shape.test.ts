import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const PKG = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : name.endsWith(".ts")
        ? [path]
        : [];
  });
}

describe("@templatical/ai-kit's shape", () => {
  it("is MIT, with the licence text in the package", () => {
    expect(pkg.license).toBe("MIT");
    expect(readFileSync(join(PKG, "LICENSE"), "utf8")).toBe(
      readFileSync(resolve(PKG, "../../LICENSE-MIT"), "utf8"),
    );
  });

  it("depends on @templatical/types and nothing else", () => {
    expect(pkg.dependencies).toEqual({ "@templatical/types": "workspace:*" });
    expect(pkg.peerDependencies).toBe(undefined);
  });

  it("exports the wire, the client, the server kit, the test kit and the assets", () => {
    expect(Object.keys(pkg.exports)).toEqual([
      ".",
      "./client",
      "./server",
      "./testing",
      "./prompts/*",
      "./schema/*",
      "./eval/*",
    ]);
    expect(pkg.files).toEqual([
      "README.md",
      "LICENSE",
      "dist",
      "prompts",
      "schema",
      "eval",
    ]);
  });

  it("uses only web-standard APIs in its source (isomorphic, BY4)", () => {
    const offending = sourceFiles(join(PKG, "src")).filter((file) =>
      /from "node:|require\(|\bprocess\.|\bBuffer\b|\b__dirname\b/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offending).toEqual([]);
  });

  it("imports no LLM SDK and no FSL package", () => {
    const offending = sourceFiles(join(PKG, "src")).filter((file) =>
      /from "(@templatical\/(core|editor)|ai|openai|@anthropic-ai\/[^"]+|@ai-sdk\/[^"]+)"/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offending).toEqual([]);
  });
});
