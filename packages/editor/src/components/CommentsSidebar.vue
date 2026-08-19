<script setup lang="ts">
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { EDITOR_KEY, requireInject } from "../keys";
import { useI18n } from "../composables/useI18n";
import type { UseCommentsFeatureReturn } from "../composables/useCommentsFeature";
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
import { computed, nextTick, ref, watch } from "vue";

/**
 * The review panel, **shared by both entry points**.
 *
 * It takes the shared feature as a prop — the `TestEmailPanel` /
 * `SavedBlocksPanels` shape — so the same panel drives a consumer's own store and
 * Cloud's, and its strings live in the OSS chunk.
 *
 * Every write action is gated on the provider having supplied that mutation, and
 * **hidden** rather than disabled when it hasn't: a provider that withholds all
 * four yields a readable review with no way to change anything.
 */
const props = defineProps<{
  visible: boolean;
  feature: UseCommentsFeatureReturn;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { t, format } = useI18n();
const editor = requireInject(EDITOR_KEY, "CommentsSidebar");

const comments = computed(() => props.feature.headless);

type FilterMode = "all" | "unresolved" | "block";
const filterMode = ref<FilterMode>("unresolved");

const newCommentBody = ref("");
const replyingTo = ref<string | null>(null);
const replyBody = ref("");
const editingId = ref<string | null>(null);
const editBody = ref("");
const expandedThreads = ref<Set<string>>(new Set());
const deletingId = ref<string | null>(null);
const newCommentInput = ref<HTMLTextAreaElement | null>(null);

/**
 * The block filter lives on the feature, not here: a canvas comment indicator sets
 * it *before* this panel exists (it is lazy), so the target has to survive the gap.
 */
const filterBlockId = computed(() => props.feature.filterBlockId.value);

// An indicator click lands a block id on the feature; switching to that filter is
// this panel's half of the handshake. `immediate` covers the case that opened the
// panel in the first place, where the id is already set at mount.
watch(
  filterBlockId,
  (blockId) => {
    if (blockId) filterMode.value = "block";
  },
  { immediate: true },
);

// `isLoading` alone would flash the skeleton over a perfectly good list every
// re-open; the pair distinguishes "fetching, nothing yet" from "refreshing".
const isInitialLoad = computed(
  () =>
    comments.value.isLoading.value &&
    comments.value.comments.value.length === 0,
);

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

function isBlockMissing(blockId: string | null | undefined): boolean {
  if (!blockId) {
    return false;
  }
  return !allBlockIds.value.has(blockId);
}

const isBlockFilterUnsaved = computed(() => {
  if (filterMode.value !== "block" || !filterBlockId.value) {
    return false;
  }
  // Asked through the capability rather than off the editor: a comment anchors to
  // a block in the *saved* template, and only the provider's side knows what that
  // contains. A store that accepts any anchor answers `true` and this never fires.
  return props.feature.capability.isBlockSaved(filterBlockId.value) === false;
});

const filteredComments = computed(() => {
  let items = comments.value.comments.value;

  if (filterMode.value === "unresolved") {
    items = items.filter((c) => !c.resolvedAt);
  } else if (filterMode.value === "block" && filterBlockId.value) {
    items = items.filter((c) => c.blockId === filterBlockId.value);
  }

  return items;
});

watch(
  () => editor.state.selectedBlockId,
  (newBlockId) => {
    if (filterMode.value === "block" && newBlockId) {
      props.feature.filterBlockId.value = newBlockId;
    }
  },
);

function setFilter(mode: FilterMode, blockId?: string): void {
  filterMode.value = mode;
  props.feature.filterBlockId.value =
    mode === "block" ? (blockId ?? null) : null;
}

function filterByBlock(blockId: string): void {
  setFilter("block", blockId);
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

/**
 * Every write swallows its rejection. The feature already routed it to `onError`
 * and left the list untouched, and an unhandled rejection out of a DOM event
 * binding helps nobody — same shape as `VersionHistoryPanels`.
 */
async function handleAddComment(): Promise<void> {
  const body = newCommentBody.value.trim();
  if (!body || !comments.value.canCreate.value) {
    return;
  }

  const blockId =
    filterMode.value === "block" ? filterBlockId.value : undefined;
  try {
    await comments.value.create({ body, blockId: blockId ?? undefined });
    newCommentBody.value = "";
  } catch {
    /* reported through onError */
  }
}

async function handleReply(parentId: string): Promise<void> {
  const body = replyBody.value.trim();
  if (!body || !comments.value.canCreate.value) {
    return;
  }

  const parent = comments.value.find(parentId);
  try {
    await comments.value.create({
      body,
      blockId: parent?.blockId ?? undefined,
      parentId,
    });
    replyingTo.value = null;
    replyBody.value = "";
  } catch {
    /* reported through onError */
  }
}

async function handleEdit(commentId: string): Promise<void> {
  const body = editBody.value.trim();
  if (!body) {
    return;
  }

  try {
    await comments.value.update(commentId, { body });
    editingId.value = null;
    editBody.value = "";
  } catch {
    /* reported through onError */
  }
}

async function handleDelete(commentId: string): Promise<void> {
  try {
    await comments.value.remove(commentId);
  } catch {
    /* reported through onError */
  }
  deletingId.value = null;
}

async function handleResolve(comment: Comment): Promise<void> {
  try {
    // The target state, not a toggle: two clicks in flight can't invert.
    await comments.value.setResolved(comment.id, !comment.resolvedAt);
  } catch {
    /* reported through onError */
  }
}

/** Editing and deleting are the author's own, and only when the store allows it. */
function canEdit(comment: Comment): boolean {
  return comments.value.canUpdate.value && comments.value.isOwn(comment);
}

function canDelete(comment: Comment): boolean {
  return comments.value.canDelete.value && comments.value.isOwn(comment);
}

function formatTime(dateString: string): string {
  return formatRelativeTime(dateString, t.time) ?? dateString;
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
      data-testid="comments-sidebar"
      class="tpl-comments-sidebar tpl:absolute tpl:top-14 tpl:right-0 tpl:bottom-0 tpl:z-panel tpl:flex tpl:w-[360px] tpl:flex-col tpl:border-l tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-elevated)]"
    >
      <!-- Header -->
      <div
        class="tpl:flex tpl:items-center tpl:justify-between tpl:border-b tpl:border-[var(--tpl-border)] tpl:px-4 tpl:py-3"
      >
        <div
          class="tpl:flex tpl:items-center tpl:gap-1.5 tpl:text-sm tpl:font-medium tpl:text-[var(--tpl-text)]"
        >
          <MessageCircle :size="13" :stroke-width="2" />
          <span>{{ t.comments.title }}</span>
          <span
            v-if="feature.unresolvedCount.value > 0"
            class="tpl:ml-1 tpl:inline-flex tpl:size-5 tpl:items-center tpl:justify-center tpl:rounded-full tpl:text-[10px] tpl:font-semibold tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-on-primary)]"
          >
            {{ feature.unresolvedCount.value }}
          </span>
        </div>
        <button
          class="tpl:rounded-md tpl:p-0.5 tpl:transition-colors tpl:text-[var(--tpl-text-muted)]"
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
          class="tpl-comment-filter tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors"
          :class="
            filterMode === 'unresolved' ? 'tpl-comment-filter--active' : ''
          "
          data-testid="comments-filter-unresolved"
          @click="setFilter('unresolved')"
        >
          {{ t.comments.filterUnresolved }}
        </button>
        <button
          class="tpl-comment-filter tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors"
          :class="filterMode === 'all' ? 'tpl-comment-filter--active' : ''"
          data-testid="comments-filter-all"
          @click="setFilter('all')"
        >
          {{ t.comments.filterAll }}
        </button>
        <button
          v-if="editor.state.selectedBlockId"
          class="tpl-comment-filter tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors"
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
          v-if="isInitialLoad"
          class="tpl:flex tpl:h-full tpl:items-center tpl:justify-center"
        >
          <LoaderCircle
            class="tpl-spinner tpl:text-[var(--tpl-text-muted)]"
            :size="24"
            :stroke-width="2"
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
            class="tpl:text-[var(--tpl-text-dim)]"
          />
          <p
            class="tpl:max-w-[240px] tpl:text-sm tpl:text-[var(--tpl-text-muted)]"
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
            data-testid="comment-thread"
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
                    class="tpl:text-xs tpl:font-semibold tpl:text-[var(--tpl-text)]"
                  >
                    {{
                      comments.isOwn(thread)
                        ? t.comments.ownedByYou
                        : thread.author.name
                    }}
                  </span>
                  <span class="tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]">
                    {{ formatTime(thread.createdAt) }}
                  </span>
                  <span
                    v-if="thread.updatedAt"
                    class="tpl:text-[10px] tpl:italic tpl:text-[var(--tpl-text-dim)]"
                  >
                    ({{ t.comments.edited }})
                  </span>
                </div>
                <div class="tpl:flex tpl:items-center tpl:gap-0.5">
                  <!-- Resolve toggle -->
                  <button
                    v-if="comments.canResolve.value"
                    data-testid="comment-resolve"
                    class="tpl-comment-action tpl:rounded tpl:p-1 tpl:transition-colors"
                    :title="
                      thread.resolvedAt
                        ? t.comments.unresolve
                        : t.comments.resolve
                    "
                    @click="handleResolve(thread)"
                  >
                    <CircleCheck
                      :size="13"
                      :stroke-width="2"
                      class="tpl-resolve-icon"
                      :style="{
                        color: thread.resolvedAt
                          ? 'var(--tpl-primary)'
                          : undefined,
                      }"
                    />
                  </button>
                  <!-- Edit (own only) -->
                  <button
                    v-if="canEdit(thread)"
                    data-testid="comment-edit"
                    class="tpl-comment-action tpl:rounded tpl:p-1 tpl:transition-colors"
                    :title="t.comments.edit"
                    @click="startEdit(thread)"
                  >
                    <Pencil :size="12" :stroke-width="2" />
                  </button>
                  <!-- Delete (own only) -->
                  <button
                    v-if="canDelete(thread)"
                    data-testid="comment-delete"
                    class="tpl-comment-action tpl-comment-delete tpl:rounded tpl:p-1 tpl:transition-colors"
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
                  v-if="thread.resolvedAt"
                  class="tpl:mt-1 tpl:flex tpl:items-center tpl:gap-1 tpl:text-[10px] tpl:text-[var(--tpl-primary)]"
                >
                  <Check :size="10" :stroke-width="2.5" />
                  <span>
                    {{
                      format(t.comments.resolvedBy, {
                        name: thread.resolvedBy?.name ?? "",
                      })
                    }}
                  </span>
                </div>
              </Transition>

              <!-- Block anchor indicator -->
              <span
                v-if="thread.blockId && isBlockMissing(thread.blockId)"
                class="tpl:mt-1 tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:bg-[var(--tpl-warning-light)] tpl:text-[var(--tpl-warning)]"
              >
                {{ t.comments.missingBlock }}
              </span>
              <button
                v-else-if="thread.blockId"
                class="tpl:mt-1 tpl:inline-flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-1.5 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:transition-colors tpl:bg-[var(--tpl-bg-hover)] tpl:text-[var(--tpl-text-muted)]"
                @click="editor.selectBlock(thread.blockId ?? '')"
              >
                {{ t.comments.jumpToBlock }}
              </button>

              <!-- Comment body (or edit mode) -->
              <div v-if="editingId === thread.id" class="tpl:mt-2">
                <textarea
                  v-model="editBody"
                  class="tpl:w-full tpl:resize-none tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-2 tpl:font-sans tpl:text-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
                  rows="3"
                  @keydown="handleEditKeydown($event, thread.id)"
                />
                <div class="tpl:mt-1.5 tpl:flex tpl:gap-1.5">
                  <button
                    class="tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-on-primary)]"
                    :disabled="!editBody.trim() || comments.isSubmitting.value"
                    @click="handleEdit(thread.id)"
                  >
                    {{ t.comments.save }}
                  </button>
                  <button
                    class="tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:transition-colors tpl:text-[var(--tpl-text-muted)]"
                    @click="cancelEdit()"
                  >
                    {{ t.comments.cancel }}
                  </button>
                </div>
              </div>
              <p
                v-else
                class="tpl:mt-1.5 tpl:text-xs tpl:leading-relaxed tpl:whitespace-pre-wrap tpl:text-[var(--tpl-text)]"
              >
                {{ thread.body }}
              </p>

              <!-- Delete confirmation -->
              <div
                v-if="deletingId === thread.id"
                class="tpl:mt-2 tpl:flex tpl:items-center tpl:gap-2 tpl:rounded-md tpl:px-2.5 tpl:py-2 tpl:text-xs tpl:bg-[var(--tpl-danger-light)] tpl:text-[var(--tpl-danger)]"
              >
                <span class="tpl:flex-1">
                  {{ t.comments.deleteConfirm }}
                </span>
                <button
                  class="tpl:rounded tpl:px-2 tpl:py-0.5 tpl:text-xs tpl:font-medium tpl:bg-[var(--tpl-danger)] tpl:text-[var(--tpl-bg)]"
                  data-testid="comment-delete-confirm"
                  @click="handleDelete(thread.id)"
                >
                  {{ t.comments.delete }}
                </button>
                <button
                  class="tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
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
                  v-if="comments.canCreate.value"
                  data-testid="comment-reply"
                  class="tpl-comment-action tpl:rounded tpl:p-1 tpl:transition-colors"
                  :title="t.comments.reply"
                  @click="startReply(thread.id)"
                >
                  <Reply
                    :size="13"
                    :stroke-width="2"
                    class="tpl:text-[var(--tpl-primary)]"
                  />
                </button>
                <button
                  v-if="(thread.replies?.length ?? 0) > 0"
                  class="tpl:flex tpl:items-center tpl:gap-0.5 tpl:text-[11px] tpl:font-medium tpl:transition-colors tpl:text-[var(--tpl-text-muted)]"
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
                        class="tpl:text-xs tpl:font-semibold tpl:text-[var(--tpl-text)]"
                      >
                        {{
                          comments.isOwn(reply)
                            ? t.comments.ownedByYou
                            : reply.author.name
                        }}
                      </span>
                      <span
                        class="tpl:text-[10px] tpl:text-[var(--tpl-text-dim)]"
                      >
                        {{ formatTime(reply.createdAt) }}
                      </span>
                      <span
                        v-if="reply.updatedAt"
                        class="tpl:text-[10px] tpl:italic tpl:text-[var(--tpl-text-dim)]"
                      >
                        ({{ t.comments.edited }})
                      </span>
                    </div>
                    <div class="tpl:flex tpl:items-center tpl:gap-0.5">
                      <button
                        v-if="canEdit(reply)"
                        class="tpl-comment-action tpl:rounded tpl:p-1 tpl:transition-colors"
                        :title="t.comments.edit"
                        @click="startEdit(reply)"
                      >
                        <Pencil :size="11" :stroke-width="2" />
                      </button>
                      <button
                        v-if="canDelete(reply)"
                        class="tpl-comment-action tpl-comment-delete tpl:rounded tpl:p-1 tpl:transition-colors"
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
                      class="tpl:w-full tpl:resize-none tpl:rounded-md tpl:border tpl:px-2.5 tpl:py-2 tpl:font-sans tpl:text-xs tpl:outline-none tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text)]"
                      rows="2"
                      @keydown="handleEditKeydown($event, reply.id)"
                    />
                    <div class="tpl:mt-1.5 tpl:flex tpl:gap-1.5">
                      <button
                        class="tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:bg-[var(--tpl-primary)] tpl:text-[var(--tpl-on-primary)]"
                        :disabled="
                          !editBody.trim() || comments.isSubmitting.value
                        "
                        @click="handleEdit(reply.id)"
                      >
                        {{ t.comments.save }}
                      </button>
                      <button
                        class="tpl:rounded-md tpl:px-2.5 tpl:py-1 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
                        @click="cancelEdit()"
                      >
                        {{ t.comments.cancel }}
                      </button>
                    </div>
                  </div>
                  <p
                    v-else
                    class="tpl:mt-1 tpl:text-xs tpl:leading-relaxed tpl:whitespace-pre-wrap tpl:text-[var(--tpl-text)]"
                  >
                    {{ reply.body }}
                  </p>

                  <!-- Delete confirmation for reply -->
                  <div
                    v-if="deletingId === reply.id"
                    class="tpl:mt-2 tpl:flex tpl:items-center tpl:gap-2 tpl:rounded-md tpl:px-2.5 tpl:py-2 tpl:text-xs tpl:bg-[var(--tpl-danger-light)] tpl:text-[var(--tpl-danger)]"
                  >
                    <span class="tpl:flex-1">
                      {{ t.comments.deleteConfirm }}
                    </span>
                    <button
                      class="tpl:rounded tpl:px-2 tpl:py-0.5 tpl:text-xs tpl:font-medium tpl:bg-[var(--tpl-danger)] tpl:text-[var(--tpl-bg)]"
                      data-testid="comment-delete-confirm"
                      @click="handleDelete(reply.id)"
                    >
                      {{ t.comments.delete }}
                    </button>
                    <button
                      class="tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)]"
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
                <!-- Same shape as the new-comment composer below: the border and
                     the focus ring belong to the wrapper, the field is bare
                     inside it, and the actions sit within the bounds rather than
                     floating beside them. The two composers do the same job, so a
                     reader should not have to notice they are different
                     components. Only the height differs — a reply is nested and
                     indented, so it starts at two rows without the composer's
                     `min-h`. -->
                <div
                  class="tpl-comments-input-wrapper tpl-focus-ring-host tpl:flex tpl:items-end tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:border tpl:px-3 tpl:py-2 tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)]"
                >
                  <textarea
                    v-model="replyBody"
                    class="tpl:max-h-24 tpl:flex-1 tpl:resize-none tpl:border-none tpl:bg-transparent tpl:font-sans tpl:text-xs tpl:outline-none tpl:text-[var(--tpl-text)]"
                    :placeholder="t.comments.replyPlaceholder"
                    rows="2"
                    @keydown="handleReplyKeydown($event, thread.id)"
                  />
                  <button
                    class="tpl-comments-send-btn tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1.5 tpl:transition-all tpl:disabled:opacity-40 tpl:text-[var(--tpl-primary)]"
                    :disabled="!replyBody.trim() || comments.isSubmitting.value"
                    @click="handleReply(thread.id)"
                  >
                    <Send :size="14" :stroke-width="2" />
                  </button>
                  <button
                    class="tpl-comments-send-btn tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1.5 tpl:transition-all tpl:text-[var(--tpl-text-muted)]"
                    @click="cancelReply()"
                  >
                    <X :size="14" :stroke-width="2" />
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- New comment input. Absent entirely when the store withheld `create` —
           hidden rather than disabled, so a read-only review reads as one rather
           than as a broken composer. -->
      <div
        v-if="comments.canCreate.value"
        class="tpl:border-t tpl:p-3 tpl:border-[var(--tpl-border)]"
      >
        <div
          v-if="isBlockFilterUnsaved"
          class="tpl:flex tpl:min-h-[68px] tpl:items-center tpl:rounded-md tpl:px-3 tpl:py-2 tpl:text-xs tpl:bg-[var(--tpl-warning-light)] tpl:text-[var(--tpl-warning)]"
        >
          {{ t.comments.saveTemplateFirst }}
        </div>
        <div
          v-else
          class="tpl-comments-input-wrapper tpl-focus-ring-host tpl:flex tpl:min-h-[68px] tpl:items-end tpl:gap-2 tpl:rounded-[var(--tpl-radius)] tpl:border tpl:px-3 tpl:py-2 tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)]"
        >
          <textarea
            ref="newCommentInput"
            v-model="newCommentBody"
            class="tpl:max-h-24 tpl:min-h-[48px] tpl:flex-1 tpl:resize-none tpl:border-none tpl:bg-transparent tpl:font-sans tpl:text-xs tpl:outline-none tpl:text-[var(--tpl-text)]"
            data-testid="comments-input"
            :placeholder="t.comments.placeholder"
            :disabled="comments.isSubmitting.value"
            rows="2"
            @keydown="handleNewCommentKeydown"
          />
          <button
            class="tpl-comments-send-btn tpl:flex tpl:shrink-0 tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1.5 tpl:transition-all tpl:disabled:opacity-40 tpl:text-[var(--tpl-primary)]"
            data-testid="comments-send"
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
