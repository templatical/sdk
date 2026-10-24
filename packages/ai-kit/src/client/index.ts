// @templatical/ai-kit/client — an AiProvider over the wire (A1 §4, §5).
export { createHttpAiProvider } from "./http-provider";
export type { HttpAiFeatures, HttpAiProviderOptions } from "./http-provider";
export { readSse } from "./sse";
export {
  AI_TEMPLATE_CHANGED_MESSAGE,
  errorFromEvent,
  errorFromResponse,
  parseRetryAfter,
} from "./errors";
