<script setup lang="ts">
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import { EDITOR_KEY, AUTH_MANAGER_KEY, COMMENTS_KEY } from "../../keys";
import { useI18n } from "../../composables/useI18n";
import type { Comment } from "@templatical/types";
import {
  Check,
  CircleCheck,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  MessageCircle,
  Pencil,
  Reply,
  Send,
  Trash2,
  X,
} from "@lucide/vue";
import { computed, inject, nextTick, ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "filterBlock", blockId: string | null): void;
}>();

const { t, format } = useI18n();
const editor = inject(EDITOR_KEY)!;
const authManager = inject(AUTH_MANAGER_KEY)!;
const comments = inject(COMMENTS_KEY)!;

type FilterMode = "all" | "unresolved" | "block";
const filterMode = ref<FilterMode>("unresolved");
const filterBlockId = ref<string | null>(null);

const newCommentBody = ref("");
const replyingTo = ref<string | null>(null);
const replyBody = ref("");
const editingId = ref<string | null>(null);
const editBody = ref("");
const expandedThreads = ref<Set<string>>(new Set());
const deletingId = ref<string | null>(null);
const newCommentInput = ref<HTMLTextAreaElement | null>(null);

const currentUserId = computed(() => authManager.userConfig?.id ?? null);

const allBlockIds = computed<Set<string>>(() => {
  const ids = new Set<string>();
  for (const block of editor.content.value.blocks) {
    ids.add(block.id);
    if (block.type === "section") {
      for (const column of block.children) {
        for (const child of column) {
          ids.add(child.id);
        }
      }
    }
  }
  return ids;
});

function isBlockMissing(blockId: string | null): boolean {
  if (!blockId) {
    return false;
  }
  return !allBlockIds.value.has(blockId);
}

const isBlockFilterUnsaved = computed(() => {
  if (filterMode.value !== "block" || !filterBlockId.value) {
    return false;
  }
  return !editor.savedBlockIds.value.has(filterBlockId.value);
});

const filteredComments = computed(() => {
  let items = comments.comments.value;

  if (filterMode.value === "unresolved") {
    items = items.filter((c) => !c.resolved_at);
  } else if (filterMode.value === "block" && filterBlockId.value) {
    items = items.filter((c) => c.block_id === filterBlockId.value);
  }

  return items;
});

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      comments.loadComments();
    }
  },
);

watch(
  () => editor.state.selectedBlockId,
  (newBlockId) => {
    if (filterMode.value === "block" && newBlockId) {
      filterBlockId.value = newBlockId;
    }
  },
);

function setFilter(mode: FilterMode, blockId?: string): void {
  filterMode.value = mode;
  filterBlockId.value = mode === "block" ? (blockId ?? null) : null;
}

function filterByBlock(blockId: string): void {
  setFilter("block", blockId);
  emit("filterBlock", blockId);
}

function toggleThread(threadId: string): void {
  if (expandedThreads.value.has(threadId)) {
    expandedThreads.value.delete(threadId);
  } else {
    expandedThreads.value.add(threadId);
  }
}

function startReply(threadId: string): void {
  replyingTo.value = threadId;
  replyBody.value = "";
  editingId.value = null;

  if (!expandedThreads.value.has(threadId)) {
    expandedThreads.value.add(threadId);
  }
}

function cancelReply(): void {
  replyingTo.value = null;
  replyBody.value = "";
}

function startEdit(comment: Comment): void {
  editingId.value = comment.id;
  editBody.value = comment.body;
  replyingTo.value = null;
}

function cancelEdit(): void {
  editingId.value = null;
  editBody.value = "";
}

function confirmDelete(commentId: string): void {
  deletingId.value = commentId;
}

function cancelDelete(): void {
  deletingId.value = null;
}

async function handleAddComment(): Promise<void> {
  const body = newCommentBody.value.trim();
  if (!body) {
    return;
  }

  const blockId =
    filterMode.value === "block" ? filterBlockId.value : undefined;
  await comments.addComment(body, blockId ?? undefined);
  newCommentBody.value = "";
}

async function handleReply(parentId: string): Promise<void> {
  const body = replyBody.value.trim();
  if (!body) {
    return;
  }

  const parent = comments.comments.value.find((c) => c.id === parentId);
  await comments.addComment(body, parent?.block_id ?? undefined, parentId);
  replyingTo.value = null;
  replyBody.value = "";
}

