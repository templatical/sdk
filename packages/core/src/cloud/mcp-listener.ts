import type { UseEditorReturn } from "../editor";
import type { TemplateOperationPayload } from "@templatical/types";
import { handleOperation } from "./mcp-operation-handler";
import type { PresenceChannel } from "pusher-js";
import { watch, type Ref } from "vue";

export interface UseMcpListenerOptions {
  editor: UseEditorReturn;
  channel: Ref<PresenceChannel | null>;
  onOperation?: (payload: TemplateOperationPayload) => void;
}

export function useMcpListener(options: UseMcpListenerOptions): void {
  const { editor, channel, onOperation } = options;

  watch(channel, (newChannel, oldChannel) => {
    if (oldChannel) {
      oldChannel.unbind("mcp-operation");
    }

    if (newChannel) {
      newChannel.bind("mcp-operation", (payload: TemplateOperationPayload) => {
        handleOperation(editor, payload);
        onOperation?.(payload);
      });
    }
  });
}
