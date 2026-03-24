import type { WebSocketServerConfig } from '@templatical/types';
import type { AuthManager } from './auth';
import { API_ROUTES, buildUrl } from './url-builder';
import type Pusher from 'pusher-js';
import type { Channel, PresenceChannel } from 'pusher-js';

type PusherType = Pusher;

export interface WebSocketConfig {
    host: string;
    port: number;
    appKey: string;
}

export function resolveWebSocketConfig(
    serverConfig: WebSocketServerConfig,
): WebSocketConfig {
    return {
        host: serverConfig.host,
        port: serverConfig.port,
        appKey: serverConfig.app_key,
    };
}

export interface PresenceMember {
    id: string;
    name: string;
    type: 'user' | 'mcp';
}

export interface WebSocketClientOptions {
    authManager: AuthManager;
    config: WebSocketConfig;
    onError?: (error: Error) => void;
}

export class WebSocketClient {
    private pusher: PusherType | null = null;
    private readonly authManager: AuthManager;
    private readonly config: WebSocketConfig;
    private readonly onError?: (error: Error) => void;

    constructor(options: WebSocketClientOptions) {
        this.authManager = options.authManager;
        this.config = options.config;
        this.onError = options.onError;
    }

    async connect(): Promise<void> {
        if (this.pusher) {
            return;
        }

        const { default: Pusher } = await import('pusher-js');

        const { host, port, appKey } = this.config;
        const authEndpoint = this.authManager.resolveUrl(
            buildUrl(API_ROUTES['broadcasting.auth'], {
                project: this.authManager.projectId,
                tenant: this.authManager.tenantSlug,
            }),
        );

        this.pusher = new Pusher(appKey, {
            wsHost: host,
            wsPort: port,
            wssPort: port,
            forceTLS: true,
            disableStats: true,
            enabledTransports: ['ws', 'wss'],
            cluster: '',
            channelAuthorization: {
                transport: 'ajax',
                endpoint: authEndpoint,
                headers: {
                    Authorization: `Bearer ${this.authManager.accessTokenValue}`,
                    Accept: 'application/json',
                },
                params: {
                    user_id: this.authManager.userConfig?.id ?? '',
                    user_name: this.authManager.userConfig?.name ?? '',
                    user_signature:
                        this.authManager.userConfig?.signature ?? '',
                },
            },
        });

        this.pusher.connection.bind('error', (error: unknown) => {
            this.onError?.(
                error instanceof Error
                    ? error
                    : new Error('WebSocket connection error'),
            );
        });
    }

    subscribePresence(channelName: string): PresenceChannel {
        if (!this.pusher) {
            throw new Error(
                'WebSocketClient not connected. Call connect() first.',
            );
        }

        return this.pusher.subscribe(channelName) as PresenceChannel;
    }

    unsubscribe(channelName: string): void {
        this.pusher?.unsubscribe(channelName);
    }

    getChannel(channelName: string): Channel | undefined {
        return this.pusher?.channel(channelName);
    }

    disconnect(): void {
        if (this.pusher) {
            this.pusher.disconnect();
            this.pusher = null;
        }
    }

    getSocketId(): string | null {
        return this.pusher?.connection.socket_id ?? null;
    }

    get isConnected(): boolean {
        return this.pusher?.connection.state === 'connected';
    }
}
