<script setup lang="ts">
import { computed } from "vue";
import {
  controlDefault,
  isControlForced,
  type Control,
  type ControlState,
} from "@/config/types";
import { resolveControlState } from "@/config/capabilities";
import { slugFor } from "@/providers/template-name";
import { templates } from "@/templates";

/**
 * Renders every control for the active capability: a label, a help
 * sentence, and an input keyed to the control's `kind`. A forced control's
 * input is disabled and shows why — the row is never hidden, since a
 * control vanishing unexplained is worse in a panel whose whole job is to
 * explain the config.
 *
 * The fixture picker sits above the controls because it frames what they
 * act on: every control below configures the editor showing that template.
 */

// The shell binds one merged object across every tab rather than a branch per
// tab, so this pane is handed the other panes' props too. Without this they
// would land on the root element as `[object Object]` attributes.
defineOptions({ inheritAttrs: false });

const props = defineProps<{
  controls: Control[];
  state: ControlState;
  /** Slug of the template the editor is showing. See `slugFor`. */
  fixture: string;
}>();

const emit = defineEmits<{
  set: [path: string, value: unknown];
  "update:fixture": [slug: string];
}>();

/**
 * The picker's options: the name to read, the slug to emit. Slug rather than
 * index or name because that is what `CapabilityDef.fixture` names and what
 * every per-template storage key is built from.
 */
const fixtureOptions = templates.map((template) => ({
  slug: slugFor(template.name),
  name: template.name,
}));

const FIXTURE_INPUT_ID = "capability-fixture-picker";

function onFixtureChange(event: Event): void {
  emit("update:fixture", (event.target as HTMLSelectElement).value);
}

// Resolved once per state change rather than once per control, so a row's
// forced check and its own displayed value read the same filled-in defaults.
const resolved = computed(() => resolveControlState(props.state));

/**
 * The value to display for a control.
 *
 * A forced control shows the value it is forced **to**, not the one in
 * storage: `build()` emits `forcedBy.to`, and the Config tab prints exactly
 * that, so displaying the stored value instead makes two panes of the same
 * drawer disagree — a checked `restore` box beside "templates.save is off,
 * so restore has nothing to write to", above `restore: false` in the source.
 * Storage is untouched, so the user's own choice still returns when the
 * forcing lifts.
 */
function valueFor(control: Control): unknown {
  if (isControlForced(control, resolved.value)) return control.forcedBy?.to;
  const value = resolved.value[control.path];
  return value === undefined ? controlDefault(control) : value;
}

function isForced(control: Control): boolean {
  return isControlForced(control, resolved.value);
}

function inputId(path: string): string {
  return `capability-control-input-${path}`;
}

function checkboxValue(control: Control): boolean {
  return valueFor(control) === true;
}

function numberValue(control: Control): number {
  const value = valueFor(control);
  // Seeded control state arrives from localStorage, so a number control can
  // hold the string "1500". `build()` runs it through `Number()`; coercing
  // here too keeps the field showing what the editor is actually using.
  const coerced = typeof value === "string" ? Number(value) : value;
  return typeof coerced === "number" && Number.isFinite(coerced) ? coerced : 0;
}

function textValue(control: Control): string {
  const value = valueFor(control);
  return typeof value === "string" ? value : "";
}

function listValue(control: Control): string {
  const value = valueFor(control);
  return Array.isArray(value) ? value.join(", ") : "";
}

/** Narrowed inside the function body — a discriminated-union guard in a
 * template `v-else-if` isn't a place to hang a property access on. */
function enumOptions(control: Control): string[] {
  return control.kind === "enum" ? control.options : [];
}

function numberMin(control: Control): number {
  return control.kind === "number" ? control.min : 0;
}

function numberMax(control: Control): number {
  return control.kind === "number" ? control.max : 0;
}

/**
 * Fails `vue-tsc` the moment `Control` gains a sixth kind, so the template's
 * branches have to be extended deliberately. The template's own `v-else` row
 * is the runtime half of the same guard: a kind nobody wrote an input for
 * says so on screen rather than rendering as whichever branch happens to be
 * last.
 */
const _kindsHandled: Record<Control["kind"], true> = {
  method: true,
  boolean: true,
  number: true,
  enum: true,
  list: true,
};

/** The help and reason text, bound to the input via `aria-describedby`. A
 * forced input is disabled and so unfocusable, which is exactly when its
 * explanation matters most. */
function describedBy(control: Control): string {
  const ids = [`capability-control-help-${control.path}`];
  if (isForced(control)) ids.push(`capability-control-reason-${control.path}`);
  return ids.join(" ");
}

function onCheckboxChange(control: Control, event: Event): void {
  emit("set", control.path, (event.target as HTMLInputElement).checked);
}

