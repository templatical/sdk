import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli/args";

describe("parseArgs", () => {
  it("reads the command and positionals", () => {
    const a = parseArgs(["validate", ".templatical/x.json"]);
    expect(a.command).toBe("validate");
    expect(a.positional).toEqual([".templatical/x.json"]);
    expect(a.json).toBe(false);
  });

  it("treats --json as a mode, not a positional", () => {
    const a = parseArgs(["validate", "x.json", "--json"]);
    expect(a.json).toBe(true);
    expect(a.positional).toEqual(["x.json"]);
  });

  it("reads value flags and their values", () => {
    const a = parseArgs(["render", "x.json", "--format", "html", "-o", "out.html"]);
    expect(a.flags.format).toBe("html");
    expect(a.flags.o).toBe("out.html");
  });

  it("reads boolean flags as true", () => {
    const a = parseArgs(["live", "--no-open"]);
    expect(a.flags["no-open"]).toBe(true);
  });

  it("keeps a subcommand as a positional so `live reload` dispatches", () => {
    const a = parseArgs(["live", "reload"]);
    expect(a.command).toBe("live");
    expect(a.positional).toEqual(["reload"]);
  });

  it("supports --flag=value", () => {
    expect(parseArgs(["render", "x.json", "--format=mjml"]).flags.format).toBe("mjml");
  });

  it("returns no command for an empty argv", () => {
    expect(parseArgs([]).command).toBeUndefined();
  });
});
