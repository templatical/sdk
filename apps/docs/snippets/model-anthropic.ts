import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicAdapter } from "@templatical/ai-kit/adapters/anthropic";

// Reads ANTHROPIC_API_KEY. `new AnthropicBedrock()` from @anthropic-ai/bedrock-sdk works the same way.
export const model = createAnthropicAdapter({
  client: new Anthropic(),
  model: "claude-opus-5-5",
});
