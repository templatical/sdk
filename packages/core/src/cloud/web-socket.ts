import type { AuthManager } from "./auth";
import type { WebSocketConfig } from "./websocket-client";
import { WebSocketClient } from "./websocket-client";
import type { PresenceChannel } from "pusher-js";
import { ref, type Ref } from "vue";

export interface UseWebSocketOptions {
  authManager: AuthManager;
  onError?: (error: Error) => void;
}

export interface UseWebSocketReturn {
  channel: Ref<PresenceChannel | null>;
  isConnected: Ref<boolean>;
  connect: (templateId: string, config: WebSocketConfig) => Promise<void>;
  disconnect: () => void;
  getSocketId: () => string | null;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { authManager, onError } = options;

  const channel = ref<PresenceChannel | null>(
    null,
  ) as Ref<PresenceChannel | null>;
  const isConnected = ref(false);

  let wsClient: WebSocketClient | null = null;
  let channelName: string | null = null;

  async function connect(
    templateId: string,
    config: WebSocketConfig,
  ): Promise<void> {
    if (wsClient) {
      return;
    }

    wsClient = new WebSocketClient({
      authManager,
      config,
      onError,
    });

    await wsClient.connect();

    channelName = `presence-template.${templateId}`;
    const presenceChannel = wsClient.subscribePresence(channelName);

    presenceChannel.bind("pusher:subscription_succeeded", () => {
      isConnected.value = true;
      channel.value = presenceChannel;
    });

    presenceChannel.bind("pusher:subscription_error", (error: unknown) => {
      isConnected.value = false;
      channel.value = null;
      onError?.(
        error instanceof Error
          ? error
          : new Error("Failed to subscribe to template channel"),
      );
    });
  }

  function disconnect(): void {
    if (channelName && wsClient) {
      wsClient.unsubscribe(channelName);
    }

    wsClient?.disconnect();
    wsClient = null;
    channelName = null;
    channel.value = null;
    isConnected.value = false;
  }

  function getSocketId(): string | null {
    return wsClient?.getSocketId() ?? null;
  }

  return {
    channel,
    isConnected,
    connect,
    disconnect,
    getSocketId,
  };
}
