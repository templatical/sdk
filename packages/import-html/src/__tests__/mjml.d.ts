/**
 * `mjml` ships no type declarations, and this package typechecks its own
 * `src/__tests__` tree (`tsconfig.json` has `include: ["src"]`), so the
 * round-trip oracle's compile step needs one or `tsc --noEmit` fails with
 * TS7016.
 *
 * Narrowed to the members the oracle reads. `mjml2html` returns a Promise in
 * v5 — dropping that here would let an un-awaited call typecheck and then
 * hand `undefined` to the importer.
 */
declare module "mjml" {
  interface MjmlCompileOptions {
    validationLevel?: "strict" | "soft" | "skip";
  }

  interface MjmlCompileResult {
    html: string;
    errors: unknown[];
  }

  export default function mjml2html(
    mjml: string,
    options?: MjmlCompileOptions,
  ): Promise<MjmlCompileResult>;
}
