import { ref } from "vue";

/**
 * Whatever the last `compileMjmlDemo` call reported.
 *
 * `RenderProvider.compileMjml` resolves to HTML alone — a real backend would
 * put warnings in its response body — so this is the only place the demo has
 * to put them. A module ref rather than a return value: `App.vue`'s export
 * modal reads it after `editor.toHtml()` resolves, and `toHtml()`'s own
 * return type is just the HTML string, unchanged by whichever `render`
 * method produced it.
 */
export const mjmlWarnings = ref<string[]>([]);

/**
 * Demo `render.compileMjml`: MJML in, HTML out.
 *
 * This is the **cheap tier** of the render provider, and the whole reason the
 * contract has three methods. The playground has no backend at all — it
 * compiles in the browser with `mjml-browser` — yet wiring up this one
 * function is enough for `editor.toHtml()` to work, because the SDK still
 * renders the MJML itself. A non-Node backend does the same thing with any
 * mjml2html endpoint instead of standing up a Node sidecar to understand the
 * block model.
 */
export async function compileMjmlDemo(mjml: string): Promise<string> {
  const mod = (await import("mjml-browser")) as unknown as {
    default: unknown;
  };
  type Mjml2Html = (
    mjml: string,
    options?: { validationLevel?: "strict" | "soft" | "skip" },
  ) => Promise<{
    html: string;
    errors: { formattedMessage?: string; message: string }[];
  }>;
  const mjml2html: Mjml2Html =
    typeof mod.default === "function"
      ? (mod.default as Mjml2Html)
      : ((mod.default as { default: Mjml2Html }).default as Mjml2Html);
  const result = await mjml2html(mjml, { validationLevel: "soft" });
  mjmlWarnings.value = (result.errors ?? []).map(
    (e) => e.formattedMessage ?? e.message,
  );
  return result.html ?? "";
}
