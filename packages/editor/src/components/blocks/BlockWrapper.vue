<script setup lang="ts">
import { useI18n } from "../../composables/useI18n";
import type { Block, ViewportSize } from "@templatical/types";
import {
  Bookmark,
  Copy,
  EyeOff,
  Filter,
  GripVertical,
  MessageCircle,
  Trash2,
} from "@lucide/vue";
import {
  computed,
  defineAsyncComponent,
  inject,
  nextTick,
  ref,
  watchPostEffect,
} from "vue";
import { useEventListener, useResizeObserver } from "@vueuse/core";
import { useResolvedBackgroundUrl } from "../../composables/useImageUrlResolver";
import {
  backgroundImageHostClass,
  getBlockWrapperStyle,
  getSectionWrapperStyle,
} from "../../utils/blockComponentResolver";

const BlockIssueBadge = defineAsyncComponent(
  () => import("../canvas/BlockIssueBadge.vue"),
);
import {
  BLOCK_ACTIONS_KEY,
  CONDITION_PREVIEW_KEY,
  CAPABILITIES_KEY,
  EDITOR_KEY,
  KEYBOARD_REORDER_KEY,
  LAYOUT_KEY,
} from "../../keys";
import { matchImageBoxWidth } from "../../utils/imageRoom";
import { readableTextColor } from "../../utils/readableTextColor";

const props = defineProps<{
  block: Block;
  isSelected: boolean;
  viewport?: ViewportSize;
  previewMode?: boolean;
  /**
   * This block sits inside a section column rather than at the top level.
   * Section children can't be saved as saved blocks: a saved block's content is
   * a top-level `Block[]` and insertion always targets the top level, so a
   * nested block could be saved but never re-inserted where it came from.
   * Save the whole section instead — its `children` round-trip with it.
   */
  nested?: boolean;
  /**
   * Chosen during a saved-blocks pick session. Independent of `isSelected` —
   * picking never touches `EditorState.selectedBlockId`.
   */
  picked?: boolean;
}>();

const emit = defineEmits<{
  (e: "select"): void;
}>();

const { t, format } = useI18n();

const keyboardReorder = inject(KEYBOARD_REORDER_KEY, null);
const dragButtonRef = ref<HTMLButtonElement | null>(null);

const isLifted = computed(
  () => keyboardReorder?.liftedBlockId.value === props.block.id,
);

const dragAriaLabel = computed(() =>
  isLifted.value
    ? format(t.blockActions.dragLifted, {
        block: props.block.type,
      })
    : t.blockActions.drag,
);

async function refocusDragButton(): Promise<void> {
  await nextTick();
  dragButtonRef.value?.focus();
}

function handleDragKeydown(event: KeyboardEvent): void {
  if (!keyboardReorder) return;

  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    if (isLifted.value) {
      keyboardReorder.drop(props.block.id);
    } else {
      keyboardReorder.lift(props.block.id);
    }
    return;
  }

  if (!isLifted.value) return;

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    keyboardReorder.cancel();
    refocusDragButton();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    event.stopPropagation();
    keyboardReorder.moveUp(props.block.id);
    refocusDragButton();
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    event.stopPropagation();
    keyboardReorder.moveDown(props.block.id);
    refocusDragButton();
  }
}

const isHiddenOnViewport = computed(() => {
  if (!props.viewport || !props.block.visibility) {
    return false;
  }
  return props.block.visibility[props.viewport] === false;
});

// In edit mode a viewport-hidden block stays rendered (dimmed + badge) so it
// remains selectable. In preview mode it must actually disappear to match the
// exported MJML, which drops it via `@media` + `tpl-hide-*` css-classes.
const isHiddenInPreview = computed(
  () => props.previewMode === true && isHiddenOnViewport.value,
);

const hiddenLabel = computed(() => {
  if (!props.viewport) {
    return "";
  }
  const labels: Record<string, string> = {
    desktop: t.viewport.desktop,
    mobile: t.viewport.mobile,
  };
  return labels[props.viewport] ?? props.viewport;
});

const hasDisplayCondition = computed(() => !!props.block.displayCondition);

