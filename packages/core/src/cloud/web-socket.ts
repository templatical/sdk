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
  let socketReady: Promise<void> | null = null;
  let channelName: string | null = null;
  // The channel the latest `connect` asked for. Recorded before any await, so
  // a switch that resumes after a later request is dropped and the last
  // request wins, including one for the channel already joined.
  let requestedChannelName: string | null = null;

  async function connect(
    templateId: string,
    config: WebSocketConfig,
  ): Promise<void> {
    const nextChannelName = `presence-template.${templateId}`;
    requestedChannelName = nextChannelName;
    if (wsClient && channelName === nextChannelName) return;

    if (!wsClient) {
      const created = new WebSocketClient({ authManager, config, onError });
      wsClient = created;
      // A failed attempt is forgotten, so the next `connect` opens a new socket
      // instead of awaiting the same rejection.
      socketReady = created.connect().catch((error: unknown) => {
        if (wsClient === created) {
          wsClient = null;
          socketReady = null;
          channelName = null;
          requestedChannelName = null;
        }
        throw error;
      });
    }

    const client = wsClient;
    await socketReady;
    // `disconnect()` during the open can't close a socket that doesn't exist
    // yet, so a client that lost ownership while opening is closed here.
    if (wsClient !== client) {
      client.disconnect();
      return;
    }
    if (
      requestedChannelName !== nextChannelName ||
      channelName === nextChannelName
    )
      return;
    if (channelName) client.unsubscribe(channelName);

    channelName = nextChannelName;
    channel.value = null;
    isConnected.value = false;
    const presenceChannel = client.subscribePresence(nextChannelName);

    presenceChannel.bind("pusher:subscription_succeeded", () => {
      if (channelName !== nextChannelName) return;
      isConnected.value = true;
      channel.value = presenceChannel;
    });

    presenceChannel.bind("pusher:subscription_error", (error: unknown) => {
      if (channelName !== nextChannelName) return;
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
    socketReady = null;
    channelName = null;
    requestedChannelName = null;
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
