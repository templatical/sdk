import type { OperationBatch, TemplateContent } from "@templatical/types";
import {
  RefusedError,
  SharedCollaborationServer,
  type SessionIdentity,
} from "./server";

/**
 * One collaboration backend for every tab of the playground: a SharedWorker
 * runs a single {@link SharedCollaborationServer}, and each tab talks to it
 * over its own port (`client.ts`).
 */

/** A request from a tab. Each answer carries the request's `id`. */
export type WorkerRequest =
  | {
      id: number;
      method: "load";
      args: [templateId: string, seed: TemplateContent];
    }
  | {
      id: number;
      method: "rename";
      args: [templateId: string, name: string | undefined];
    }
  | {
      id: number;
      method: "join";
      args: [templateId: string, who: SessionIdentity];
    }
  | {
      id: number;
      method: "leave";
      args: [templateId: string, sessionId: string];
    }
  | {
      id: number;
      method: "heartbeat";
      args: [templateId: string, sessionId: string];
    }
  | {
      id: number;
      method: "submit";
      args: [templateId: string, who: SessionIdentity, batch: OperationBatch];
    }
  | {
      id: number;
      method: "operationsAfter";
      args: [templateId: string, after: number];
    }
  | {
      id: number;
      method: "acquireLock" | "renewLock" | "releaseLock";
      args: [
        templateId: string,
        who: SessionIdentity,
        blockId: string,
        locale?: string | null,
      ];
    };

/** How often the worker lets silent sessions and expired locks go. */
const SWEEP_MS = 5_000;

const ports = new Map<string, MessagePort>();
const server = new SharedCollaborationServer((sessionId, event) => {
  ports.get(sessionId)?.postMessage({ sessionId, event });
});
setInterval(() => server.sweep(), SWEEP_MS);

function handle(port: MessagePort, request: WorkerRequest): unknown {
  switch (request.method) {
    case "load":
      return server.load(...request.args);
    case "rename":
      return server.rename(...request.args);
    case "join":
      ports.set(request.args[1].sessionId, port);
      return server.join(...request.args);
    case "leave":
      ports.delete(request.args[1]);
      return server.leave(...request.args);
    case "heartbeat":
      return server.heartbeat(...request.args);
    case "submit":
      return server.submit(...request.args);
    case "operationsAfter":
      return server.operationsAfter(...request.args);
    case "acquireLock":
      return server.acquireLock(...request.args);
    case "renewLock":
      return server.renewLock(...request.args);
    case "releaseLock":
      return server.releaseLock(...request.args);
  }
}

// The worker scope's type is left out of the DOM lib the playground compiles
// against, so only the one member used here is typed.
(self as unknown as { onconnect: (event: MessageEvent) => void }).onconnect = (
  event,
) => {
  const port = event.ports[0];
  port.onmessage = (message: MessageEvent<WorkerRequest>) => {
    const request = message.data;
    try {
      port.postMessage({ id: request.id, result: handle(port, request) });
    } catch (error) {
      port.postMessage({
        id: request.id,
        error:
          error instanceof RefusedError
            ? error.refusal
            : {
                message: error instanceof Error ? error.message : String(error),
              },
      });
    }
  };
  port.start();
};
