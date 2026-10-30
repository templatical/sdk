// Specimen states use the shared Liquid engine; MJML rendering passes the
// definition to the renderer, which resolves field values and stylesheet.

import { renderToMjml } from "@templatical/renderer";
import type { TemplateContent } from "@templatical/types";
import { createLiquid } from "./liquid";
import {
  buildSpecimen,
  buildSpecimenTemplate,
  type SpecimenInstance,
  type SpecimenState,
} from "./specimen";
import type { CustomBlockWorkingFile } from "./types";

export interface RenderedState {
  state: SpecimenState;
  html: string;
}

export async function renderStates(
  def: CustomBlockWorkingFile,
  instances: SpecimenInstance[] = buildSpecimen(def),
): Promise<RenderedState[]> {
  const liquid = createLiquid();
  return Promise.all(
    instances.map(async (i) => ({
      state: i.state,
      html: String(await liquid.parseAndRender(def.template, i.fieldValues)),
    })),
  );
}

export async function renderSpecimenMjml(
  def: CustomBlockWorkingFile,
  template: TemplateContent = buildSpecimenTemplate(def),
): Promise<string> {
  return renderToMjml(template, { customBlocks: [def] });
}
