export const labelClass =
  "tpl:block tpl:mb-1.5 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text-muted)]";

export const inputClass =
  "tpl:w-full tpl:h-10 tpl:px-3.5 tpl:py-1.5 tpl:text-sm tpl:border tpl:rounded-[var(--tpl-radius-sm)] tpl:shadow-[var(--tpl-shadow-sm)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)] tpl:border-[var(--tpl-border)] tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:outline-none tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[var(--tpl-ring)] tpl:placeholder:text-[var(--tpl-text-dim)]";

export const inputGroupInputClass =
  "tpl:w-full tpl:h-10 tpl:px-3.5 tpl:py-1.5 tpl:text-sm tpl:border tpl:rounded-l-[var(--tpl-radius-sm)] tpl:rounded-r-none tpl:border-r-0 tpl:shadow-[var(--tpl-shadow-sm)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)] tpl:border-[var(--tpl-border)] tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:outline-none tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[var(--tpl-ring)] tpl:placeholder:text-[var(--tpl-text-dim)]";

export const inputSuffixClass =
  "tpl:flex tpl:items-center tpl:px-2.5 tpl:text-xs tpl:border tpl:border-l-0 tpl:text-[var(--tpl-text-dim)] tpl:bg-[var(--tpl-bg-hover)] tpl:border-[var(--tpl-border)] tpl:rounded-r-[var(--tpl-radius-sm)]";

export const colorInputClass =
  "tpl:w-10 tpl:shrink-0 tpl:h-10 tpl:p-0.5 tpl:border tpl:rounded-[var(--tpl-radius-sm)] tpl:cursor-pointer tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)]";

export const colorTextClass =
  "tpl:flex-1 tpl:h-10 tpl:px-3.5 tpl:py-1.5 tpl:text-xs tpl:font-mono tpl:border tpl:rounded-[var(--tpl-radius-sm)] tpl:shadow-[var(--tpl-shadow-sm)] tpl:text-[var(--tpl-text)] tpl:bg-[var(--tpl-bg)] tpl:border-[var(--tpl-border)] tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:outline-none tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[var(--tpl-ring)]";

export const btnClass =
  "tpl:flex-1 tpl:px-2.5 tpl:py-[7px] tpl:text-sm tpl:font-medium tpl:cursor-pointer tpl:flex tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:text-[var(--tpl-text-muted)] tpl:bg-transparent tpl:transition-all tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:hover:bg-[var(--tpl-bg-hover)] tpl:hover:text-[var(--tpl-text)]";

export const btnActiveClass =
  "tpl:flex-1 tpl:px-2.5 tpl:py-[7px] tpl:text-sm tpl:font-medium tpl:cursor-pointer tpl:flex tpl:items-center tpl:justify-center tpl:rounded-[var(--tpl-radius-sm)] tpl:text-[var(--tpl-primary)] tpl:bg-[var(--tpl-primary-light)]";

export const cardClass =
  "tpl:rounded-[var(--tpl-radius)] tpl:bg-[var(--tpl-bg-elevated)] tpl:p-4 tpl:border tpl:border-[var(--tpl-border)] tpl:transition-colors tpl:duration-[120ms] tpl:ease-[cubic-bezier(0.16,1,0.3,1)] tpl:hover:bg-[var(--tpl-bg-hover)]";

export const removeItemBtnClass =
  "tpl:flex tpl:size-8 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:hover:border-[var(--tpl-danger)] tpl:hover:bg-[var(--tpl-danger-light)] tpl:hover:text-[var(--tpl-danger)]";

export const addItemBtnClass =
  "tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-dashed tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:hover:border-[var(--tpl-primary)] tpl:hover:text-[var(--tpl-primary)]";

export const monoTextareaClass =
  "tpl:w-full tpl:resize-y tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-2.5 tpl:py-2 tpl:font-mono tpl:text-xs tpl:text-[var(--tpl-text)] tpl:outline-none tpl:transition-all tpl:placeholder:text-[var(--tpl-text-dim)] tpl:focus:border-[var(--tpl-primary)] tpl:focus:shadow-[0_0_0_3px_var(--tpl-primary-light)]";

