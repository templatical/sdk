/**
 * Viewport-space caret geometry for `<input>` / `<textarea>` elements.
 *
 * Native text controls expose no caret coordinates (unlike ProseMirror, which
 * hands the merge-tag popup a `clientRect()`). The standard workaround is a
 * hidden "mirror" element that clones the field's text metrics; the caret's
 * pixel position is read from a marker span placed at the caret offset. This
 * lets the input/textarea autocomplete anchor its popup at the caret exactly
 * like the rich-text editor does.
 *
 * Adapted from component/textarea-caret-position (MIT). Returns a viewport
 * `DOMRect` (same coordinate space as `Range.getBoundingClientRect`) so the
 * shared merge-tag popup controller positions it identically to the TipTap path.
 */

// Computed-style properties copied onto the mirror so its text wraps and
// measures exactly like the source field.
const MIRRORED_PROPERTIES = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "whiteSpace",
  "wordWrap",
  "wordBreak",
] as const;

function toRect(left: number, top: number, bottom: number): DOMRect {
  const height = bottom - top;
  return {
    left,
    top,
    bottom,
    right: left,
    width: 0,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/**
 * Returns the viewport rect of the caret at `position` in a text field, or
 * `null` when the field isn't laid out (detached / no view). The rect is a
 * zero-width vertical strip at the caret, one line tall — matching the shape
 * `Range.getBoundingClientRect()` produces for a collapsed selection.
 */
export function getCaretRect(
  el: HTMLInputElement | HTMLTextAreaElement,
  position: number,
): DOMRect | null {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  if (!win) return null;

  const isInput = el.tagName === "INPUT";
  const style = win.getComputedStyle(el);

  const mirror = doc.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  const s = mirror.style;
  s.position = "absolute";
  s.visibility = "hidden";
  s.top = "0";
  s.left = "0";
  s.overflow = "hidden";
  s.whiteSpace = isInput ? "pre" : "pre-wrap";
  s.wordWrap = isInput ? "normal" : "break-word";
  const target = s as unknown as Record<string, string>;
  const source = style as unknown as Record<string, string>;
  for (const prop of MIRRORED_PROPERTIES) {
    target[prop] = source[prop];
  }
  // A single-line input never wraps; let the mirror grow with the text so the
  // marker's horizontal offset tracks the caret.
  if (isInput) {
    s.width = "auto";
    s.whiteSpace = "pre";
  }

  const value = el.value;
  let head = value.slice(0, position);
  if (isInput) {
    // <input> collapses whitespace runs to a single rendered space; replace
    // with non-breaking spaces so the mirror's width matches the field.
    head = head.replace(/\s/g, " ");
  }
  mirror.textContent = head;

  const marker = doc.createElement("span");
  // Remaining text (or a placeholder) gives the marker the caret line's height.
  marker.textContent = value.slice(position) || ".";
  mirror.appendChild(marker);

  doc.body.appendChild(mirror);
  const markerTop = marker.offsetTop;
  const markerLeft = marker.offsetLeft;
  doc.body.removeChild(mirror);

  const elRect = el.getBoundingClientRect();
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;
  const lineHeight =
    parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 0;

  const left = elRect.left + markerLeft + borderLeft - el.scrollLeft;

  // A single-line input vertically centers its text, which the block-flow
  // mirror can't replicate — anchor vertically to the field itself so the
  // popup sits directly under the input. Textareas use the measured caret line.
  if (isInput) {
    return toRect(left, elRect.top, elRect.bottom);
  }

  const top = elRect.top + markerTop + borderTop - el.scrollTop;
  return toRect(left, top, top + lineHeight);
}
