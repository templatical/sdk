/**
 * Consumer-facing shape of the `htmlBlockPreview` editor config option.
 *
 * Controls whether an HTML block's raw content renders as a live preview in
 * the editor canvas — inside a sandboxed iframe — instead of the static
 * placeholder card. Off by default. Accepts a bare boolean or an object so the
 * shape can grow (e.g. render modes, resource policies) without a breaking
 * change; today the object carries only `enabled`.
 */
export type HtmlBlockPreviewConfig = boolean | { enabled: boolean };

/**
 * Normalize `htmlBlockPreview` to a plain boolean for the provide/inject layer.
 * `undefined` and `false` → `false`; `true` and `{ enabled: true }` → `true`;
 * `{ enabled: false }` → `false`.
 */
export function resolveHtmlBlockPreview(
  config: HtmlBlockPreviewConfig | undefined,
): boolean {
  if (typeof config === "boolean") {
    return config;
  }
  return config?.enabled ?? false;
}