const blockActions = inject(BLOCK_ACTIONS_KEY, null);
const conditionPreview = inject(CONDITION_PREVIEW_KEY, null);

const caps = inject(CAPABILITIES_KEY, {});

const isPicking = computed(() => caps.savedBlocks?.isPicking.value === true);

// `canCreate` too: a provider that withheld `create` gets a read-only library,
// so offering the bookmark would start a pick session that could never save.
const canSaveAsBlock = computed(
  () =>
    !props.nested &&
    caps.savedBlocks?.isAvailable.value === true &&
    caps.savedBlocks?.canCreate.value === true,
);

// The action bar is chrome for editing a single block; during a pick session the
// canvas is in a different mode and N bars would be noise.
const showActions = computed(() => props.isSelected && !isPicking.value);

const blockCommentCount = computed(
  () => caps.comments?.getBlockCount(props.block.id) ?? 0,
);

// The action bar sits right of the selected block and the comment pill past its
// top-right corner. The canvas pane scrolls, so whatever crosses its edge is
// clipped under the properties panel. Without room the pill joins the corner
// badge row, and the bar moves inside the block below that row, clamped to the
// pane. On a block too short for that, the bar stays vertically centred, left of
// the row. Beside a short block, the bar starts below the pill.
const blockElement = ref<HTMLElement | null>(null);
const actionsElement = ref<HTMLElement | null>(null);
const badgesElement = ref<HTMLElement | null>(null);
const commentElement = ref<HTMLElement | null>(null);
const actionsStyle = ref({ left: "calc(100% + 8px)", top: "50%" });
const commentInBadges = ref(false);
// Only blocks showing a bar or a pill measure, listen and observe.
const chromeElement = computed(
  () => actionsElement.value ?? commentElement.value,
);
const canvasBody = computed(() =>
  chromeElement.value?.closest<HTMLElement>(".tpl-body"),
);
function positionChrome(): void {
  const inBadges = commentInBadges.value;
  const actions = actionsElement.value;
  const comment = commentElement.value;
  const block = blockElement.value;
  if ((!actions && !comment) || !block?.offsetWidth) return;
  const box = block.getBoundingClientRect();
  // Client rects carry a host's transform scale; style offsets don't.
  const scale = box.width / block.offsetWidth || 1;
  const pane = canvasBody.value;
  const paneLeft = pane
    ? (pane.getBoundingClientRect().left - box.left) / scale + pane.clientLeft
    : -Infinity;
  const paneRight = pane ? paneLeft + pane.clientWidth : Infinity;
  if (comment?.offsetWidth) {
    // Past the corner the pill spans 4 px to 4 px + its width right of the block.
    const fits = block.offsetWidth + 4 + comment.offsetWidth + 4 <= paneRight;
    if (inBadges === fits) {
      commentInBadges.value = !fits;
      // The bar steps around the row once it renders with the pill moved. An
      // effect doesn't re-run for its own writes, so this one can't wait on it.
      void nextTick(positionChrome);
      return;
    }
  }
  if (!actions?.offsetWidth) return;
  let left = Math.max(
    paneLeft + 4,
    Math.min(block.offsetWidth + 8, paneRight - actions.offsetWidth - 4),
  );
  const badges = badgesElement.value;
  // The lint badge alone ends at 24 px; the pill is 4 px taller.
  const belowBadges = Math.max(
    28,
    badges?.offsetHeight ? badges.offsetTop + badges.offsetHeight + 4 : 0,
  );
  const centre = Math.max(
    belowBadges + actions.offsetHeight / 2,
    block.offsetHeight / 2,
  );
  let top =
    left < block.offsetWidth &&
    centre + actions.offsetHeight / 2 <= block.offsetHeight + 8
      ? `${centre}px`
      : "50%";
  if (left >= block.offsetWidth && comment?.offsetWidth && !inBadges) {
    // Beside a short block the centred bar would cover the pill past its
    // corner, so it starts below the pill instead.
    const pillBottom =
      (comment.getBoundingClientRect().bottom - box.top) / scale;
    const clear = pillBottom + 4 + actions.offsetHeight / 2;
    if (clear > block.offsetHeight / 2) top = `${clear}px`;
  }
  if (left < block.offsetWidth && top === "50%") {
    const row = badges?.getBoundingClientRect();
    if (row?.width) {
      // Leave the badge row and its focus rings clear of a short block's bar.
      const beside = (row.left - box.left) / scale - actions.offsetWidth - 8;
      left = Math.max(
        paneLeft + 4,
        Math.min(beside, paneRight - actions.offsetWidth - 4),
      );
    }
  }
  // Scrolling the pane calls this often; an unchanged position doesn't re-render.
  if (actionsStyle.value.left !== `${left}px` || actionsStyle.value.top !== top)
    actionsStyle.value = { left: `${left}px`, top };
}
watchPostEffect(positionChrome);
useResizeObserver(
  computed(() =>
    chromeElement.value
      ? [
          blockElement.value,
          actionsElement.value,
          badgesElement.value,
          commentElement.value,
          canvasBody.value,
        ].filter((element): element is HTMLElement => !!element)
      : [],
  ),
  positionChrome,
);
useEventListener(canvasBody, "scroll", positionChrome, { passive: true });

