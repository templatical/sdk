import type { UseEditorReturn } from "./editor";
import type { AuthManager } from "./auth";
import type { Collaborator, McpOperationPayload } from "@templatical/types";
import { handleOperation } from "./mcp-operation-handler";
import type { PresenceMember } from "./websocket-client";
import type { PresenceChannel } from "pusher-js";
import { computed, ref, watch, type Ref } from "vue";

const COLLABORATOR_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#14b8a6",
];

export interface UseCollaborationOptions {
  authManager: AuthManager;
  editor: UseEditorReturn;
  channel: Ref<PresenceChannel | null>;
  onError?: (error: Error) => void;
  onCollaboratorJoined?: (collaborator: Collaborator) => void;
  onCollaboratorLeft?: (collaborator: Collaborator) => void;
  onBlockLocked?: (event: {
    blockId: string;
    collaborator: Collaborator;
  }) => void;
  onBlockUnlocked?: (event: {
    blockId: string;
    collaborator: Collaborator;
  }) => void;
}

export interface UseCollaborationReturn {
  collaborators: Ref<Collaborator[]>;
  lockedBlocks: Ref<Map<string, Collaborator>>;
}

export function useCollaboration(
  options: UseCollaborationOptions,
): UseCollaborationReturn & {
  _broadcastOperation: (payload: McpOperationPayload) => void;
  _isProcessingRemoteOperation: () => boolean;
} {
  const { authManager, editor, channel } = options;

  const collaborators = ref<Collaborator[]>([]);
  const lockedBlocks = ref<Map<string, Collaborator>>(new Map());

  let colorIndex = 0;
  let isProcessingRemoteOperation = false;

  const myUserId = computed(() => authManager.userConfig?.id ?? "");

  function assignColor(): string {
    const color = COLLABORATOR_COLORS[colorIndex % COLLABORATOR_COLORS.length];
    colorIndex++;
    return color;
  }

  function addCollaborator(member: PresenceMember): Collaborator | undefined {
    if (member.id === myUserId.value) {
      return undefined;
    }

    if (collaborators.value.some((c) => c.id === member.id)) {
      return undefined;
    }

    const collaborator: Collaborator = {
      id: member.id,
      name: member.name,
      color: assignColor(),
      selectedBlockId: null,
    };

    collaborators.value = [...collaborators.value, collaborator];

    return collaborator;
  }

  function removeCollaborator(memberId: string): void {
    const newLockedBlocks = new Map(lockedBlocks.value);
    for (const [blockId, collaborator] of newLockedBlocks) {
      if (collaborator.id === memberId) {
        newLockedBlocks.delete(blockId);
      }
    }
    lockedBlocks.value = newLockedBlocks;

    collaborators.value = collaborators.value.filter((c) => c.id !== memberId);
  }

  function handleBlockLocked(data: { blockId: string; userId: string }): void {
    const collaborator = collaborators.value.find((c) => c.id === data.userId);
    if (!collaborator) {
      return;
    }

    collaborators.value = collaborators.value.map((c) =>
      c.id === data.userId ? { ...c, selectedBlockId: data.blockId } : c,
    );

    const newLockedBlocks = new Map(lockedBlocks.value);
    for (const [blockId, holder] of newLockedBlocks) {
      if (holder.id === data.userId) {
        newLockedBlocks.delete(blockId);
      }
    }

    newLockedBlocks.set(data.blockId, {
      ...collaborator,
      selectedBlockId: data.blockId,
    });
    lockedBlocks.value = newLockedBlocks;

    if (editor.state.selectedBlockId === data.blockId) {
      editor.selectBlock(null);
    }
  }

  function handleBlockUnlocked(data: { blockId: string }): void {
    const newLockedBlocks = new Map(lockedBlocks.value);
    const holder = newLockedBlocks.get(data.blockId);
    newLockedBlocks.delete(data.blockId);
    lockedBlocks.value = newLockedBlocks;

    if (holder) {
      collaborators.value = collaborators.value.map((c) =>
        c.id === holder.id ? { ...c, selectedBlockId: null } : c,
      );
    }
  }

  function handleRemoteOperation(payload: McpOperationPayload): void {
    isProcessingRemoteOperation = true;
    try {
      handleOperation(editor, payload);
    } finally {
      isProcessingRemoteOperation = false;
    }
  }

  function broadcastOperation(payload: McpOperationPayload): void {
    if (!channel.value || isProcessingRemoteOperation) {
      return;
    }

    channel.value.trigger("client-operation", payload);
  }

  function broadcastBlockLocked(blockId: string): void {
    if (!channel.value) {
      return;
    }

    channel.value.trigger("client-block_locked", {
      blockId,
      userId: myUserId.value,
    });
  }

  function broadcastBlockUnlocked(blockId: string): void {
    if (!channel.value) {
      return;
    }

    channel.value.trigger("client-block_unlocked", { blockId });
  }

  watch(
    () => editor.state.selectedBlockId,
    (newBlockId, oldBlockId) => {
      if (isProcessingRemoteOperation) {
        return;
      }

      if (oldBlockId) {
        broadcastBlockUnlocked(oldBlockId);
      }

      if (newBlockId) {
        broadcastBlockLocked(newBlockId);
      }
    },
  );

  watch(channel, (newChannel, oldChannel) => {
    if (oldChannel) {
      oldChannel.unbind("pusher:member_added");
      oldChannel.unbind("pusher:member_removed");
      oldChannel.unbind("client-block_locked");
      oldChannel.unbind("client-block_unlocked");
      oldChannel.unbind("client-operation");
      oldChannel.unbind("mcp-operation");
    }

    if (!newChannel) {
      collaborators.value = [];
      lockedBlocks.value = new Map();
      colorIndex = 0;
      return;
    }

    const members = (
      newChannel as PresenceChannel & {
        members: {
          each: (
            callback: (member: { id: string; info: PresenceMember }) => void,
          ) => void;
        };
      }
    ).members;
    if (members) {
      members.each((member: { id: string; info: PresenceMember }) => {
        addCollaborator(member.info);
      });
    }

    newChannel.bind(
      "pusher:member_added",
      (member: { id: string; info: PresenceMember }) => {
        const collaborator = addCollaborator(member.info);
        if (collaborator) {
          options.onCollaboratorJoined?.(collaborator);
        }
      },
    );

    newChannel.bind(
      "pusher:member_removed",
      (member: { id: string; info: PresenceMember }) => {
        const collaborator = collaborators.value.find(
          (c) => c.id === member.id,
        );
        removeCollaborator(member.id);
        if (collaborator) {
          options.onCollaboratorLeft?.(collaborator);
        }
      },
    );

    newChannel.bind(
      "client-block_locked",
      (data: { blockId: string; userId: string }) => {
        handleBlockLocked(data);
        const collaborator = collaborators.value.find(
          (c) => c.id === data.userId,
        );
        if (collaborator) {
          options.onBlockLocked?.({
            blockId: data.blockId,
            collaborator,
          });
        }
      },
    );

    newChannel.bind("client-block_unlocked", (data: { blockId: string }) => {
      const holder = lockedBlocks.value.get(data.blockId);
      handleBlockUnlocked(data);
      if (holder) {
        options.onBlockUnlocked?.({
          blockId: data.blockId,
          collaborator: holder,
        });
      }
    });

    newChannel.bind("client-operation", (payload: McpOperationPayload) => {
      handleRemoteOperation(payload);
    });

    newChannel.bind("mcp-operation", (payload: McpOperationPayload) => {
      handleRemoteOperation(payload);
    });
  });

  return {
    collaborators,
    lockedBlocks,
    _broadcastOperation: broadcastOperation,
    _isProcessingRemoteOperation: () => isProcessingRemoteOperation,
  };
}
