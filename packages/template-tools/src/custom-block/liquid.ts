// Static analysis of a custom block's Liquid template against its field
// model. Block output uses the shared @templatical/types Liquid factory,
// so checks, CLI rendering, the editor and headless callers share one engine.
// Recipes use their separate, unescaped factory below.

import * as liquidjs from "liquidjs";
import { createCustomBlockLiquid } from "@templatical/types";
import type { CustomBlockIssue, CustomBlockWorkingFile } from "./types";

export function createLiquid(): liquidjs.Liquid {
  return createCustomBlockLiquid(liquidjs);
}

/** Request URLs and JSON bodies need their original, non-HTML escaping. */
export function createRecipeLiquid(): liquidjs.Liquid {
  return new liquidjs.Liquid({
    strictVariables: false,
    strictFilters: false,
    // Resolve file tags against an empty map, never the disk: a recipe
    // body must not be able to carry a local file to the API host.
    templates: {},
  });
}

// `forloop` is Liquid's own loop object, never a field.
const LIQUID_GLOBALS = new Set(["forloop"]);

// Tags that load another template file. A custom block's template and a
// recipe are each one string, so nothing exists for them to load.
const FILE_TAGS = new Set(["include", "render", "layout"]);

// Static analysis follows include/render into the partial by default, which
// the engine refuses to load, so every analysis call skips partials. The
// file-tag rule reports those tags instead.
export const NO_PARTIALS = { partials: false } as const;

/** A tag's child templates, from liquidjs's static-analysis generator. */
function childTemplates(template: liquidjs.Template): liquidjs.Template[] {
  if (!template.children) return [];
  const gen = template.children(false, true);
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value ?? [];
}

/** Every template in the tree, depth-first, nested tags included. */
function allTemplates(templates: liquidjs.Template[]): liquidjs.Template[] {
  return templates.flatMap((t) => [t, ...allTemplates(childTemplates(t))]);
}

/** Every `for` tag in the tree, nested ones included. */
function forTags(templates: liquidjs.Template[]): liquidjs.ForTag[] {
  return allTemplates(templates).filter(
    (t): t is liquidjs.ForTag => t instanceof liquidjs.ForTag,
  );
}

/** Names of the file-loading tags in the tree, each once, in source order. */
export function fileTags(templates: liquidjs.Template[]): string[] {
  const names = allTemplates(templates)
    .filter(
      (t): t is liquidjs.Tag =>
        t instanceof liquidjs.Tag && FILE_TAGS.has(t.name),
    )
    .map((t) => t.name);
  return [...new Set(names)];
}

/** How many `{{ }}` outputs in the tree reach the text without a `json` filter. */
export function outputsWithoutJson(templates: liquidjs.Template[]): number {
  return allTemplates(templates).filter(
    (t) =>
      t instanceof liquidjs.Output &&
      !t.value.filters.some((f) => f.name === "json"),
  ).length;
}

/** The message for a template or recipe that uses a file-loading tag. */
export function fileTagMessage(name: string, where: string): string {
  return `\`{% ${name} %}\` loads another template file, and ${where} has none to load. Write its content inline instead.`;
}

/**
 * The field a loop iterates, when its collection is a bare identifier.
 * `for x in a.b` iterates a property of `a`, not `a`, so it has none.
 */
function bareCollection(tag: liquidjs.ForTag): string | null {
  const c = tag.collection as {
    variable?: unknown;
    props?: Array<{ content?: unknown }>;
  };
  if (c.variable !== undefined || c.props?.length !== 1) return null;
  const name = c.props[0].content;
  return typeof name === "string" ? name : null;
}

export function checkLiquid(def: CustomBlockWorkingFile): CustomBlockIssue[] {
  const engine = createLiquid();
  let parsed: liquidjs.Template[];
  try {
    parsed = engine.parse(def.template);
  } catch (err) {
    return [
      {
        ruleId: "liquid.parse",
        severity: "error",
        path: "/template",
        message: `The template does not parse: ${(err as Error).message}`,
      },
    ];
  }

  const issues: CustomBlockIssue[] = fileTags(parsed).map((name) => ({
    ruleId: "liquid.file-tag",
    severity: "error",
    path: "/template",
    message: fileTagMessage(name, "a custom block"),
  }));
  const fields = new Map(
    def.fields.map((f, i) => [f.key, { field: f, index: i }]),
  );

  const globals = new Set(
    engine
      .globalVariableSegmentsSync(def.template, NO_PARTIALS)
      .map((segments) => String(segments[0]))
      .filter((name) => !LIQUID_GLOBALS.has(name)),
  );
  for (const name of globals) {
    if (!fields.has(name)) {
      issues.push({
        ruleId: "liquid.undefined-variable",
        severity: "error",
        path: "/template",
        message: `The template reads \`${name}\`, which no field defines.`,
      });
    }
  }
  // A field only the data-source recipe reads (the product id it fetches by)
  // is in use; recipe Liquid that fails to parse is reported by checkRecipe.
  const recipeReads = new Set<string>();
  const request = def.dataSourcePreview?.request;
  for (const text of [request?.url, request?.body]) {
    if (text === undefined) continue;
    try {
      for (const [name] of engine.globalVariableSegmentsSync(
        text,
        NO_PARTIALS,
      )) {
        recipeReads.add(String(name));
      }
    } catch {
      /* reported by checkRecipe */
    }
  }
  for (const [key, { index }] of fields) {
    if (!globals.has(key) && !recipeReads.has(key)) {
      issues.push({
        ruleId: "liquid.unused-field",
        severity: "warning",
        path: `/fields/${index}`,
        message: `Field \`${key}\` is never read by the template or the data-source recipe.`,
      });
    }
  }

  // Each loop's body is checked against that loop's own collection, so two
  // loops may reuse one local name over different repeatables.
  for (const loop of forTags(parsed)) {
    const local = loop.variable;
    const collection = bareCollection(loop);
    if (collection === null) continue;
    const target = fields.get(collection)?.field;
    if (!target) continue;
    if (target.type !== "repeatable") {
      issues.push({
        ruleId: "liquid.loop-not-repeatable",
        severity: "error",
        path: "/template",
        message: `\`{% for ${local} in ${collection} %}\` iterates \`${collection}\`, which is a ${target.type} field, not a repeatable.`,
      });
      continue;
    }
    for (const [head, sub] of engine.variableSegmentsSync(
      loop.templates,
      NO_PARTIALS,
    )) {
      if (String(head) !== local || typeof sub !== "string") continue;
      if (!target.fields.some((f) => f.key === sub)) {
        issues.push({
          ruleId: "liquid.unknown-item-key",
          severity: "error",
          path: "/template",
          message: `\`${local}.${sub}\` reads \`${sub}\`, which \`${collection}\`'s items don't define.`,
        });
      }
    }
  }
  return issues;
}
