// Static analysis of a custom block's Liquid template against its field
// model. The engine options must equal the editor's renderer
// (packages/editor/src/composables/useBlockRegistry.ts): a template that
// renders here and fails there, or the reverse, makes every check below lie.
// tests/custom-block-liquid.test.ts holds the two equal.

import { ForTag, Liquid, type Template } from "liquidjs";
import type { CustomBlockIssue, CustomBlockWorkingFile } from "./types";

export function createLiquid(): Liquid {
  return new Liquid({ strictVariables: false, strictFilters: false });
}

// `forloop` is Liquid's own loop object, never a field.
const LIQUID_GLOBALS = new Set(["forloop"]);

/** A tag's child templates, from liquidjs's static-analysis generator. */
function childTemplates(template: Template): Template[] {
  if (!template.children) return [];
  const gen = template.children(false, true);
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value ?? [];
}

/** Every `for` tag in the tree, nested ones included. */
function forTags(templates: Template[]): ForTag[] {
  const found: ForTag[] = [];
  for (const t of templates) {
    if (t instanceof ForTag) found.push(t);
    found.push(...forTags(childTemplates(t)));
  }
  return found;
}

/**
 * The field a loop iterates, when its collection is a bare identifier.
 * `for x in a.b` iterates a property of `a`, not `a`, so it has none.
 */
function bareCollection(tag: ForTag): string | null {
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
  let parsed: Template[];
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

  const issues: CustomBlockIssue[] = [];
  const fields = new Map(
    def.fields.map((f, i) => [f.key, { field: f, index: i }]),
  );

  const globals = new Set(
    engine
      .globalVariableSegmentsSync(def.template)
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
      for (const [name] of engine.globalVariableSegmentsSync(text)) {
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
    for (const [head, sub] of engine.variableSegmentsSync(loop.templates)) {
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
