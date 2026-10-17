/**
 * `background-size` keywords. In Outlook on Windows (VML), `cover` and
 * `contain` draw a single frame when `repeat` is off and tile when it is on;
 * `auto` always tiles from the top center, whatever `position` and `repeat`
 * say.
 */
export type BackgroundSize = "cover" | "contain" | "auto";

export type BackgroundPositionX = "left" | "center" | "right";

export type BackgroundPositionY = "top" | "center" | "bottom";

/**
 * An image painted behind a section or a wrapper band. The element's own
 * `backgroundColor` is its fallback: it shows while the image loads, with
 * images off, and in clients without background-image support.
 */
export interface BackgroundImage {
  url: string;
  size: BackgroundSize;
  position: { x: BackgroundPositionX; y: BackgroundPositionY };
  /** `false` paints the image once; `true` tiles it. */
  repeat: boolean;
  /**
   * The image file's own width in px, when known: given by the media library,
   * measured by the editor when the author sets the URL, or read by an
   * importer (from MJML, the hero's `background-width`, which may be the box's
   * size rather than the file's). Only the ratio with `naturalHeight` is used:
   * a section hero with `height: "image"` keeps its box at that shape. Both or
   * neither; one without the other reads as unknown.
   */
  naturalWidth?: number;
  /**
   * The image file's own height in px, when known; it pairs with
   * `naturalWidth`, and only their ratio is used. Both or neither.
   */
  naturalHeight?: number;
}

/**
 * A background image resolved to the values the renderer emits as MJML
 * attributes and the editor canvas applies as CSS, so the two can't disagree.
 */
export interface ResolvedBackgroundImage {
  /** Trimmed, with `encodeCssUrl` applied. */
  url: string;
  size: BackgroundSize;
  /** `background-position`, x first: `"center top"`. */
  position: string;
  repeat: "repeat" | "no-repeat";
}

export const BACKGROUND_SIZES: readonly BackgroundSize[] = [
  "cover",
  "contain",
  "auto",
];

export const BACKGROUND_POSITIONS_X: readonly BackgroundPositionX[] = [
  "left",
  "center",
  "right",
];

export const BACKGROUND_POSITIONS_Y: readonly BackgroundPositionY[] = [
  "top",
  "center",
  "bottom",
];

/** A newly set image: one banner-sized picture, centered, not tiled. */
export function createBackgroundImage(url: string): BackgroundImage {
  return {
    url,
    size: "cover",
    position: { x: "center", y: "center" },
    repeat: false,
  };
}

/**
 * Percent-encode the characters that can end a quoted CSS `url()` string —
 * `'`, `"`, `\` and control characters (line breaks included). MJML pastes
 * `background-url` verbatim into `url('…')`, and an HTML entity like `&#039;`
 * is decoded before the CSS is parsed, so entity escaping alone lets a URL
 * close the string. Spaces and parentheses are legal inside a quoted string
 * and are kept, which leaves merge tags such as `{{ hero_url }}` intact.
 */
export function encodeCssUrl(url: string): string {
  let out = "";
  for (const char of url) {
    const code = char.charCodeAt(0);
    const unsafe =
      code < 0x20 ||
      code === 0x7f ||
      char === "'" ||
      char === '"' ||
      char === "\\";
    out += unsafe
      ? `%${code.toString(16).toUpperCase().padStart(2, "0")}`
      : char;
  }
  return out;
}

/**
 * Resolve a background image for output. `null` when there is no usable URL.
 * Size and position are checked against their keyword lists — a value from
 * tampered JSON falls back to `cover` / `center` instead of reaching MJML,
 * which copies these attributes into inline CSS.
 */
export function resolveBackgroundImage(
  bg: BackgroundImage | undefined,
): ResolvedBackgroundImage | null {
  const url = typeof bg?.url === "string" ? bg.url.trim() : "";
  if (!bg || !url) {
    return null;
  }

  const size = BACKGROUND_SIZES.includes(bg.size) ? bg.size : "cover";
  const position = bg.position;
  const x =
    position && BACKGROUND_POSITIONS_X.includes(position.x)
      ? position.x
      : "center";
  const y =
    position && BACKGROUND_POSITIONS_Y.includes(position.y)
      ? position.y
      : "center";

  return {
    url: encodeCssUrl(url),
    size,
    position: `${x} ${y}`,
    repeat: bg.repeat ? "repeat" : "no-repeat",
  };
}
