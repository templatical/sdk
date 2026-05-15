/**
 * English rule messages. The source of truth — other locales annotate
 * themselves `typeof en` so missing or extra keys fail typecheck.
 *
 * Templates use `{name}` placeholders, interpolated by `formatMessage`.
 */
const en = {
  "a11y.img-missing-alt":
    "Image is missing alt text. Add a short description, or mark the image as decorative.",
  "a11y.img-alt-is-filename":
    'Alt text looks like a filename ("{alt}"). Replace with a short description of what the image conveys.',
  "a11y.img-alt-too-long":
    "Alt text is {length} characters; aim for under {max}.",
  "a11y.img-decorative-needs-empty-alt":
    "Decorative image has alt text. Either clear the alt text or unmark the image as decorative.",
  "a11y.img-linked-no-context":
    "Linked image alt describes the image but not the link destination. Include where the link goes (e.g. 'Buy spring sale').",
  "a11y.heading-empty": "Heading is empty. Add text or remove the block.",
  "a11y.heading-skip-level":
    "Heading jumps from H{from} to H{to}. Step one level at a time.",
  "a11y.heading-multiple-h1":
    "Email has more than one H1. Use H1 once for the main heading.",
  "a11y.link-empty": "A link in this block has no text and no described image.",
  "a11y.link-vague-text":
    'Link text "{text}" is vague. Describe the destination instead.',
  "a11y.link-href-empty": "A link in this block has an empty or '#' href.",
  "a11y.link-target-blank-no-rel":
    'Link opens in a new tab but is missing rel="noopener" — add it to prevent the destination from accessing window.opener.',
  "a11y.text-all-caps":
    "Long all-caps text is harder to read for everyone. Use sentence case.",
  "a11y.text-low-contrast":
    "Heading contrast is {ratio}:1; WCAG AA requires at least {required}:1.",
  "a11y.text-too-small": "Text is {size}px; aim for at least {min}px.",
  "a11y.button-vague-label":
    'Button label "{text}" is vague. Describe the action.',
  "a11y.button-touch-target":
    "Button is roughly {height}px tall; aim for at least {min}px to avoid mis-taps on mobile.",
  "a11y.button-low-contrast":
    "Button text contrast is {ratio}:1; WCAG AA requires at least {required}:1.",
  "a11y.missing-preheader":
    "No preheader text set. Inboxes will fall back to fragments of the first block.",
};

export default en;
