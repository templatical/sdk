import OpenAI from "openai";
import { createOpenAiAdapter } from "@templatical/ai-kit/adapters/openai";

// Reads OPENAI_API_KEY. For an OpenAI-compatible server, pass `new OpenAI({ baseURL, apiKey })`.
export const model = createOpenAiAdapter({
  client: new OpenAI(),
  model: process.env.OPENAI_MODEL!,
});
