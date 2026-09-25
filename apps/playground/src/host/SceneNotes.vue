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
const placed = ref<PlacedNote[]>([]);
// Which parts were found to point at, whether or not their note fit. The
// e2e suite reads it to catch an editor markup change orphaning a note.
const measured = ref<NoteId[]>([]);

const FONT_URL = "https://fonts.bunny.net/css?family=caveat:600&display=swap";
const FONT_TIMEOUT_MS = 2000;

let fontReady: Promise<void> | null = null;

/** A hidden `.pg-note` holding `text`, for reading what a note resolves to. */
function noteProbe(text: string): HTMLElement {
  const probe = document.createElement("span");
  probe.className = "pg-note";
  probe.style.cssText = "visibility: hidden; top: 0; left: 0";
  probe.textContent = text;
  document.body.appendChild(probe);
  return probe;
}

/**
 * The note font loads the first time notes show, not with the page: most
 * visits never open them again.
 */
function loadNoteFont(): Promise<void> {
  fontReady ??= new Promise<void>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_URL;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  }).then(() => {
    // Every face `.pg-note` lists, not only Caveat: when Caveat never loads
    // the notes render in the sans fallback, and sizing them while that is
    // still on its way measures a third face.
    const probe = noteProbe("");
    const style = getComputedStyle(probe);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    probe.remove();
    const text = Object.values(t.value.host.notes.items).join("");
    return document.fonts.load(font, text).then(
      () => undefined,
      () => undefined,
    );
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
  // The header's centre track is exactly viewport, dark mode, preview.
  const preview = editor.querySelector('[role="radiogroup"]')?.parentElement
    ?.lastElementChild;
  if (shown(preview)) targets.preview = toBox(preview.getBoundingClientRect());
  const panel = editor.querySelector(".tpl-right-sidebar");
  const tabs = panel?.querySelector('[role="tablist"]');
  if (shown(panel) && shown(tabs)) {
    targets.properties = {
      panel: toBox(panel.getBoundingClientRect()),
      tabs: toBox(tabs.getBoundingClientRect()),
    };
  }
  // Rendered only while the linter is on, so the note goes with it.
  const issues = panel?.querySelector("#tpl-tab-issues");
  if (shown(panel) && shown(issues)) {
    targets.issues = {
      panel: toBox(panel.getBoundingClientRect()),
      tab: toBox(issues.getBoundingClientRect()),
    };
  }
  const column = editor.querySelector(".tpl-sidebar-rail");
  if (shown(column) && column.querySelector("[data-palette-type]")) {
    targets.palette = toBox(column.getBoundingClientRect());
  }
  return targets;
}

/**
 * A note's size, read off a hidden `.pg-note` rather than computed from a
 * font string: when Caveat never loads, the note renders in the sans
 * fallback, and a canvas measuring "Caveat" falls back to serif instead,
 * which is up to a fifth narrower and lets notes overrun what they avoid.
 */
function measureNote(id: NoteId): { width: number; height: number } {
  const probe = noteProbe(t.value.host.notes.items[id]);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
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
    reserved: [closePillArea()],
    measure: measureNote,
  });
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

/**
 * The first interaction anywhere puts the notes away, and still does its
 * job: nothing here stops or prevents it.
 */
function onInteract(event: Event): void {
  if (event instanceof KeyboardEvent && MODIFIER_KEYS.has(event.key)) return;
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
