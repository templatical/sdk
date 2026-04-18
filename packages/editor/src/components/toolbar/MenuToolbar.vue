<script setup lang="ts">
import ColorPicker from "../ColorPicker.vue";
import MergeTagInput from "../MergeTagInput.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
} from "../../constants/styleConstants";
import type { MenuBlock, MenuItemData } from "@templatical/types";
import { generateId } from "@templatical/types";
import { AlignCenter, AlignLeft, AlignRight, Plus, X } from "@lucide/vue";

const props = defineProps<{
  block: MenuBlock;
  fontFamilies: Array<{ value: string; label: string }>;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<MenuBlock>): void;
}>();

const { t } = useI18n();

function updateField(field: string, value: unknown): void {
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
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.menu.items }}</label>
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
            class="tpl:flex tpl:size-8 tpl:shrink-0 tpl:cursor-pointer tpl:items-center tpl:justify-center tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-danger)] tpl:hover:bg-[var(--tpl-danger-light)] tpl:hover:text-[var(--tpl-danger)]"
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
          <label class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1"
            ><input
              type="checkbox"
              :checked="item.openInNewTab"
              class="tpl:accent-[var(--tpl-primary)]"
              @change="
                updateMenuItem(
                  item.id,
                  'openInNewTab',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            {{ t.menu.openInNewTab }}</label
          >
          <label class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1"
            ><input
              type="checkbox"
              :checked="item.bold"
              class="tpl:accent-[var(--tpl-primary)]"
              @change="
                updateMenuItem(
                  item.id,
                  'bold',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            {{ t.menu.bold }}</label
          >
          <label class="tpl:flex tpl:cursor-pointer tpl:items-center tpl:gap-1"
            ><input
              type="checkbox"
              :checked="item.underline"
              class="tpl:accent-[var(--tpl-primary)]"
              @change="
                updateMenuItem(
                  item.id,
                  'underline',
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            {{ t.menu.underline }}</label
          >
        </div>
        <div class="tpl:flex tpl:items-center tpl:gap-2">
          <label class="tpl:text-xs tpl:text-[var(--tpl-text-muted)]">{{
            t.menu.color
          }}</label>
          <ColorPicker
            swatch-only
            :model-value="item.color || block.linkColor || block.color"
            @update:model-value="updateMenuItem(item.id, 'color', $event)"
          />
        </div>
      </div>
      <button
        class="tpl:flex tpl:w-full tpl:items-center tpl:justify-center tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-dashed tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg)] tpl:px-3 tpl:py-2 tpl:text-xs tpl:font-medium tpl:text-[var(--tpl-text-muted)] tpl:transition-all tpl:duration-150 tpl:hover:border-[var(--tpl-primary)] tpl:hover:text-[var(--tpl-primary)]"
        @click="addMenuItem"
      >
        <Plus :size="14" :stroke-width="2" />
        {{ t.menu.addItem }}
      </button>
    </div>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.menu.fontFamily }}</label>
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
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.menu.fontSize }}</label>
    <div class="tpl:flex tpl:items-stretch">
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="block.fontSize"
        min="8"
        max="48"
        @input="
          updateField(
            'fontSize',
            Number(($event.target as HTMLInputElement).value),
          )
        "
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.menu.color }}</label>
    <ColorPicker
      :model-value="block.color"
      @update:model-value="updateField('color', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.menu.linkColor }}</label>
    <ColorPicker
      :model-value="block.linkColor || block.color"
      @update:model-value="updateField('linkColor', $event || undefined)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.menu.textAlign }}</label>
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft, icon: AlignLeft },
        { value: 'center', label: t.title.alignCenter, icon: AlignCenter },
        { value: 'right', label: t.title.alignRight, icon: AlignRight },
      ]"
      :model-value="block.textAlign"
      @update:model-value="updateField('textAlign', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.menu.separator }}</label>
    <input
      type="text"
      :class="inputClass"
      :value="block.separator"
      @input="
        updateField('separator', ($event.target as HTMLInputElement).value)
      "
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.menu.separatorColor }}</label>
    <ColorPicker
      :model-value="block.separatorColor"
      @update:model-value="updateField('separatorColor', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.menu.spacing }}</label>
    <div class="tpl:flex tpl:items-stretch">
      <input
        type="number"
        :class="inputGroupInputClass"
        :value="block.spacing"
        min="0"
        max="50"
        @input="
          updateField(
            'spacing',
            Number(($event.target as HTMLInputElement).value),
          )
        "
      />
      <span :class="inputSuffixClass">px</span>
    </div>
  </div>
</template>
