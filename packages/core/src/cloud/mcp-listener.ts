import type { UseEditorReturn } from "./editor";
import type { McpOperationPayload } from "@templatical/types";
import { handleOperation } from "./mcp-operation-handler";
import type { PresenceChannel } from "pusher-js";
import { watch, type Ref } from "vue";

export interface UseMcpListenerOptions {
  editor: UseEditorReturn;
  channel: Ref<PresenceChannel | null>;
  onOperation?: (payload: McpOperationPayload) => void;
}

export function useMcpListener(options: UseMcpListenerOptions): void {
  const { editor, channel, onOperation } = options;

  watch(channel, (newChannel, oldChannel) => {
    if (oldChannel) {
      oldChannel.unbind("mcp-operation");
    }

    if (newChannel) {
      newChannel.bind("mcp-operation", (payload: McpOperationPayload) => {
        handleOperation(editor, payload);
        onOperation?.(payload);
      });
    }
  });
}