// Another collaborator's lock: an outline in their colour and their name, on
// any block, a section's children included.
const lock = computed(() => caps.collaboration?.lockOf(props.block.id) ?? null);
const lockHolderName = computed(() =>
  lock.value?.holder.type === "guest"
    ? t.collaboration.guest
    : (lock.value?.holder.name ?? ""),
);

// A block an AI agent just changed, or this editor's own AI turn without
// collaboration (D42): an outline that fades out, so whoever is
// watching sees where the edit landed. Keyed by the highlight's number, so a
// second edit restarts the fade instead of letting the first one finish.
const agentHighlight = computed(
  () =>
    caps.collaboration?.agentHighlightOf(props.block.id) ??
    caps.ai?.highlightOf(props.block.id) ??
    null,
);

// Background images paint through `config.resolveImageUrl`, like ImageBlock's
// `src`; the resolved URL is display-only and never enters the content model.
// A merge-tag URL is neither resolved nor painted (`null`), as on ImageBlock.
const sectionBackgroundUrl = useResolvedBackgroundUrl(() =>
  props.block.type === "section" ? props.block.backgroundImage : undefined,
);
const wrapperBackgroundUrl = useResolvedBackgroundUrl(() =>
  props.block.type === "section"
    ? props.block.wrapper?.backgroundImage
    : undefined,
);

// Everything `getBlockWrapperStyle` computes lives on `.tpl-block-content`
// (not `.tpl-block`): the filter-based dark-mode preview inverts it as an
// email surface, so the bg inverts together with its content, the
// section corner radius has to round the element carrying that bg to match
// the exported MJML, and `--tpl-doc-paragraph-spacing` has to sit on an
// ancestor of the slotted `.tpl-text-content` for the paragraph rule to
// inherit it.
//
// Applied wholesale on purpose. This used to copy a fixed list of properties
// across, which silently dropped the paragraph-spacing variable — the control
// moved the number and the canvas never changed, while a unit test on
// `getBlockWrapperStyle` still passed.
const editor = inject(EDITOR_KEY, null);
const layout = inject(LAYOUT_KEY, undefined);

const contentStyle = computed(() =>
  getBlockWrapperStyle(props.block, {
    backgroundImageUrl: sectionBackgroundUrl.value,
    heroBoxWidth: matchImageBoxWidth(
      props.block,
      editor?.content.value,
      layout,
    ),
  }),
);

// Section outer frame — the canvas equivalent of the exported `mj-wrapper`:
// a band with its own background + padding + radius framing the section's box.
// `null` for non-wrapped blocks keeps the DOM unchanged (no extra element).
const sectionWrapperStyle = computed(() =>
  getSectionWrapperStyle(props.block, {
    backgroundImageUrl: wrapperBackgroundUrl.value,
  }),
);