/**
 * Bound to `change`, never `input`: every emit re-inits the editor, so a
 * per-keystroke binding rebuilds it once per digit and discards canvas work
 * each time. Typing "1500" would cost four teardowns.
 */
function onNumberChange(control: Control, event: Event): void {
  const target = event.target as HTMLInputElement;
  // An unparseable or emptied field reads as `""`, which `Number()` turns
  // into 0 — writing a real value away and then patching the field back to
  // 0 through the `:value` binding. `badInput` covers a lone "-" or "e";
  // an emptied field is `valueMissing`, so test the string itself.
  if (target.validity?.badInput || target.value === "") return;
  emit("set", control.path, Number(target.value));
}

function onSelectChange(control: Control, event: Event): void {
  emit("set", control.path, (event.target as HTMLSelectElement).value);
}

function onListChange(control: Control, event: Event): void {
  const items = (event.target as HTMLInputElement).value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  emit("set", control.path, items);
}
</script>

<template>
  <div class="flex flex-col p-3">
    <div
      class="flex items-center justify-between gap-4 border-b border-gray-200 pb-3 dark:border-gray-700"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <label
          :for="FIXTURE_INPUT_ID"
          class="text-[13px] font-medium text-gray-900 dark:text-gray-100"
        >
          Template
        </label>
        <p class="m-0 text-[12px] text-gray-500 dark:text-gray-400">
          The content the editor opens with. Each capability curates its own;
          picking another here lasts until you leave this capability.
        </p>
      </div>

      <div class="flex w-36 shrink-0 justify-end">
        <select
          :id="FIXTURE_INPUT_ID"
          data-testid="capability-fixture-picker"
          class="pg-select"
          :value="fixture"
          @change="onFixtureChange"
        >
          <option
            v-for="option in fixtureOptions"
            :key="option.slug"
            :value="option.slug"
          >
            {{ option.name }}
          </option>
        </select>
      </div>
    </div>

    <div
      v-for="control in controls"
      :key="control.path"
      data-testid="capability-control"
      :data-control-path="control.path"
      class="flex items-center justify-between gap-4 border-b border-gray-100 py-3 last:border-b-0 dark:border-gray-700"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <label
          :for="inputId(control.path)"
          class="text-[13px] font-medium text-gray-900 dark:text-gray-100"
        >
          {{ control.label }}
        </label>
        <p
          :id="`capability-control-help-${control.path}`"
          class="m-0 text-[12px] text-gray-500 dark:text-gray-400"
        >
          {{ control.help }}
        </p>
        <p
          v-if="isForced(control)"
          :id="`capability-control-reason-${control.path}`"
          data-testid="capability-control-reason"
          class="m-0 text-[12px] font-medium text-amber-600 dark:text-amber-500"
        >
          {{ control.forcedBy?.reason }}
        </p>
      </div>

      <div class="flex w-36 shrink-0 justify-end">
        <input
          v-if="control.kind === 'method' || control.kind === 'boolean'"
          :id="inputId(control.path)"
          type="checkbox"
          data-testid="capability-control-input"
          class="size-4 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          :checked="checkboxValue(control)"
          :disabled="isForced(control)"
          :aria-describedby="describedBy(control)"
          @change="onCheckboxChange(control, $event)"
        />
        <select
          v-else-if="control.kind === 'enum'"
          :id="inputId(control.path)"
          data-testid="capability-control-input"
          class="pg-select"
          :value="textValue(control)"
          :disabled="isForced(control)"
          :aria-describedby="describedBy(control)"
          @change="onSelectChange(control, $event)"
        >
          <option
            v-for="option in enumOptions(control)"
            :key="option"
            :value="option"
          >
            {{ option }}
          </option>
        </select>
        <input
          v-else-if="control.kind === 'number'"
          :id="inputId(control.path)"
          type="number"
          data-testid="capability-control-input"
          class="pg-input"
          :min="numberMin(control)"
          :max="numberMax(control)"
          :value="numberValue(control)"
          :disabled="isForced(control)"
          :aria-describedby="describedBy(control)"
          @change="onNumberChange(control, $event)"
        />
        <input
          v-else-if="control.kind === 'list'"
          :id="inputId(control.path)"
          type="text"
          data-testid="capability-control-input"
          class="pg-input"
          placeholder="a, b, c"
          :value="listValue(control)"
          :disabled="isForced(control)"
          :aria-describedby="describedBy(control)"
          @change="onListChange(control, $event)"
        />
        <span
          v-else
          data-testid="capability-control-unsupported"
          class="text-[12px] text-amber-600 dark:text-amber-500"
        >
          No input for this control kind
        </span>
      </div>
    </div>
  </div>
</template>
