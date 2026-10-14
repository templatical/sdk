// Compiles a template to email HTML on the server: the renderer turns the
// editor's JSON into MJML, and the mjml package turns MJML into HTML.
import mjml2html from "mjml";
import { renderToMjml } from "@templatical/renderer";
import type { TemplateContent } from "@templatical/types";

export async function renderTemplate(content: TemplateContent): Promise<{ mjml: string; html: string }> {
  const mjml = await renderToMjml(content);
  const { html } = await mjml2html(mjml);
  return { mjml, html };
}
