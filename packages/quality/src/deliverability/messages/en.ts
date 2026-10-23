const en = {
  "deliverability.link-text-domain-mismatch": {
    message:
      "The link text shows {textHost}, but the link goes to {linkHost}. Spam filters flag links like this as phishing.",
    suggestion:
      "Make the text match the destination, or use words instead of an address.",
  },
  "deliverability.url-shortener": {
    message:
      "This link goes through the URL shortener {host}. Spam filters treat shortener links with suspicion because they hide the destination.",
    suggestion: "Link to the destination instead.",
  },
  "deliverability.ip-address-url": {
    message:
      "This link points to the IP address {host} instead of a domain. Spam filters score links like this as spam.",
    suggestion: "Link to your domain.",
  },
  "deliverability.low-text": {
    message:
      "This email has images but only {count} characters of text (under {min}). Some spam filters score image-heavy emails with little text, and readers who block images see almost nothing.",
    suggestion: "Add text that carries the message.",
  },
};

export default en;