function handleClick(event: MouseEvent): void {
  if (props.previewMode) {
    return;
  }
  // Rich-text blocks inject their links as raw <a> via v-html, so — unlike the
  // other link-bearing blocks (button, menu, image…) which carry a
  // template-level `@click.prevent` — they can't attach a directive to the
  // anchor. Suppress navigation here so a click selects the block for editing
  // instead of opening the href. Preview mode returns above, leaving real
  // links clickable. `closest` also walks out of nested inline markup (e.g. a
  // <strong> inside the link).
  if ((event.target as HTMLElement | null)?.closest("a")) {
    event.preventDefault();
  }
  event.stopPropagation();
  emit("select");
}

function handleDelete(): void {
  blockActions?.deleteBlock(props.block.id);
}

function handleDuplicate(): void {
  blockActions?.duplicateBlock(props.block);
}

function handleSaveAsBlock(): void {
  // Seeds a canvas pick session with this block rather than opening the dialog
  // straight away — the user picks any others by clicking them.
  caps.savedBlocks?.startPicking(props.block.id);
}

function handleConditionToggle(): void {
  conditionPreview?.toggleBlock(props.block.id);
}
</script>

<template>
  <div
    v-if="!isHiddenInPreview"
    ref="blockElement"
    class="tpl-block tpl:group tpl:relative tpl:cursor-pointer tpl:rounded-sm tpl:transition-shadow"
    :class="{
      'tpl-block--selected': isSelected,
      'tpl-block--picked': picked,
      'tpl-block--idle': !isSelected && !picked,
      'tpl-block--lifted': isLifted,
    }"
    :data-block-id="block.id"
    :data-block-type="block.type"
    :data-tpl-picked="picked || undefined"
    @click="handleClick"
  >
    <!-- Status badges share the block's top-right corner. The comment pill
         sits past the corner while the pane has room and joins this row when
         it hasn't, so the action bar steps around it. -->
    <div
      ref="badgesElement"
      class="tpl-block-badges tpl:absolute tpl:top-1 tpl:right-1 tpl:z-10 tpl:flex tpl:gap-1"
    >
      <button
        v-if="blockCommentCount > 0 && !isHiddenOnViewport"
        ref="commentElement"
        class="tpl-comment-indicator tpl:flex tpl:min-h-6 tpl:min-w-6 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:gap-0.5 tpl:rounded-full tpl:border-none tpl:px-2 tpl:py-0.5 tpl:text-[10px] tpl:font-semibold tpl:transition-colors tpl:bg-[var(--tpl-chrome-primary-light)] tpl:text-[var(--tpl-primary)]"
        :class="
          commentInBadges
            ? undefined
            : 'tpl:absolute tpl:-top-2 tpl:left-full tpl:ml-2'
        "
        :aria-label="
          format(t.blockActions.comments, { count: String(blockCommentCount) })
        "
        @click.stop="caps.comments?.openForBlock(block.id)"
      >
        <MessageCircle :size="12" :stroke-width="2.5" />
        {{ blockCommentCount }}
      </button>
      <BlockIssueBadge :block-id="block.id" />
    </div>
    <div
      v-if="lock"
      data-testid="block-lock"
      :data-lock-holder="lock.holder.sessionId"
      class="tpl-block-lock tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-[4] tpl:rounded-sm"
      :style="{
        outline: `2px solid ${lock.holder.color}`,
        outlineOffset: '-1px',
      }"
    >
      <span
        class="tpl:absolute tpl:-top-0.5 tpl:left-1/2 tpl:z-[5] tpl:-translate-x-1/2 tpl:-translate-y-full tpl:rounded-full tpl:px-2 tpl:py-0.5 tpl:text-[10px] tpl:font-medium tpl:whitespace-nowrap"
        :style="{
          backgroundColor: lock.holder.color,
          color: readableTextColor(lock.holder.color),
        }"
      >
        {{ format(t.collaboration.editing, { name: lockHolderName }) }}
      </span>
    </div>
    <div
      v-if="agentHighlight !== null"
      :key="agentHighlight"
      data-testid="block-agent-highlight"
      aria-hidden="true"
      class="tpl-block-agent-highlight tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-[4] tpl:rounded-sm"
    />
    <!-- Floating action bar: beside the block, or inside it below the badge
         row when the pane has no room. Placed by positionChrome. -->
    <div
      v-if="showActions"
      ref="actionsElement"
      :style="actionsStyle"
      role="toolbar"
      :aria-label="t.blockActions.drag"
      class="tpl-block-actions tpl-fade-in tpl:absolute tpl:top-1/2 tpl:z-20 tpl:flex tpl:-translate-y-1/2 tpl:gap-0.5 tpl:rounded-[var(--tpl-radius-sm)] tpl:p-1 tpl:bg-[var(--tpl-chrome-bg-elevated)] tpl:shadow-[var(--tpl-shadow-md)] tpl:border tpl:border-[var(--tpl-border)]"
    >
      <button
        ref="dragButtonRef"
        class="tpl-block-btn tpl-block-action-btn tpl:flex tpl:size-7 tpl:cursor-grab tpl:items-center tpl:justify-center tpl:rounded-sm tpl:border-none tpl:transition-colors tpl:active:cursor-grabbing"
        :aria-label="dragAriaLabel"
        :aria-pressed="isLifted"
        aria-keyshortcuts="Space Enter ArrowUp ArrowDown Escape"
        :title="t.blockActions.drag"
        @keydown="handleDragKeydown"
      >
        <GripVertical :size="14" :stroke-width="1.5" />
      </button>
      <button
        class="tpl-block-action-btn tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-sm tpl:border-none tpl:transition-colors"
        :aria-label="t.blockActions.duplicate"
        :title="t.blockActions.duplicate"
        @click.stop="handleDuplicate"
      >
        <Copy :size="14" :stroke-width="1.5" />
      </button>
      <button
        v-if="canSaveAsBlock"
        class="tpl-block-action-btn tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-sm tpl:border-none tpl:transition-colors"
        :aria-label="t.blockActions.saveAsBlock"
        :title="t.blockActions.saveAsBlock"
        @click.stop="handleSaveAsBlock"
      >
        <Bookmark :size="14" :stroke-width="1.5" />
      </button>
      <button
        class="tpl-block-action-btn tpl-block-delete-btn tpl:flex tpl:size-7 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-sm tpl:border-none tpl:transition-colors"
        :aria-label="t.blockActions.delete"
        :title="t.blockActions.delete"
        @click.stop="handleDelete"
      >
        <Trash2 :size="14" :stroke-width="1.5" />
      </button>
    </div>
    <div
      v-if="isHiddenOnViewport"
      class="tpl-block-hidden-overlay tpl:pointer-events-none tpl:absolute tpl:inset-0 tpl:z-[5] tpl:flex tpl:items-center tpl:justify-center tpl:rounded-sm"
    >
      <span
        class="tpl:flex tpl:items-center tpl:gap-1 tpl:rounded tpl:px-2 tpl:py-1 tpl:text-[10px] tpl:font-medium tpl:bg-[var(--tpl-chrome-bg-elevated)] tpl:text-[var(--tpl-chrome-text-muted)] tpl:shadow-[var(--tpl-shadow-sm)]"
      >
        <EyeOff :size="12" :stroke-width="1.5" />
        {{
          format(t.blockActions.hiddenOnViewport, {
            viewport: hiddenLabel,
          })
        }}
      </span>
    </div>
    <div
      v-if="hasDisplayCondition && !isHiddenOnViewport"
      class="tpl:absolute tpl:-left-1 tpl:top-1/2 tpl:z-[5] tpl:-translate-x-full tpl:-translate-y-1/2"
    >
      <button
        data-testid="condition-toggle"
        class="tpl-condition-toggle tpl:flex tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:p-1 tpl:transition-colors tpl:bg-[var(--tpl-chrome-bg-elevated)] tpl:text-[var(--tpl-primary)] tpl:border tpl:border-[var(--tpl-border)]"
        :aria-label="t.blockActions.conditionToggle"
        :title="block.displayCondition?.label"
        @click.stop="handleConditionToggle"
      >
        <Filter :size="12" :stroke-width="2" />
      </button>
    </div>
    <!-- Email content — the section's wrapper frame when it has one, then
         the block's box. Both are email surfaces: the canvas dark-mode
         preview filters the outermost one. Block chrome (action bar,
         indicators, overlays) is a sibling, so the filter never reaches it —
         no counter-filter needed and no toggle flicker. -->
    <div
      v-if="sectionWrapperStyle"
      class="tpl-section-wrapper tpl-email-surface"
      :style="sectionWrapperStyle"
      :class="backgroundImageHostClass(sectionWrapperStyle)"
    >
      <div
        class="tpl-block-content tpl-email-surface"
        :style="contentStyle"
        :class="backgroundImageHostClass(contentStyle)"
      >
        <slot />
      </div>
    </div>
    <div
      v-else
      class="tpl-block-content tpl-email-surface"
      :style="contentStyle"
      :class="backgroundImageHostClass(contentStyle)"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* Idle — subtle dashed outline so block boundaries are always visible */
