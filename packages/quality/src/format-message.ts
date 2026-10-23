export interface FormattedMessage {
  message: string;
  suggestion: string;
}

/** Keep missing placeholders visible so callers can diagnose incomplete params. */
export function formatMessagePair(
  template: FormattedMessage,
  params?: Record<string, string | number>,
): FormattedMessage {
  if (!params) return template;
  const interpolate = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = params[key];
      return value === undefined ? `{${key}}` : String(value);
    });
  return {
    message: interpolate(template.message),
    suggestion: interpolate(template.suggestion),
  };
}
