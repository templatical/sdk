/**
 * English rule messages. The source of truth — other locales annotate
 * themselves `typeof en` so missing or extra keys fail typecheck.
 *
 * Templates use `{name}` placeholders, interpolated by `formatMessage`.
 */
const en = {
  "img-missing-alt":
    "Image is missing alt text. Add a short description, or mark the image as decorative.",
  "img-alt-is-filename":
    'Alt text looks like a filename ("{alt}"). Replace with a short description of what the image conveys.',
  "img-alt-too-long": "Alt text is {length} characters; aim for under {max}.",
  "img-decorative-needs-empty-alt":
    "Decorative image has alt text. Either clear the alt text or unmark the image as decorative.",
  "img-linked-no-context":
    "Linked image alt describes the image but not the link destination. Include where the link goes (e.g. 'Buy spring sale').",
  "heading-empty": "Heading is empty. Add text or remove the block.",
  "heading-skip-level":
    "Heading jumps from H{from} to H{to}. Step one level at a time.",
  "heading-multiple-h1":
    "Email has more than one H1. Use H1 once for the main heading.",
  "link-empty": "A link in this block has no text and no described image.",
  "link-vague-text":
    'Link text "{text}" is vague. Describe the destination instead.',
  "link-href-empty": "A link in this block has an empty or '#' href.",
  "link-target-blank-no-rel":
    'Link opens in a new tab but is missing rel="noopener" — add it to prevent the destination from accessing window.opener.',
  "text-all-caps":
    "Long all-caps text is harder to read for everyone. Use sentence case.",
  "text-low-contrast":
    "Heading contrast is {ratio}:1; WCAG AA requires at least {required}:1.",
  "text-too-small": "Text is {size}px; aim for at least {min}px.",
  "button-vague-label": 'Button label "{text}" is vague. Describe the action.',
  "button-touch-target":
    "Button is roughly {height}px tall; aim for at least {min}px to avoid mis-taps on mobile.",
  "button-low-contrast":
    "Button text contrast is {ratio}:1; WCAG AA requires at least {required}:1.",
  "missing-preheader":
    "No preheader text set. Inboxes will fall back to fragments of the first block.",
};

export default en;
