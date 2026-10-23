const en = {
  templates: {
    unsupported: "{feature} doesn't work in {unsupported}.",
    partial: "{feature} only partly works in {partial}.",
    mixed:
      "{feature} doesn't work in {unsupported} and only partly works in {partial}.",
  },
  more: "{n} more",
  features: {
    "css-display-flex": {
      feature: "Flex layout ({excerpt})",
      suggestion:
        "Lay the content out with a section and columns, or with a table.",
    },
    "css-display-grid": {
      feature: "Grid layout ({excerpt})",
      suggestion:
        "Lay the content out with a section and columns, or with a table.",
    },
    "css-position": {
      feature: "position: {value}",
      suggestion:
        "Remove the positioning and lay the content out with a section and columns, or with a table.",
    },
    "css-variables": {
      feature: "A CSS variable (var(--…))",
      suggestion: "Write the value itself instead of var(--…).",
    },
    "css-at-import": {
      feature: "The @import rule",
      suggestion: "Inline the rules as style attributes.",
    },
    "html-link": {
      feature: 'An external stylesheet (<link rel="stylesheet">)',
      suggestion: "Inline the styles as style attributes.",
    },
    "html-style": {
      feature: "A <style> element in the email body",
      suggestion: "Inline the rules as style attributes.",
    },
    "html-svg": {
      feature: "An inline <svg> element",
      suggestion: "Use a PNG or JPEG image instead.",
    },
    "html-form": {
      feature: "A form (<form>, <input>, <select> or <textarea>)",
      suggestion: "Link to a form on a web page instead.",
    },
    "html-object": {
      feature: "The <object> element",
      suggestion: "Use an image that links to the content instead.",
    },
    "html-video": {
      feature: "The <video> element",
      suggestion: "Use the Video block, which shows a linked thumbnail.",
    },
    "html-audio": {
      feature: "The <audio> element",
      suggestion: "Link to the audio file or a page that plays it.",
    },
    "css-width": {
      feature: "width on a <{tag}> element",
      suggestion:
        "Set the width on a table cell, or use the width attribute on images.",
    },
    "css-max-width": {
      feature: "max-width on a <{tag}> element",
      suggestion: "Put the max-width on a table instead.",
    },
    "css-float": {
      feature: "A float declaration ({excerpt}, source: {tag})",
      suggestion: "Use align on a table or image, or a section with columns.",
    },
    "css-background-image": {
      feature: "A background image without a fallback color",
      suggestion:
        "Add a background-color (or bgcolor) the text stays readable on.",
    },
    "image-base64": {
      feature: "A base64 image ({excerpt})",
      suggestion: "Upload the image and use its URL.",
    },
  },
  hand: {
    "compat.html-script": {
      message:
        "Email clients don't run JavaScript, so this <script> element does nothing.",
      suggestion: "Remove the <script> element.",
    },
    "compat.html-iframe": {
      message:
        "Most email clients block <iframe> elements, so this content doesn't show.",
      suggestion: "Link to the content instead, for example with an image.",
    },
    "compat.gmail-clipping": {
      message:
        "This email's HTML is {size} KB. Gmail clips messages over about 102 KB and shows the rest only after a click, and sending services add tracking links before Gmail measures.",
      suggestion:
        "Bring it under {max} KB: shorten the content, move long sections to a web page, or replace base64 images with hosted ones.",
    },
  },
};

export default en;
