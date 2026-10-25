import { createVercelAdapter } from "@templatical/ai-kit/adapters/vercel";

// Any AI SDK model: a provider package's model, e.g. anthropic('…') from
// @ai-sdk/anthropic, or a gateway model id as here (reads AI_GATEWAY_API_KEY).
export const model = createVercelAdapter({
  model: "anthropic/claude-opus-5-5",
});
