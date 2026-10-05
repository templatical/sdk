// The optional `mjml` peer, resolved from the user's cwd first. The SDK
// bundles no MJML compiler by design, so a missing peer is either skipped
// (validate) or a hard stop with an install hint (render --format html).
//
// The mjml package's top-level function is `async`, so it always returns a
// Promise even though the underlying compile is synchronous.

import { MissingDependencyError } from "./io";
import { resolveOptional } from "./resolve-optional";

export type Mjml2Html = (
  mjml: string,
  options?: Record<string, unknown>,
) => Promise<{ html: string; errors: unknown[] }>;

export async function loadMjml(cwd: string): Promise<Mjml2Html | null> {
  const mod = await resolveOptional<{ default: Mjml2Html }>("mjml", cwd);
  return mod ? mod.default : null;
}

export async function requireMjml(
  cwd: string,
  purpose: string,
): Promise<Mjml2Html> {
  const mjml = await loadMjml(cwd);
  if (!mjml) {
    throw new MissingDependencyError(
      "mjml",
      `${purpose} needs the optional \`mjml\` package, which isn't installed.\n  npm install mjml`,
    );
  }
  return mjml;
}
