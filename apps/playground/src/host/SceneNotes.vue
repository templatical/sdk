<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { X } from "@lucide/vue";
import { usePlaygroundI18n } from "@/i18n";
import {
  NOTE_IDS,
  placeNotes,
  type Box,
  type NoteId,
  type NoteTargets,
  type PlacedNote,
} from "@/host/sceneNotes";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ dismiss: [] }>();

const { t } = usePlaygroundI18n();
const layer = ref<HTMLElement | null>(null);
const placed = ref<PlacedNote[]>([]);
// Which parts were found to point at, whether or not their note fit. The
// e2e suite reads it to catch an editor markup change orphaning a note.
const measured = ref<NoteId[]>([]);

/** Kept in step with `.pg-note` in style.css, which draws what this measures. */
const NOTE_FONT = "600 27px Caveat";
const NOTE_LINE_HEIGHT = 31;
const FONT_URL = "https://fonts.bunny.net/css?family=caveat:600&display=swap";
const FONT_TIMEOUT_MS = 2000;

let fontReady: Promise<void> | null = null;

/**
 * The note font loads the first time notes show, not with the page: most
 * visits never open them again.
 */
function loadNoteFont(): Promise<void> {
  fontReady ??= new Promise<void>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_URL;
    link.onload = () => {
      document.fonts.load(NOTE_FONT).then(
        () => resolve(),
        () => resolve(),
      );
    };
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  return Promise.race([
    fontReady,
    new Promise<void>((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
  ]);
}

function toBox(rect: DOMRect): Box {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function shown(el: Element | null | undefined): el is Element {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  return (
    el.checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ??
    true
  );
}

function editorRoot(): ParentNode | null {
  const container = document.querySelector('[data-testid="editor-container"]');
  return container?.shadowRoot ?? container;
}

function measureTargets(): NoteTargets {
  const targets: NoteTargets = {};
  const code = document.querySelector('[data-testid="toolbar-code"]');
  if (shown(code)) targets.code = toBox(code.getBoundingClientRect());
  const docs = document.querySelector('[data-testid="toolbar-docs"]');
  if (shown(docs)) targets.docs = toBox(docs.getBoundingClientRect());
  const share = document.querySelector('[data-testid="toolbar-share"]');
  if (shown(share)) targets.share = toBox(share.getBoundingClientRect());

  const rail = document.querySelector('[data-testid="catalog-rail"]');
  const lastGroup = rail?.lastElementChild;
  if (shown(rail) && shown(lastGroup)) {
    targets.rail = {
      rail: toBox(rail.getBoundingClientRect()),
      foot: lastGroup.getBoundingClientRect().bottom,
    };
  }

  // The editor's own parts wait while the import paste panel covers them.
  const editor = editorRoot();
  if (!editor || document.querySelector('[data-testid="import-panel"]')) {
    return targets;
  }
  const viewport = editor.querySelector('[role="radiogroup"]');
  if (shown(viewport)) {
    targets.viewport = toBox(viewport.getBoundingClientRect());
  }
  // The header's centre track is exactly viewport, dark mode, preview.
  const preview = viewport?.parentElement?.lastElementChild;
  if (shown(preview)) targets.preview = toBox(preview.getBoundingClientRect());
  const stage = editor.querySelector(".tpl-canvas-stage");
  const body = editor.querySelector(".tpl-body");
  if (shown(stage) && shown(body)) {
    targets.canvas = {
      stage: toBox(stage.getBoundingClientRect()),
      body: toBox(body.getBoundingClientRect()),
    };
  }
  const panel = editor.querySelector(".tpl-right-sidebar");
  const tabs = panel?.querySelector('[role="tablist"]');
  if (shown(panel) && shown(tabs)) {
    targets.properties = {
      panel: toBox(panel.getBoundingClientRect()),
      tabs: toBox(tabs.getBoundingClientRect()),
    };
  }
  const column = editor.querySelector(".tpl-sidebar-rail");
  const items = column?.querySelectorAll("[data-palette-type]");
  const last = items?.[items.length - 1];
  if (shown(column) && shown(last)) {
    targets.palette = {
      column: toBox(column.getBoundingClientRect()),
      last: toBox(last.getBoundingClientRect()),
    };
  }
  return targets;
}

const ICONS = "svg, img, input, select, textarea, canvas, iframe, video";

/** Every visible run of text and every icon or control on the page. */
function measureObstacles(): Box[] {
  const boxes: Box[] = [];
  const range = document.createRange();
  const roots: Node[] = [document.body];
  const editor = editorRoot();
  if (editor instanceof ShadowRoot) roots.push(editor);
  for (const root of roots) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) =>
          node === layer.value
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      },
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node instanceof Element) {
        if (node.matches(ICONS) && shown(node)) {
          boxes.push(toBox(node.getBoundingClientRect()));
        }
        continue;
      }
      if (!node.textContent?.trim() || !shown(node.parentElement)) continue;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) boxes.push(toBox(rect));
    }
  }
  return boxes;
}

