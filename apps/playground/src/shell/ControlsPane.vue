<script setup lang="ts">
import { computed } from "vue";
import {
  controlDefault,
  isControlForced,
  type Control,
  type ControlState,
} from "@/config/types";
import { resolveControlState } from "@/config/capabilities";

/**
 * Renders every control for the active capability: a label, a help
 * sentence, and an input keyed to the control's `kind`. A forced control's
 * input is disabled and shows why — the row is never hidden, since a
 * control vanishing unexplained is worse in a panel whose whole job is to
 * explain the config.
 */

const props = defineProps<{
  controls: Control[];
  state: ControlState;
}>();

const emit = defineEmits<{
  set: [path: string, value: unknown];
}>();

// Resolved once per state change rather than once per control, so a row's
// forced check and its own displayed value read the same filled-in defaults.
const resolved = computed(() => resolveControlState(props.state));

/** The control's current value, falling back to its own default when the
 * resolved state doesn't carry it — `resolveControlState` already fills
 * every registered control, but a row shouldn't have to trust that. */
function valueFor(control: Control): unknown {
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
  return typeof value === "number" ? value : 0;
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

function onCheckboxChange(control: Control, event: Event): void {
  emit("set", control.path, (event.target as HTMLInputElement).checked);
}

function onNumberInput(control: Control, event: Event): void {
  const target = event.target as HTMLInputElement;
  // A number input reports in-progress unparseable content (typing "-" to
  // start a negative number) as an empty string with `badInput` set, so
  // `Number(target.value)` would be 0 there — overwriting the real value
  // before the digit being typed ever arrives.
  if (target.validity?.badInput) return;
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
      v-for="control in controls"
      :key="control.path"
      data-testid="capability-control"
      :data-control-path="control.path"
      class="flex items-center justify-between gap-4 border-b border-gray-100 py-3 first:pt-0 last:border-b-0 dark:border-gray-700"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <label
          :for="inputId(control.path)"
          class="text-[13px] font-medium text-gray-900 dark:text-gray-100"
        >
          {{ control.label }}
        </label>
        <p class="m-0 text-[12px] text-gray-500 dark:text-gray-400">
          {{ control.help }}
        </p>
        <p
          v-if="isForced(control)"
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
          @change="onCheckboxChange(control, $event)"
        />
        <select
          v-else-if="control.kind === 'enum'"
          :id="inputId(control.path)"
          data-testid="capability-control-input"
          class="pg-select"
          :value="textValue(control)"
          :disabled="isForced(control)"
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
          @input="onNumberInput(control, $event)"
        />
        <input
          v-else
          :id="inputId(control.path)"
          type="text"
          data-testid="capability-control-input"
          class="pg-input"
          :value="listValue(control)"
          :disabled="isForced(control)"
          @change="onListChange(control, $event)"
        />
      </div>
    </div>
  </div>
</template>
