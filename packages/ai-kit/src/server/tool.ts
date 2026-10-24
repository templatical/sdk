/** A tool in neutral JSON-schema form; adapters map it to their SDK's shape. */
export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * The editing turns' one tool (S7 A4). `ops` is a JSON **string**: several
 * SDKs turn tool arguments into maps that lose `{}` (S7 D8), and a string
 * survives every one of them.
 */
export const applyOperationsTool: AiToolDefinition = {
  name: "apply_operations",
  description:
    'Apply a batch of template operations (the vocabulary in your instructions) to the template, all or nothing. Returns "Applied." or why the batch was refused.',
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["ops"],
    properties: {
      ops: {
        type: "string",
        description:
          'A JSON array of operations, for example [{"op":"updateBlock","blockId":"b1","set":{"content":"<p>Hi</p>"}}].',
      },
    },
  },
};