async function handleEdit(commentId: string): Promise<void> {
  const body = editBody.value.trim();
  if (!body) {
    return;
  }

  await comments.editComment(commentId, body);
  editingId.value = null;
  editBody.value = "";
}

async function handleDelete(commentId: string): Promise<void> {
  await comments.removeComment(commentId);
  deletingId.value = null;
}

async function handleResolve(commentId: string): Promise<void> {
  await comments.toggleResolve(commentId);
}

function isOwnComment(comment: Comment): boolean {
  return comment.author_identifier === currentUserId.value;
}

function formatTime(dateString: string): string {
  return formatRelativeTime(dateString, t.snapshotHistory) ?? dateString;
}

function handleNewCommentKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleAddComment();
  }
}

function handleReplyKeydown(event: KeyboardEvent, parentId: string): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleReply(parentId);
  }
}

function handleEditKeydown(event: KeyboardEvent, commentId: string): void {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleEdit(commentId);
  }
  if (event.key === "Escape") {
    cancelEdit();
  }
}

function focusNewComment(): void {
  nextTick(() => {
    newCommentInput.value?.focus();
  });
}

defineExpose({ filterByBlock, focusNewComment });
</script>

<template>
  <Transition
    enter-active-class="tpl-comments-slide-enter-active"
    enter-from-class="tpl:translate-x-full"
    enter-to-class="tpl:translate-x-0"
    leave-active-class="tpl-comments-slide-leave-active"
    leave-from-class="tpl:translate-x-0"
    leave-to-class="tpl:translate-x-full"
  >
    <div
      v-if="visible"
      class="tpl-comments-sidebar tpl:absolute tpl:top-14 tpl:right-0 tpl:bottom-0 tpl:z-panel tpl:flex tpl:w-[360px] tpl:flex-col tpl:border-l tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)]"
    >
      <!-- Header -->
      <div
        class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-4 tpl:py-3"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-sm tpl:font-medium"
          style="color: var(--tpl-text)"
        >
          <MessageCircle :size="13" :stroke-width="2" />
          <span>{{ t.comments.title }}</span>
          <span
            v-if="comments.unresolvedCount.value > 0"
            class="tpl:ml-1 tpl:inline-flex tpl:size-5 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-[10px] tpl:font-semibold"
            style="background-color: var(--tpl-primary); color: var(--tpl-bg)"
          >
            {{ comments.unresolvedCount.value }}
          </span>
        </div>
        <button
          class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:duration-150"
          style="color: var(--tpl-text-muted)"
          @click="emit('close')"
        >
          <X :size="14" :stroke-width="2" />
        </button>
      </div>

      <!-- Filter bar -->
      <div
        class="tpl:flex tpl:gap-1 tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-4 tpl:py-2"
      >
        <button
          class="tpl-comment-filter tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors tpl:duration-150"
          :class="
            filterMode === 'unresolved' ? 'tpl-comment-filter--active' : ''
          "
          @click="setFilter('unresolved')"
        >
          {{ t.comments.filterUnresolved }}
        </button>
        <button
          class="tpl-comment-filter tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors tpl:duration-150"
          :class="filterMode === 'all' ? 'tpl-comment-filter--active' : ''"
          @click="setFilter('all')"
        >
          {{ t.comments.filterAll }}
        </button>
        <button
          v-if="editor.state.selectedBlockId"
          class="tpl-comment-filter tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors tpl:duration-150"
          :class="filterMode === 'block' ? 'tpl-comment-filter--active' : ''"
          @click="setFilter('block', editor.state.selectedBlockId ?? undefined)"
        >
          {{ t.comments.filterBlock }}
        </button>
      </div>

      <!-- Thread list -->
      <div class="tpl:flex-1 tpl:overflow-y-auto">
        <!-- Loading state -->
        <div
          v-if="comments.isLoading.value"
          class="tpl:flex tpl:h-full tpl:items-center tpl:justify-center"
        >
          <LoaderCircle
            class="tpl-spinner"
            :size="24"
            :stroke-width="2"
            style="color: var(--tpl-text-muted)"
          />
        </div>

        <!-- Empty state -->
        <div
          v-else-if="filteredComments.length === 0"
          class="tpl:flex tpl:h-full tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-3 tpl:px-6 tpl:text-center"
        >
          <MessageCircle
            :size="32"
            :stroke-width="1.5"
            style="color: var(--tpl-text-dim)"
          />
          <p
            class="tpl:max-w-[240px] tpl:text-sm"
            style="color: var(--tpl-text-muted)"
          >
            {{
              filterMode === "all"
                ? t.comments.noCommentsHint
                : t.comments.noComments
            }}
          </p>
        </div>

        <!-- Comment threads -->
        <div v-else class="tpl:flex tpl:flex-col tpl:gap-3 tpl:p-3">
          <div
            v-for="thread in filteredComments"
            :key="thread.id"
            class="tpl-comment-thread"
          >
            <!-- Root comment card -->
            <div
              class="tpl-comment-card tpl:rounded-lg tpl:border tpl:px-3.5 tpl:py-3"
            >
              <!-- Comment header -->
              <div
                class="tpl:flex tpl:items-start tpl:justify-between tpl:gap-2"
              >
                <div class="tpl:flex tpl:items-center tpl:gap-1.5">
                  <span
                    class="tpl:text-xs tpl:font-semibold"
                    style="color: var(--tpl-text)"
                  >
                    {{
                      isOwnComment(thread)
                        ? t.comments.ownedByYou
                        : thread.author_name
                    }}
                  </span>
                  <span
                    class="tpl:text-[10px]"
                    style="color: var(--tpl-text-dim)"
                  >
                    {{ formatTime(thread.created_at) }}
                  </span>
                  <span
                    v-if="thread.updated_at !== thread.created_at"
                    class="tpl:text-[10px] tpl:italic"
                    style="color: var(--tpl-text-dim)"
                  >
                    ({{ t.comments.edited }})
                  </span>
                </div>
                <div class="tpl:flex tpl:items-center tpl:gap-0.5">
                  <!-- Resolve toggle -->
                  <button
                    class="tpl-comment-action tpl:rounded tpl:p-1 tpl:transition-colors tpl:duration-150"
                    :title="
                      thread.resolved_at
                        ? t.comments.unresolve
                        : t.comments.resolve
                    "
                    @click="handleResolve(thread.id)"
                  >
                    <CircleCheck
                      :size="13"
                      :stroke-width="2"
                      class="tpl-resolve-icon"
                      :style="{
                        color: thread.resolved_at
                          ? 'var(--tpl-primary)'
                          : undefined,
                      }"
                    />
                  </button>
                  <!-- Edit (own only) -->
                  <button
                    v-if="isOwnComment(thread)"
                    class="tpl-comment-action tpl:rounded tpl:p-1 tpl:transition-colors tpl:duration-150"
                    :title="t.comments.edit"
                    @click="startEdit(thread)"
                  >
                    <Pencil :size="12" :stroke-width="2" />
                  </button>
                  <!-- Delete (own only) -->
                  <button
                    v-if="isOwnComment(thread)"
                    class="tpl-comment-action tpl-comment-delete tpl:rounded tpl:p-1 tpl:transition-colors tpl:duration-150"
                    :title="t.comments.delete"
                    @click="confirmDelete(thread.id)"
                  >
                    <Trash2 :size="12" :stroke-width="2" />
                  </button>
                </div>
              </div>

              <!-- Resolved badge -->
              <Transition name="tpl-resolve">
                <div
                  v-if="thread.resolved_at"
                  class="tpl:mt-1 tpl:flex tpl:items-center tpl:gap-1 tpl:text-[10px]"
                  style="color: var(--tpl-primary)"
                >
                  <Check :size="10" :stroke-width="2.5" />
                  <span>
                    {{
                      format(t.comments.resolvedBy, {
                        name: thread.resolved_by_name ?? "",
                      })
                    }}
                  </span>
                </div>
              </Transition>

              <!-- Block anchor indicator -->
              <span
                v-if="thread.block_id && isBlockMissing(thread.block_id)"
                class="tpl:mt-1 tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium"
                style="
                  background-color: var(--tpl-warning-light);
                  color: var(--tpl-warning);
                "
              >
                {{ t.comments.missingBlock }}
              </span>
              <button
                v-else-if="thread.block_id"
                class="tpl:mt-1 tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:transition-colors tpl:duration-150"
                style="
                  background-color: var(--tpl-bg-hover);
                  color: var(--tpl-text-muted);
                "
                @click="editor.selectBlock(thread.block_id ?? '')"
              >
                Block
              </button>

              <!-- Comment body (or edit mode) -->
              <div v-if="editingId === thread.id" class="tpl:mt-2">
                <textarea
                  v-model="editBody"
                  class="tpl:w-full tpl:resize-none tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-2 tpl:font-sans tpl:text-xs tpl:outline-none"
                  style="
                    border-color: var(--tpl-border);
                    background-color: var(--tpl-bg);
                    color: var(--tpl-text);
                  "
                  rows="3"
                  @keydown="handleEditKeydown($event, thread.id)"
                />
                <div class="tpl:mt-1.5 tpl:flex tpl:gap-1.5">
                  <button
                    class="tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors tpl:duration-150"
                    style="
                      background-color: var(--tpl-primary);
                      color: var(--tpl-bg);
                    "
                    :disabled="!editBody.trim() || comments.isSubmitting.value"
                    @click="handleEdit(thread.id)"
                  >
                    {{ t.comments.save }}
                  </button>
                  <button
                    class="tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors tpl:duration-150"
                    style="color: var(--tpl-text-muted)"
                    @click="cancelEdit()"
                  >
                    {{ t.comments.cancel }}
                  </button>
                </div>
              </div>
              <p
                v-else
                class="tpl:mt-1.5 tpl:text-xs tpl:leading-relaxed tpl:whitespace-pre-wrap"
                style="color: var(--tpl-text)"
              >
                {{ thread.body }}
              </p>

              <!-- Delete confirmation -->
              <div
                v-if="deletingId === thread.id"
                class="tpl:mt-2 tpl:flex tpl:items-center tpl:gap-2 tpl:rounded-md tpl:px-2.5 tpl:py-2 tpl:text-xs"
                style="
                  background-color: var(--tpl-danger-light);
                  color: var(--tpl-danger);
                "
              >
                <span class="tpl:flex-1">
                  {{ t.comments.deleteConfirm }}
                </span>
                <button
                  class="tpl:rounded tpl:px-2 tpl:py-0.5 tpl:text-xs tpl:font-medium"
                  style="
                    background-color: var(--tpl-danger);
                    color: var(--tpl-bg);
                  "
                  @click="handleDelete(thread.id)"
                >
                  {{ t.comments.delete }}
                </button>
                <button
                  class="tpl:text-xs tpl:font-medium"
                  style="color: var(--tpl-text-muted)"
                  @click="cancelDelete()"
                >
                  {{ t.comments.cancel }}
                </button>
              </div>

              <!-- Thread actions -->
              <div
                v-if="editingId !== thread.id && deletingId !== thread.id"
                class="tpl:mt-2 tpl:flex tpl:items-center tpl:gap-2"
              >
                <button
                  class="tpl-comment-action tpl:rounded tpl:p-1 tpl:transition-colors tpl:duration-150"
                  :title="t.comments.reply"
                  @click="startReply(thread.id)"
                >
                  <Reply
                    :size="13"
                    :stroke-width="2"
                    style="color: var(--tpl-primary)"
                  />
                </button>
                <button
                  v-if="(thread.replies?.length ?? 0) > 0"
                  class="tpl:flex tpl:items-center tpl:gap-0.5 tpl:text-[11px] tpl:font-medium tpl:transition-colors tpl:duration-150"
                  style="color: var(--tpl-text-muted)"
                  @click="toggleThread(thread.id)"
                >
                  <template v-if="expandedThreads.has(thread.id)">
                    <ChevronUp :size="11" :stroke-width="2" />
                  </template>
                  <template v-else>
                    <ChevronDown :size="11" :stroke-width="2" />
                  </template>
                  {{
                    (thread.replies?.length ?? 0) === 1
                      ? format(t.comments.replyOne, {
                          count: String(thread.replies?.length ?? 0),
                        })
                      : format(t.comments.replyMany, {
                          count: String(thread.replies?.length ?? 0),
                        })
                  }}
                </button>
              </div>
            </div>

            <!-- Replies -->
            <Transition name="tpl-replies">
              <div
                v-if="
                  expandedThreads.has(thread.id) &&
                  (thread.replies?.length ?? 0) > 0
                "
                class="tpl-comment-replies tpl:ml-5 tpl:pl-3 tpl:pt-2"
              >
                <div
                  v-for="(reply, index) in thread.replies"
                  :key="reply.id"
                  class="tpl-comment-reply-card tpl:relative tpl:rounded-lg tpl:border tpl:px-3.5 tpl:py-2.5"
                  :class="
                    index < (thread.replies?.length ?? 0) - 1 ? 'tpl:mb-2' : ''
                  "
                >
                  <div
                    class="tpl:flex tpl:items-start tpl:justify-between tpl:gap-2"
                  >
                    <div class="tpl:flex tpl:items-center tpl:gap-1.5">
                      <span
                        class="tpl:text-xs tpl:font-semibold"
                        style="color: var(--tpl-text)"
                      >
                        {{
                          isOwnComment(reply)
                            ? t.comments.ownedByYou
                            : reply.author_name
                        }}
                      </span>
                      <span
                        class="tpl:text-[10px]"
                        style="color: var(--tpl-text-dim)"
                      >
                        {{ formatTime(reply.created_at) }}
                      </span>
                      <span
                        v-if="reply.updated_at !== reply.created_at"
                        class="tpl:text-[10px] tpl:italic"
                        style="color: var(--tpl-text-dim)"
                      >
                        ({{ t.comments.edited }})
                      </span>
                    </div>
                    <div class="tpl:flex tpl:items-center tpl:gap-0.5">
                      <button
                        v-if="isOwnComment(reply)"
                        class="tpl-comment-action tpl:rounded tpl:p-1 tpl:transition-colors tpl:duration-150"
                        :title="t.comments.edit"
                        @click="startEdit(reply)"
                      >
                        <Pencil :size="11" :stroke-width="2" />
                      </button>
                      <button
                        v-if="isOwnComment(reply)"
                        class="tpl-comment-action tpl-comment-delete tpl:rounded tpl:p-1 tpl:transition-colors tpl:duration-150"
                        :title="t.comments.delete"
                        @click="confirmDelete(reply.id)"
                      >
                        <Trash2 :size="11" :stroke-width="2" />
                      </button>
                    </div>
                  </div>

                  <!-- Reply body (or edit mode) -->
                  <div v-if="editingId === reply.id" class="tpl:mt-1.5">
                    <textarea
                      v-model="editBody"
                      class="tpl:w-full tpl:resize-none tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-2 tpl:font-sans tpl:text-xs tpl:outline-none"
                      style="
                        border-color: var(--tpl-border);
                        background-color: var(--tpl-bg);
                        color: var(--tpl-text);
                      "
                      rows="2"
                      @keydown="handleEditKeydown($event, reply.id)"
                    />
                    <div class="tpl:mt-1.5 tpl:flex tpl:gap-1.5">
                      <button
                        class="tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium"
                        style="
                          background-color: var(--tpl-primary);
                          color: var(--tpl-bg);
                        "
                        :disabled="
                          !editBody.trim() || comments.isSubmitting.value
                        "
                        @click="handleEdit(reply.id)"
                      >
                        {{ t.comments.save }}
                      </button>
                      <button
                        class="tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium"
                        style="color: var(--tpl-text-muted)"
                        @click="cancelEdit()"
                      >
                        {{ t.comments.cancel }}
                      </button>
                    </div>
                  </div>
                  <p
                    v-else
                    class="tpl:mt-1 tpl:text-xs tpl:leading-relaxed tpl:whitespace-pre-wrap"
                    style="color: var(--tpl-text)"
                  >
                    {{ reply.body }}
                  </p>

                  <!-- Delete confirmation for reply -->
                  <div
                    v-if="deletingId === reply.id"
                    class="tpl:mt-2 tpl:flex tpl:items-center tpl:gap-2 tpl:rounded-md tpl:px-2.5 tpl:py-2 tpl:text-xs"
                    style="
                      background-color: var(--tpl-danger-light);
                      color: var(--tpl-danger);
                    "
                  >
                    <span class="tpl:flex-1">
                      {{ t.comments.deleteConfirm }}
                    </span>
                    <button
                      class="tpl:rounded tpl:px-2 tpl:py-0.5 tpl:text-xs tpl:font-medium"
                      style="
                        background-color: var(--tpl-danger);
                        color: var(--tpl-bg);
                      "
                      @click="handleDelete(reply.id)"
                    >
                      {{ t.comments.delete }}
                    </button>
                    <button
                      class="tpl:text-xs tpl:font-medium"
                      style="color: var(--tpl-text-muted)"
                      @click="cancelDelete()"
                    >
                      {{ t.comments.cancel }}
                    </button>
                  </div>
                </div>
              </div>
            </Transition>

            <!-- Reply input -->
            <Transition name="tpl-replies">
              <div
                v-if="replyingTo === thread.id"
                class="tpl-comment-replies tpl:ml-5 tpl:pl-3 tpl:pt-2"
              >
                <div class="tpl:flex tpl:items-end tpl:gap-2">
                  <textarea
                    v-model="replyBody"
                    class="tpl:flex-1 tpl:resize-none tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-2 tpl:font-sans tpl:text-xs tpl:outline-none"
                    style="
                      border-color: var(--tpl-border);
                      background-color: var(--tpl-bg);
                      color: var(--tpl-text);
                    "
                    :placeholder="t.comments.replyPlaceholder"
                    rows="2"
                    @keydown="handleReplyKeydown($event, thread.id)"
                  />
                  <div class="tpl:flex tpl:shrink-0 tpl:flex-col tpl:gap-1">
                    <button
                      class="tpl:flex tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1.5 tpl:transition-colors tpl:duration-150 tpl:disabled:opacity-40"
                      style="color: var(--tpl-primary)"
                      :disabled="
                        !replyBody.trim() || comments.isSubmitting.value
                      "
                      @click="handleReply(thread.id)"
                    >
                      <Send :size="14" :stroke-width="2" />
                    </button>
                    <button
                      class="tpl:flex tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1.5 tpl:transition-colors tpl:duration-150"
                      style="color: var(--tpl-text-muted)"
                      @click="cancelReply()"
                    >
                      <X :size="14" :stroke-width="2" />
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- New comment input -->
      <div class="tpl:border-t tpl:p-3" style="border-color: var(--tpl-border)">
        <div
          v-if="isBlockFilterUnsaved"
          class="tpl:flex tpl:min-h-[68px] tpl:items-center tpl:rounded-md tpl:px-3 tpl:py-2 tpl:text-xs"
          style="
            background-color: var(--tpl-warning-light);
            color: var(--tpl-warning);
          "
        >
          {{ t.comments.saveTemplateFirst }}
        </div>
        <div
          v-else
          class="tpl-comments-input-wrapper tpl:flex tpl:min-h-[68px] tpl:items-end tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:border tpl:px-3 tpl:py-2"
          style="
            border-color: var(--tpl-border);
            background-color: var(--tpl-bg);
          "
        >
          <textarea
            ref="newCommentInput"
            v-model="newCommentBody"
            class="tpl:max-h-24 tpl:min-h-[48px] tpl:flex-1 tpl:resize-none tpl:border-none tpl:bg-transparent tpl:font-sans tpl:text-xs tpl:outline-none"
            style="color: var(--tpl-text)"
            :placeholder="t.comments.placeholder"
            :disabled="comments.isSubmitting.value"
            rows="2"
            @keydown="handleNewCommentKeydown"
          />
          <button
            class="tpl-comments-send-btn tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1.5 tpl:transition-all tpl:duration-150 tpl:disabled:opacity-40"
            style="color: var(--tpl-primary)"
            :disabled="!newCommentBody.trim() || comments.isSubmitting.value"
            @click="handleAddComment"
          >
            <LoaderCircle
              v-if="comments.isSubmitting.value"
              class="tpl-spinner"
              :size="16"
              :stroke-width="2"
            />
            <Send v-else :size="16" :stroke-width="2" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.tpl-comments-slide-enter-active {
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-comments-slide-leave-active {
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tpl-comments-input-wrapper:focus-within {
  border-color: var(--tpl-primary);
  box-shadow: var(--tpl-ring);
}

.tpl-comments-send-btn:not(:disabled):hover {
  transform: scale(1.05);
}

.tpl-comment-filter {
  color: var(--tpl-text-muted);
  background-color: transparent;
}

.tpl-comment-filter:hover {
  background-color: var(--tpl-bg-hover);
  color: var(--tpl-text);
}

.tpl-comment-filter--active {
  background-color: var(--tpl-primary-light);
  color: var(--tpl-primary);
}

.tpl-comment-action {
  color: var(--tpl-text-dim);
  background-color: transparent;
}

.tpl-comment-action:hover {
  background-color: var(--tpl-bg-hover);
  color: var(--tpl-text);
}

.tpl-comment-delete:hover {
  background-color: var(--tpl-danger-light);
  color: var(--tpl-danger);
}

.tpl-comment-card {
  border-color: var(--tpl-border);
  background-color: var(--tpl-bg);
}

.tpl-comment-reply-card {
  border-color: var(--tpl-border);
  background-color: var(--tpl-bg);
}

.tpl-resolve-enter-active,
.tpl-resolve-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.tpl-resolve-enter-from,
.tpl-resolve-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.tpl-resolve-icon {
  transition:
    color 0.3s ease,
    transform 0.2s ease;
}

.tpl-resolve-icon:active {
  transform: scale(1.3);
}

.tpl-replies-enter-active,
.tpl-replies-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.tpl-replies-enter-from,
.tpl-replies-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
