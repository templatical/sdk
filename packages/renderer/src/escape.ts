const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

const HTML_ENTITY_REGEX = /[&<>"']/g;

/**
 * Escape HTML special characters (& < > " ').
 * Equivalent to PHP htmlspecialchars with ENT_QUOTES | ENT_HTML5.
 */
export function escapeHtml(text: string): string {
  if (text === '') {
    return '';
  }

  return text.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Escape a string for use in an HTML attribute value.
 * Same implementation as escapeHtml for consistency with PHP.
 */
export function escapeAttr(text: string): string {
  if (text === '') {
    return '';
  }

  return text.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Replace merge tag span elements with their data attribute values.
 * Converts `<span data-merge-tag="{{name}}">Label</span>` to `{{name}}`.
 * Also handles `data-logic-merge-tag` attributes.
 */
export function convertMergeTagsToValues(html: string): string {
  if (html === '') {
    return '';
  }

  // Replace <span data-merge-tag="...">...</span> with the merge tag value
  let result = html.replace(
    /<span[^>]*\bdata-merge-tag="([^"]*)"[^>]*>.*?<\/span>/gs,
    '$1',
  );

  // Replace <span data-logic-merge-tag="...">...</span> with the merge tag value
  result = result.replace(
    /<span[^>]*\bdata-logic-merge-tag="([^"]*)"[^>]*>.*?<\/span>/gs,
    '$1',
  );

  return result;
}
