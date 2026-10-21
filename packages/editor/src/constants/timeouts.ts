/** Timeout in ms for editor initialization before giving up. */
export const INIT_TIMEOUT_MS = 30000;

/**
 * Debounce in ms before an edited image src is sent to `resolveImageUrl`.
 * The src input commits per keystroke, so this is what turns "per keystroke"
 * into "per committed value" for the host's resolver. The initial src of a
 * mounted block resolves immediately (template load shouldn't wait).
 */
export const RESOLVE_IMAGE_DEBOUNCE_MS = 300;

/**
 * How long a measurement of an image's natural size waits for the image to
 * load before it gives up and reports no size.
 */
export const NATURAL_SIZE_TIMEOUT_MS = 10000;
