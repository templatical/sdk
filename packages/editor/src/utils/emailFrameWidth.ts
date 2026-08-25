import type { TemplateSettings, ViewportSize } from "@templatical/types";

/**
 * Width a mobile preview renders at. Not the template's own width — a phone
 * viewport is narrower than any sensible email body, so every viewport-aware
 * surface clamps to this.
 */
export const MOBILE_EMAIL_WIDTH = 375;

/**
 * Fallback body width when no template settings are available — headless mounts
 * and tests. Matches `createDefaultTemplateContent`'s default.
 */
export const DEFAULT_EMAIL_WIDTH = 600;

/**
 * The width an email body lays itself out against, for a given viewport.
 *
 * **The single source of truth for every surface that renders blocks**: the
 * canvas, the preview canvas, and the save dialog's scaled preview rows. They
 * have to agree — `SavedBlockPreviewRow` divides by this number to compute its
 * `transform: scale()`, so if it and the canvas disagreed the rows would be
 * scaled by the wrong factor and overflow or under-fill their frame. Sharing one
 * function makes that agreement structural instead of three constants that happen
 * to match today.
 *
 * Pass the *current* template's settings even when previewing content from
 * elsewhere (a saved block stores only `Block[]`): the current settings are what
 * the content will actually be rendered at.
 */
export function getEmailFrameWidth(
  settings: TemplateSettings | undefined,
  viewport: ViewportSize = "desktop",
): number {
  if (viewport === "mobile") return MOBILE_EMAIL_WIDTH;
  return settings?.width ?? DEFAULT_EMAIL_WIDTH;
}

/**
 * Band of email background shown on each side of the content column.
 *
 * A surface that renders blocks at exactly the body width has nowhere for
 * `settings.backgroundColor` to show: a full-width section's own background
 * covers every pixel of it, so the body colour reads as unset even though the
 * sent email paints it across the whole client viewport. The gutter is what
 * makes it visible, mirroring how `mj-body background-color` renders beside the
 * centred content.
 *
 * Fixed rather than "fill the container" so the band never overwhelms the
 * content on a wide monitor. `Canvas.vue` adds it to both sides of a fixed
 * stage; `BlockPreviewCanvas` treats it as the cap on a fluid one, because a
 * fixed 792px stage overflows every dialog it lives in.
 */
export const EMAIL_GUTTER = 96;

/**
 * How a viewport switch animates the frame.
 *
 * Lives here rather than being written out per call site so every surface that
 * switches viewport eases identically — the canvas's toggle and the test-email
 * dialog's should feel like the same control, not two similar ones. The slight
 * overshoot in the curve is deliberate and matches the editor's other viewport
 * transitions.
 *
 * Only `width` transitions: block content re-flows for the new viewport in the
 * same frame, exactly as it does on the canvas, so animating height as well would
 * lag the reflow behind the frame.
 */
export const EMAIL_FRAME_WIDTH_TRANSITION =
  "width 300ms cubic-bezier(0.34, 1.56, 0.64, 1)";