/**
 * The button system: two variants at two scales, composed from one base so a
 * change to focus, disabled or hover behaviour lands on all four at once.
 *
 * **Variants.** Primary is a Signal Amber surface, rare by design — amber
 * announces intent or selection, so a screen with several has nothing left to
 * emphasise. Secondary is the quiet default: muted at rest, saturating on hover,
 * which is how the rest of the chrome behaves so the canvas stays the foreground.
 *
 * **Scales.** The default is dialog and panel scale. The compact pair is for
 * dense chrome — the editor header, where 38px matches the viewport toggle's
 * outer box and 12px is the size every neighbouring control already uses (14px
 * beside those would be a 1.17x step at one weight, the flat scale the
 * Weight-Contrast Rule forbids).
 *
 * **Both are flat at rest.** Depth answers state, so `--tpl-shadow-sm` arrives on
 * hover. A resting shadow on a static control is the one thing DESIGN.md §5 says
 * the answer to is always no.
 *
 * **Primary's hover deepens, never lightens.** `--tpl-primary-hover` is a darker
 * amber; fading the surface with `opacity` instead washes it toward the page and
 * reads as the button going away rather than responding.
 *
 * Primary's label goes through `--tpl-on-primary` rather than naming `--tpl-bg`,
 * so the amber/label pairing is one decision — see the On-Amber Rule. It is
 * 2.80:1 in light mode, accepted under the Amber Contrast Exception, and 7.77:1
 * in dark.
 *
 * Duration and easing come from the `@theme` defaults in `styles/index.css`;
 * spelling them out per recipe is what let call sites drift off the house tempo.
 */
const btnBase =
  "tpl:inline-flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:border tpl:font-medium tpl:whitespace-nowrap tpl:transition-all tpl:focus-visible:outline-none tpl:focus-visible:shadow-[var(--tpl-ring)] tpl:disabled:cursor-not-allowed tpl:disabled:opacity-50";

const btnPrimarySkin =
  "tpl:border-transparent tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-on-primary)] tpl:hover:bg-[var(--tpl-primary-hover)] tpl:hover:shadow-[var(--tpl-shadow-sm)]";

const btnSecondarySkin =
  "tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] tpl:hover:bg-[var(--tpl-bg-hover)] tpl:hover:text-[var(--tpl-text)] tpl:hover:shadow-[var(--tpl-shadow-sm)]";

/**
 * Destructive actions. Outlined rather than filled, deliberately: a delete button
 * should be findable, not the loudest thing on the surface, and a filled danger
 * surface competes with the primary for the eye. It also costs nothing in
 * contrast — `--tpl-danger` on `--tpl-bg` and `--tpl-bg` on `--tpl-danger` are
 * the same pair, so filling buys no legibility.
 *
 * 3.76:1 in light and 5.41:1 in dark. That clears the 3:1 non-text floor in both
 * and the 4.5 text floor in dark; light mode falls short, which is the same
 * accepted trade the Amber Contrast Exception records — and a destructive action
 * is never signalled by colour alone here, since these buttons are always
 * confirm steps whose label says what they do.
 *
 * Hover deepens into `--tpl-danger-light` rather than fading, matching
 * `removeItemBtnClass`.
 */
const btnDangerSkin =
  "tpl:border-[var(--tpl-danger)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-danger)] tpl:hover:bg-[var(--tpl-danger-light)] tpl:hover:shadow-[var(--tpl-shadow-sm)]";

/** Dialog and panel scale. */
const btnSizeDefault = "tpl:rounded-md tpl:px-3 tpl:py-1.5 tpl:text-sm";

/** Dense-chrome scale: 38px tall, matching the header's other controls. */
const btnSizeCompact =
  "tpl:rounded-[var(--tpl-radius-sm)] tpl:px-3 tpl:py-2.5 tpl:text-xs";

export const primaryBtnClass = `${btnBase} ${btnPrimarySkin} ${btnSizeDefault}`;
export const secondaryBtnClass = `${btnBase} ${btnSecondarySkin} ${btnSizeDefault}`;
export const primaryBtnCompactClass = `${btnBase} ${btnPrimarySkin} ${btnSizeCompact}`;
export const secondaryBtnCompactClass = `${btnBase} ${btnSecondarySkin} ${btnSizeCompact}`;
export const dangerBtnClass = `${btnBase} ${btnDangerSkin} ${btnSizeDefault}`;
export const dangerBtnCompactClass = `${btnBase} ${btnDangerSkin} ${btnSizeCompact}`;

// Rich text toolbar presets
export const FONT_SIZE_OPTIONS = [
  "10px",
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "36px",
  "48px",
  "64px",
];

export const LINE_HEIGHT_OPTIONS = [
  "1",
  "1.2",
  "1.4",
  "1.5",
  "1.6",
  "1.8",
  "2",
  "2.5",
];

export const LETTER_SPACING_OPTIONS = [
  { label: "Normal", value: "normal" },
  { label: "-0.5px", value: "-0.5px" },
  { label: "0.5px", value: "0.5px" },
  { label: "1px", value: "1px" },
  { label: "1.5px", value: "1.5px" },
  { label: "2px", value: "2px" },
  { label: "3px", value: "3px" },
];

// Default color constants
export const DEFAULT_TEXT_COLOR = "#000000";
export const DEFAULT_BG_COLOR = "#ffffff";
export const DEFAULT_HIGHLIGHT_COLOR = "#ffff00";
export const DEFAULT_TABLE_ROW_BG = "#f2f2f2";