.tpl-block--idle {
  outline: 1.5px dashed color-mix(in srgb, var(--tpl-primary) 30%, transparent);
  outline-offset: -1px;
  transition:
    outline 150ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Hover — solid outline, more prominent */
.tpl-block--idle:hover {
  outline: 1.5px solid color-mix(in srgb, var(--tpl-primary) 50%, transparent);
  outline-offset: -1px;
  box-shadow: 0 0 8px color-mix(in srgb, var(--tpl-primary) 8%, transparent);
}

/* Picked (saved-blocks pick session) — a solid outline plus a crisp outer ring.
   Deliberately NOT a background fill: the block's own background is painted on
   the inner `.tpl-block-content` (`backgroundColor || "transparent"`), so a tint
   on `.tpl-block` is covered by any block that sets one and shows through only
   on transparent ones — the picked state would appear on some blocks and not
   others in the same template. `outline` and a non-inset `box-shadow` draw on
   this element's border box, outside the content's paint area, so they read
   identically regardless of what the block itself is filled with.

   The differentiator from idle is line style and weight (dashed 1.5px @30% →
   solid 2px @100%) plus the ring — not hue alone — so the state survives without
   colour perception, and the pick bar's live count is the numeric confirmation.
   Distinct from `--selected`'s soft blurred glow; the two never co-occur anyway,
   since Canvas suppresses selection styling while a session runs. */
.tpl-block--picked {
  outline: 2px solid var(--tpl-primary);
  outline-offset: -1px;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--tpl-primary) 18%, transparent);
  transition:
    outline 150ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Selection — solid outline + soft outer glow */
