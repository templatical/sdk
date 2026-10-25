import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicAdapter } from "@templatical/ai-kit/adapters/anthropic";

// Reads ANTHROPIC_API_KEY.
export const model = createAnthropicAdapter({
  client: new Anthropic(),
  model: "claude-opus-5-5",
});
