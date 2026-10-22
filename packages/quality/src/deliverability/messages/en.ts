/** English deliverability-rule messages. Other locales mirror these keys. */
const en = {
  "deliverability.link-text-domain-mismatch":
    "The link text shows {textHost}, but the link goes to {linkHost}. Spam filters flag links like this as phishing. Make the text match the destination, or use words instead of an address.",
  "deliverability.url-shortener":
    "This link goes through the URL shortener {host}. Spam filters treat shortener links with suspicion because they hide the destination. Link to the destination instead.",
  "deliverability.ip-address-url":
    "This link points to the IP address {host} instead of a domain. Spam filters score links like this as spam. Link to your domain.",
  "deliverability.low-text":
    "This email has images but only {count} characters of text (under {min}). Some spam filters score image-heavy emails with little text, and readers who block images see almost nothing. Add text that carries the message.",
};

export default en;
