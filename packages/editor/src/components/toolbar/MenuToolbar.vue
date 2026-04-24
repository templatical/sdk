<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import MergeTagInput from "../MergeTagInput.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import FieldRow from "./FieldRow.vue";
import NumberWithSuffix from "./NumberWithSuffix.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  labelClass,
  removeItemBtnClass,
  addItemBtnClass,
} from "../../constants/styleConstants";
import type { MenuBlock, MenuItemData } from "@templatical/types";
import { generateId } from "@templatical/types";
import { AlignCenter, AlignLeft, AlignRight, Plus, X } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  block: MenuBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<MenuBlock>): void;
}>();

const { t } = useI18n();

const ITEM_TOGGLES = computed(() => [
  { key: "openInNewTab" as const, label: t.menu.openInNewTab },
  { key: "bold" as const, label: t.menu.bold },
  { key: "underline" as const, label: t.menu.underline },
]);

const ALIGN_OPTIONS = computed(() => [
  { value: "left", label: t.title.alignLeft, icon: AlignLeft },
  { value: "center", label: t.title.alignCenter, icon: AlignCenter },
  { value: "right", label: t.title.alignRight, icon: AlignRight },
]);

function updateField(field: keyof MenuBlock, value: unknown): void {
  emit("update", { [field]: value } as Partial<MenuBlock>);
}

function addMenuItem(): void {
  const newItem: MenuItemData = {
    id: generateId(),
    text: "",
    url: "",
    openInNewTab: false,
    bold: false,
    underline: false,
  };
  emit("update", { items: [...props.block.items, newItem] });
}

function updateMenuItem(
  itemId: string,
  field: keyof MenuItemData,
  value: unknown,
): void {
  const updatedItems = props.block.items.map((item) =>
    item.id === itemId ? { ...item, [field]: value } : item,
  );
  emit("update", { items: updatedItems });
}

function removeMenuItem(itemId: string): void {
  emit("update", {
    items: props.block.items.filter((item) => item.id !== itemId),
  });
}
</script>

<template>
  <FieldRow :label="t.menu.items">
    <div class="tpl:flex tpl:flex-col tpl:gap-2">
      <div
        v-for="item in block.items"
        :key="item.id"
        class="tpl:flex tpl:flex-col tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:p-2"
      >
        <div class="tpl:flex tpl:items-center tpl:gap-2">
          <input
            type="text"
            :class="inputClass"
            class="tpl:flex-1"
            :value="item.text"
            :placeholder="t.menu.text"
            @input="
              updateMenuItem(
                item.id,
                'text',
                ($event.target as HTMLInputElement).value,
              )
            "
          />
          <button
            :class="removeItemBtnClass"
            :title="t.menu.removeItem"
            @click="removeMenuItem(item.id)"
          >
            <X :size="14" :stroke-width="2" />
          </button>
        </div>
        <MergeTagInput
          :model-value="item.url"
          type="url"
          :placeholder="t.menu.urlPlaceholder"
          @update:model-value="updateMenuItem(item.id, 'url', $event)"
        />
        <div
          class="tpl:flex tpl:items-center tpl:gap-3 tpl:text-xs tpl:text-[var(--tpl-text-muted)]"
        >
          <label
            v-for="toggle in ITEM_TOGGLES"
            :key="toggle.key"
            class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1"
          >
            <input
              type="checkbox"
              :checked="item[toggle.key]"
              class="tpl:accent-[var(--tpl-primary)]"
              @change="
                updateMenuItem(
                  item.id,
                  toggle.key,
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            {{ toggle.label }}
          </label>
        </div>
        <div class="tpl:flex tpl:items-center tpl:gap-2">
          <label :class="labelClass" class="tpl:!mb-0">{{ t.menu.color }}</label>
          <ColorPicker
            swatch-only
            :model-value="item.color || block.linkColor || block.color"
            @update:model-value="updateMenuItem(item.id, 'color', $event)"
          />
        </div>
      </div>
      <button :class="addItemBtnClass" @click="addMenuItem">
        <Plus :size="14" :stroke-width="2" />
        {{ t.menu.addItem }}
      </button>
    </div>
  </FieldRow>

  <FieldRow :label="t.menu.fontFamily">
    <select
      :class="inputClass"
      :value="block.fontFamily || ''"
      @change="
        updateField(
          'fontFamily',
          ($event.target as HTMLSelectElement).value || undefined,
        )
      "
    >
      <option value="">{{ t.title.inheritFont }}</option>
      <option
        v-for="font in fontFamilies"
        :key="font.value"
        :value="font.value"
      >
        {{ font.label }}
      </option>
    </select>
  </FieldRow>

  <FieldRow :label="t.menu.fontSize">
    <NumberWithSuffix
      :model-value="block.fontSize"
      :min="8"
      :max="48"
      suffix="px"
      @update:model-value="updateField('fontSize', $event)"
    />
  </FieldRow>

  <FieldRow :label="t.menu.color">
    <ColorPicker
      :model-value="block.color"
      @update:model-value="updateField('color', $event)"
    />
  </FieldRow>

  <FieldRow :label="t.menu.linkColor">
    <ColorPicker
      :model-value="block.linkColor || block.color"
      @update:model-value="updateField('linkColor', $event || undefined)"
    />
  </FieldRow>

  <FieldRow :label="t.menu.textAlign">
    <SlidingPillSelect
      :options="ALIGN_OPTIONS"
      :model-value="block.textAlign"
      @update:model-value="updateField('textAlign', $event)"
    />
  </FieldRow>

  <FieldRow :label="t.menu.separator">
    <input
      type="text"
      :class="inputClass"
      :value="block.separator"
      @input="
        updateField('separator', ($event.target as HTMLInputElement).value)
      "
    />
  </FieldRow>

  <FieldRow :label="t.menu.separatorColor">
    <ColorPicker
      :model-value="block.separatorColor"
      @update:model-value="updateField('separatorColor', $event)"
    />
  </FieldRow>

  <FieldRow :label="t.menu.spacing">
    <NumberWithSuffix
      :model-value="block.spacing"
      :min="0"
      :max="50"
      suffix="px"
      @update:model-value="updateField('spacing', $event)"
    />
  </FieldRow>
</template>
