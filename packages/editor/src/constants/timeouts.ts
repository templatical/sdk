/** Timeout in ms for editor initialization before giving up. */
export const INIT_TIMEOUT_MS = 30000;

/** Duration in ms to show the collaboration undo warning toast. */
export const COLLAB_UNDO_WARNING_MS = 4000;

/** Default debounce in ms for auto-save when not configured. */
export const DEFAULT_AUTO_SAVE_DEBOUNCE_MS = 5000;

/** Maximum upload file size in bytes (10 MB). */
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Debounce in ms before an edited image src is sent to `resolveImageUrl`.
 * The src input commits per keystroke, so this is what turns "per keystroke"
 * into "per committed value" for the host's resolver. The initial src of a
 * mounted block resolves immediately (template load shouldn't wait).
 */
export const RESOLVE_IMAGE_DEBOUNCE_MS = 300;