.tpl-block--selected {
  outline: 2px solid color-mix(in srgb, var(--tpl-primary) 60%, transparent);
  outline-offset: -1px;
  box-shadow: 0 0 12px color-mix(in srgb, var(--tpl-primary) 15%, transparent);
  transition:
    outline 150ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 150ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Action buttons — muted text, warm hover, press feedback */
.tpl-block-action-btn {
  color: var(--tpl-chrome-text-muted);
  background-color: transparent;
}

.tpl-block-action-btn:hover {
  background-color: var(--tpl-bg-hover);
  color: var(--tpl-chrome-text);
}

.tpl-block-action-btn:active {
  transform: scale(0.9);
}

.tpl-block-delete-btn:hover {
  background-color: var(--tpl-danger-light);
  color: var(--tpl-danger);
}

/* Condition toggle — interactive hover + press */
.tpl-condition-toggle:hover {
  background-color: var(--tpl-bg-hover) !important;
}

.tpl-condition-toggle:active {
  transform: scale(0.9);
}

/* Hidden block overlay — dims the block when hidden on current viewport */
.tpl-block-hidden-overlay {
  background-color: color-mix(in srgb, var(--tpl-bg) 60%, transparent);
}

/* An AI agent's change: Compositor Teal, the information colour, since amber
   means selection and intent. It fades over the highlight's 2 s; reduced
   motion holds it still for that time. */
.tpl-block-agent-highlight {
  outline: 2px solid var(--tpl-secondary);
  outline-offset: -1px;
  animation: tpl-agent-highlight 2000ms ease-out forwards;
}

@keyframes tpl-agent-highlight {
  0%,
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tpl-block-agent-highlight {
    animation: none;
  }
}
</style>
