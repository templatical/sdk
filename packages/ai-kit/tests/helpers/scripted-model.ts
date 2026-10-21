import type {
  AiModelAdapter,
  AiModelMessage,
  AiModelPart,
} from "../../src/server";

/**
 * A model that plays one list of parts per call, in order, and records what
 * each call was given. A step past the script answers with nothing.
 */
export function scriptedModel(steps: AiModelPart[][]): AiModelAdapter & {
  calls: { system: string; messages: AiModelMessage[]; tools: string[] }[];
} {
  const calls: { system: string; messages: AiModelMessage[]; tools: string[] }[] = [];
  return {
    calls,
    async *stream({ system, messages, tools, signal }) {
      calls.push({
        system,
        messages: structuredClone(messages),
        tools: tools.map((tool) => tool.name),
      });
      for (const part of steps[calls.length - 1] ?? []) {
        signal?.throwIfAborted();
        await Promise.resolve();
        yield part;
      }
    },
  };
}
