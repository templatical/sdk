import type { RenderOptions } from "@templatical/renderer";
import type { CustomBlockDefinition } from "@templatical/types";
import { validateCustomBlockDefinition } from "../custom-block/definition";
import { createLiquid } from "../custom-block/liquid";
import { flagValue, type ParsedArgs } from "./args";
import { readTemplateFile, UsageError } from "./io";

export function readDefinitions(
  args: ParsedArgs,
  cwd: string,
): CustomBlockDefinition[] {
  const file = fileFlag(args, "definitions");
  if (file === undefined) return [];
  const data = readTemplateFile(file, cwd);
  if (!Array.isArray(data)) {
    throw new UsageError(
      "--definitions must be a JSON array of custom block definitions.",
    );
  }
  for (const [index, definition] of data.entries()) {
    const result = validateCustomBlockDefinition(definition);
    if (!result.valid) {
      throw new UsageError(
        `--definitions[${index}] is invalid: ${result.issues.map((issue) => issue.message).join(" ")}`,
      );
    }
  }
  return data as CustomBlockDefinition[];
}

export function readDoNotTranslate(args: ParsedArgs, cwd: string): string[] {
  const file = fileFlag(args, "do-not-translate");
  if (file === undefined) return [];
  const data = readTemplateFile(file, cwd);
  if (
    !Array.isArray(data) ||
    data.length > 500 ||
    data.some(
      (term) =>
        typeof term !== "string" ||
        term.trim().length < 1 ||
        term.trim().length > 100,
    )
  ) {
    throw new UsageError(
      "--do-not-translate must be an array of at most 500 terms, each 1–100 characters.",
    );
  }
  return data.map((term: string) => term.trim());
}

function fileFlag(args: ParsedArgs, name: string): string | undefined {
  const file = flagValue(args, name);
  if (args.flags[name] !== undefined && !file?.trim()) {
    throw new UsageError(`--${name} needs a file.`);
  }
  return file;
}

/** Resolve each custom type from the same definitions used for validation. */
export function customBlockRenderOptions(
  definitions: readonly CustomBlockDefinition[],
): RenderOptions {
  if (definitions.length === 0) return {};
  const byType = new Map(
    definitions.map((definition) => [definition.type, definition]),
  );
  const liquid = createLiquid();
  const cachedStylesheets = new Map<string, string>();
  return {
    renderCustomBlock: async (block) => {
      const definition = byType.get(block.customType);
      if (
        !definition &&
        block.renderedStylesheet &&
        !cachedStylesheets.has(block.customType)
      ) {
        cachedStylesheets.set(block.customType, block.renderedStylesheet);
      }
      return definition
        ? String(
            await liquid.parseAndRender(definition.template, block.fieldValues),
          )
        : (block.renderedHtml ?? "");
    },
    getCustomBlockStylesheet: (type) =>
      byType.get(type)?.stylesheet ?? cachedStylesheets.get(type),
  };
}
