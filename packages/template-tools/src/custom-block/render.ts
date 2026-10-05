// Renders a custom block the way the editor and the renderer do: Liquid over
// fieldValues for the HTML, then renderToMjml with that HTML and the
// definition's stylesheet, which the renderer emits once into <mj-head>.

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
  const liquid = createLiquid();
  return renderToMjml(template, {
    renderCustomBlock: async (block) =>
      String(await liquid.parseAndRender(def.template, block.fieldValues)),
    getCustomBlockStylesheet: (customType) =>
      customType === def.type ? def.stylesheet : undefined,
  });
}