const measureContext = document.createElement("canvas").getContext("2d");

function measureNote(id: NoteId): { width: number; height: number } {
  const text = t.value.host.notes.items[id];
  if (!measureContext) {
    return { width: text.length * 12, height: NOTE_LINE_HEIGHT };
  }
  measureContext.font = NOTE_FONT;
  return {
    width: Math.ceil(measureContext.measureText(text).width),
    height: NOTE_LINE_HEIGHT,
  };
}

/** Where the close pill sits (bottom centre), kept clear of notes. */
function closePillArea(): Box {
  return {
    left: window.innerWidth / 2 - 100,
    top: window.innerHeight - 70,
    width: 200,
    height: 70,
  };
}

function place(): void {
  const targets = measureTargets();
  measured.value = NOTE_IDS.filter((id) => targets[id] !== undefined);
  placed.value = placeNotes(targets, {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    obstacles: [...measureObstacles(), closePillArea()],
    measure: measureNote,
  });
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

/**
 * The first interaction anywhere puts the notes away, and still does its
 * job: nothing here stops or prevents it. The header's notes button is left
 * to its own click, which toggles them.
 */
function onInteract(event: Event): void {
  if (event instanceof KeyboardEvent && MODIFIER_KEYS.has(event.key)) return;
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest('[data-testid="toolbar-notes"]')
  ) {
    return;
  }
  emit("dismiss");
}

let frame = 0;
function onResize(): void {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(place);
}

const LISTENERS = ["pointerdown", "keydown", "wheel"] as const;

function listen(on: boolean): void {
  for (const type of LISTENERS) {
    if (on) window.addEventListener(type, onInteract, { capture: true });
    else window.removeEventListener(type, onInteract, { capture: true });
  }
  if (on) window.addEventListener("resize", onResize);
  else window.removeEventListener("resize", onResize);
}

let generation = 0;

watch(
  () => props.open,
  async (open) => {
    const current = ++generation;
    listen(false);
    // Closing keeps the last layout, so the notes fade out where they were.
    if (!open) return;
    placed.value = [];
    await loadNoteFont();
    await nextTick();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (current !== generation || !props.open) return;
    place();
    listen(true);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  generation += 1;
  cancelAnimationFrame(frame);
  listen(false);
});

function shaft(note: PlacedNote): string {
  const { from, control, to } = note.arrow;
  return `M${from.x},${from.y} Q${control.x},${control.y} ${to.x},${to.y}`;
}

function head(note: PlacedNote): string {
  const [a, b] = note.arrow.head;
  const { to } = note.arrow;
  return `M${a.x},${a.y} L${to.x},${to.y} L${b.x},${b.y}`;
}
</script>

<template>
  <Transition name="pg-notes">
    <aside
      v-if="open && placed.length"
      ref="layer"
      data-testid="scene-notes"
      :data-targets="measured.join(' ')"
      :aria-label="t.host.notes.label"
      class="pg-notes"
    >
      <svg class="pg-notes-ink" aria-hidden="true">
        <g
          v-for="(note, i) in placed"
          :key="note.id"
          :data-note-arrow="note.id"
          :style="{ '--pg-note-i': i }"
        >
          <path :d="shaft(note)" pathLength="1" class="pg-note-halo" />
          <path
            :d="head(note)"
            pathLength="1"
            class="pg-note-halo pg-note-head"
          />
          <path :d="shaft(note)" pathLength="1" class="pg-note-stroke" />
          <path
            :d="head(note)"
            pathLength="1"
            class="pg-note-stroke pg-note-head"
          />
        </g>
      </svg>
      <ul class="m-0 list-none p-0">
        <li
          v-for="(note, i) in placed"
          :key="note.id"
          :data-note="note.id"
          class="pg-note"
          :style="{
            left: `${note.box.left}px`,
            top: `${note.box.top}px`,
            '--pg-note-i': i,
          }"
        >
          <span class="sr-only">{{ t.host.notes.targets[note.id] }}: </span
          >{{ t.host.notes.items[note.id] }}
        </li>
      </ul>
      <button
        type="button"
        data-testid="scene-notes-close"
        class="pg-notes-close"
        @click="emit('dismiss')"
      >
        <X :size="14" :stroke-width="2" aria-hidden="true" />
        {{ t.host.notes.hide }}
      </button>
    </aside>
  </Transition>
</template>
