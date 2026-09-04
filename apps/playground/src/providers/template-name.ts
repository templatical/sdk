/** Shared slug for every per-template storage key (and the demo template id). */
export function slugFor(templateName: string): string {
  return templateName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Stand-in template name for content that came from an import or a share link. */
export const SCRATCH_TEMPLATE_NAME = "Scratch";
