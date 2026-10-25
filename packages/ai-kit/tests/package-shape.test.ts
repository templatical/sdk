import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

  it("depends on @templatical/types, with the provider SDKs as optional peers", () => {
    expect(pkg.dependencies).toEqual({ "@templatical/types": "workspace:*" });
    expect(pkg.peerDependencies).toEqual({
      "@anthropic-ai/sdk": "^1",
      ai: "^7",
      openai: "^7",
    });
    expect(pkg.peerDependenciesMeta).toEqual({
      "@anthropic-ai/sdk": { optional: true },
      ai: { optional: true },
      openai: { optional: true },
    });
  });

  it("exports the wire, the client, the server kit, the test kit, the adapters and the assets", () => {
    expect(Object.keys(pkg.exports)).toEqual([
      ".",
      "./client",
      "./server",
      "./testing",
      "./adapters/anthropic",
      "./adapters/openai",
      "./adapters/vercel",
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

  it("imports no FSL package, and LLM SDKs only in their adapters", () => {
    const llm = /from "(ai|openai|@anthropic-ai\/[^"]+|@ai-sdk\/[^"]+)"/;
    const files = sourceFiles(join(PKG, "src"));
    expect(
      files.filter((file) =>
        /from "@templatical\/(core|editor)"/.test(readFileSync(file, "utf8")),
      ),
    ).toEqual([]);
    expect(
      files.filter(
        (file) =>
          !file.includes(`${join("src", "adapters")}`) &&
          llm.test(readFileSync(file, "utf8")),
      ),
    ).toEqual([]);
    for (const name of ["anthropic", "openai"]) {
      const path = join(PKG, "src/adapters", `${name}.ts`);
      const source = existsSync(path) ? readFileSync(path, "utf8") : "";
      const valueImports = source
        .split("\n")
        .filter((line) => llm.test(line) && !/^import type /.test(line));
      expect(valueImports, name).toEqual([]);
    }
    const vercel = join(PKG, "src/adapters/vercel.ts");
    const vercelSource = existsSync(vercel) ? readFileSync(vercel, "utf8") : "";
    expect(
      vercelSource
        .split("\n")
        .filter((line) => llm.test(line) && !/from "ai"/.test(line)),
    ).toEqual([]);
  });
});
