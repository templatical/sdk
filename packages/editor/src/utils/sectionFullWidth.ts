import {
  layoutWrapsSlot,
  toBorderRadiusCss,
  type BackgroundImage,
  type SectionBlock,
  type SectionWrapper,
  type SpacingValue,
  type TemplateContent,
} from "@templatical/types";

/** Fields a full-width toggle may put on the wrapper it creates. */
const TOGGLE_OWNED_KEYS = new Set([
  "fullWidth",
  "backgroundColor",
  "backgroundImage",
  "padding",
  "borderRadius",
]);

/**
 * A colour the canvas and the renderer paint. `""` is the picker's cleared
 * value; `"transparent"` is a real fill and must move with the band.
 */
function paintedColor(color: string | undefined): color is string {
  return typeof color === "string" && color !== "";
}

function hasOwnPadding(padding: SpacingValue | undefined): boolean {
  if (!padding) return false;
  return [padding.top, padding.right, padding.bottom, padding.left].some(
    (side) => side !== 0,
  );
}

function sectionHasOwnFill(section: SectionBlock): boolean {
  return (
    paintedColor(section.styles.backgroundColor) || !!section.backgroundImage
  );
}

/**
 * The wrapper holds only what the full-width toggle moved onto it: the flag,
 * and at most a background colour and image. Padding that paints nothing and
 * a square radius count as nothing of the wrapper's own — turning the toggle
 * off can put the fill back on the section and remove the wrapper.
 */
export function isToggleOwnedWrapper(wrapper: SectionWrapper): boolean {
  if (wrapper.fullWidth !== true) return false;
  if (hasOwnPadding(wrapper.padding)) return false;
  if (toBorderRadiusCss(wrapper.borderRadius) !== null) return false;
  return Object.keys(wrapper).every((key) => TOGGLE_OWNED_KEYS.has(key));
}

/**
 * Turning the toggle on would have to create a wrapper the host forbids:
 * section wrappers are off, or a layout already wraps the slot, and this
 * section has no wrapper yet. An existing wrapper only gains `fullWidth`.
 */
export function sectionFullWidthDisabled(
  section: SectionBlock,
  options: { sectionWrapper?: boolean; layout?: TemplateContent } = {},
): boolean {
  if (section.wrapper) return false;
  if (options.sectionWrapper === false) return true;
  return options.layout !== undefined && layoutWrapsSlot(options.layout);
}

function movedFill(
  section: SectionBlock,
): Pick<SectionWrapper, "backgroundColor" | "backgroundImage"> {
  const fill: Pick<SectionWrapper, "backgroundColor" | "backgroundImage"> = {};
  if (paintedColor(section.styles.backgroundColor)) {
    fill.backgroundColor = section.styles.backgroundColor;
  }
  if (section.backgroundImage) fill.backgroundImage = section.backgroundImage;
  return fill;
}

function stylesWithoutColor(section: SectionBlock): SectionBlock["styles"] {
  const styles = { ...section.styles };
  delete styles.backgroundColor;
  return styles;
}

/**
 * One partial for the section's full-width toggle — one `updateBlock`, one
 * undo step.
 *
 * On, with no wrapper: the section's background colour and image move onto a
 * new wrapper with `fullWidth`, and the section fill is cleared so the
 * content area is transparent over the band.
 * On, with a wrapper: only `fullWidth` is set. The section fill stays.
 * Off: `fullWidth` becomes false. A toggle-owned wrapper whose section has
 * no fill of its own is removed and the wrapper's current colour and image
 * move back onto the section. Editing that colour or image leaves the
 * wrapper toggle-owned while it has no padding or radius of its own.
 * When the section already has a content fill, the wrapper stays and only
 * `fullWidth` is cleared, so the band colour and the content fill both
 * remain. Padding or a corner radius keeps the wrapper the same way.
 */
export function applySectionFullWidth(
  section: SectionBlock,
  enabled: boolean,
): Partial<SectionBlock> {
  if (enabled) {
    if (section.wrapper) {
      return { wrapper: { ...section.wrapper, fullWidth: true } };
    }
    return {
      wrapper: { fullWidth: true, ...movedFill(section) },
      styles: stylesWithoutColor(section),
      backgroundImage: undefined,
    };
  }

  const wrapper = section.wrapper;
  if (!wrapper) return {};
  if (isToggleOwnedWrapper(wrapper) && !sectionHasOwnFill(section)) {
    const styles = { ...section.styles };
    if (paintedColor(wrapper.backgroundColor)) {
      styles.backgroundColor = wrapper.backgroundColor;
    }
    return {
      wrapper: undefined,
      styles,
      backgroundImage: wrapper.backgroundImage as BackgroundImage | undefined,
    };
  }
  return { wrapper: { ...wrapper, fullWidth: false } };
}

/**
 * Add wrapper turned off. A toggle-owned band gives its fill back to the
 * section; any other wrapper is dropped, padding and radius included.
 */
export function clearSectionWrapper(
  section: SectionBlock,
): Partial<SectionBlock> {
  const wrapper = section.wrapper;
  if (wrapper && isToggleOwnedWrapper(wrapper) && !sectionHasOwnFill(section)) {
    return applySectionFullWidth(section, false);
  }
  return { wrapper: undefined };
}
