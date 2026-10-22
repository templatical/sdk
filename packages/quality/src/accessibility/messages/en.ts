const en = {
  "a11y.img-missing-alt": {
    message: "Image is missing alt text.",
    suggestion: "Add a short description, or mark the image as decorative.",
  },
  "a11y.img-alt-is-filename": {
    message: 'Alt text looks like a filename ("{alt}").',
    suggestion: "Replace with a short description of what the image conveys.",
  },
  "a11y.img-alt-too-long": {
    message: "Alt text is {length} characters.",
    suggestion: "Keep alt text under {max} characters.",
  },
  "a11y.img-decorative-needs-empty-alt": {
    message: "Decorative image has alt text.",
    suggestion: "Either clear the alt text or unmark the image as decorative.",
  },
  "a11y.img-linked-no-context": {
    message:
      "Linked image alt describes the image but not the link destination.",
    suggestion: "Include where the link goes (e.g. 'Buy spring sale').",
  },
  "a11y.heading-empty": {
    message: "Heading is empty.",
    suggestion: "Add text or remove the block.",
  },
  "a11y.heading-skip-level": {
    message: "Heading jumps from H{from} to H{to}.",
    suggestion: "Step one level at a time.",
  },
  "a11y.heading-multiple-h1": {
    message: "Email has more than one H1.",
    suggestion: "Use H1 once for the main heading.",
  },
  "a11y.link-empty": {
    message: "A link in this block has no text and no described image.",
    suggestion: "Add link text or describe the linked image.",
  },
  "a11y.link-vague-text": {
    message: 'Link text "{text}" is vague.',
    suggestion: "Describe the destination instead.",
  },
  "a11y.link-href-empty": {
    message: "A link in this block has an empty or '#' href.",
    suggestion: "Add a destination URL or remove the link.",
  },
  "a11y.link-target-blank-no-rel": {
    message: 'Link opens in a new tab but is missing rel="noopener".',
    suggestion:
      'Add rel="noopener" to prevent the destination from accessing window.opener.',
  },
  "a11y.link-nested-anchor": {
    message:
      "A link is nested inside another link. Nested anchors are invalid HTML and clients render them inconsistently.",
    suggestion: "Flatten them to a single anchor.",
  },
  "a11y.text-all-caps": {
    message: "Long all-caps text is harder to read for everyone.",
    suggestion: "Use sentence case.",
  },
  "a11y.text-justified": {
    message:
      "Justified text stretches word spacing into uneven 'rivers' of white space, which is hardest to track for dyslexic and low-vision readers.",
    suggestion: "Use left-aligned text.",
  },
  "a11y.text-low-contrast": {
    message: "Heading contrast is {ratio}:1.",
    suggestion: "Increase contrast to at least {required}:1 for WCAG AA.",
  },
  "a11y.text-too-small": {
    message: "Text is {size}px.",
    suggestion: "Increase the size to at least {min}px.",
  },
  "a11y.button-vague-label": {
    message: 'Button label "{text}" is vague.',
    suggestion: "Describe the action.",
  },
  "a11y.button-touch-target": {
    message: "Button is roughly {height}px tall.",
    suggestion:
      "Increase its height to at least {min}px to avoid mis-taps on mobile.",
  },
  "a11y.button-low-contrast": {
    message: "Button text contrast is {ratio}:1.",
    suggestion: "Increase contrast to at least {required}:1 for WCAG AA.",
  },
  "a11y.missing-preheader": {
    message:
      "No preheader text is set, so inboxes show fragments of the first block.",
    suggestion: "Add preheader text that previews the email.",
  },
};

export default en;
