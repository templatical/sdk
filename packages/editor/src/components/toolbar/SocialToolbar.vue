<script setup lang="ts">
import MergeTagInput from "../MergeTagInput.vue";
import SlidingPillSelect from "../SlidingPillSelect.vue";
import { useI18n } from "../../composables/useI18n";
import {
  inputClass,
  inputGroupInputClass,
  inputSuffixClass,
  labelClass,
  removeItemBtnClass,
  addItemBtnClass,
} from "../../constants/styleConstants";
import {
  socialIcons,
  socialPlatformOptions,
} from "../../constants/socialIcons";
import type {
  SocialIcon,
  SocialIconsBlock,
  SocialPlatform,
} from "@templatical/types";
import { generateId } from "@templatical/types";
import { AlignCenter, AlignLeft, AlignRight, Plus, X } from "@lucide/vue";

const props = defineProps<{
  block: SocialIconsBlock;
}>();

const emit = defineEmits<{
  (e: "update", updates: Partial<SocialIconsBlock>): void;
}>();

const { t } = useI18n();

function updateField(field: string, value: unknown): void {
  emit("update", { [field]: value } as Partial<SocialIconsBlock>);
}

function addSocialIcon(): void {
  const newIcon: SocialIcon = {
    id: generateId(),
    platform: "facebook",
    url: "",
  };
  emit("update", { icons: [...props.block.icons, newIcon] });
}

function updateSocialIcon(
  iconId: string,
  field: keyof SocialIcon,
  value: string,
): void {
  const updatedIcons = props.block.icons.map((icon) =>
    icon.id === iconId ? { ...icon, [field]: value } : icon,
  );
  emit("update", { icons: updatedIcons });
}

function removeSocialIcon(iconId: string): void {
  emit("update", {
    icons: props.block.icons.filter((icon) => icon.id !== iconId),
  });
}
</script>

<template>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.social.icons }}</label>
    <div class="tpl:flex tpl:flex-col tpl:gap-2">
      <div
        v-for="icon in block.icons"
        :key="icon.id"
        class="tpl:flex tpl:flex-col tpl:gap-1.5 tpl:rounded-md tpl:border tpl:border-[var(--tpl-border)] tpl:bg-[var(--tpl-bg-hover)] tpl:p-2"
      >
        <div class="tpl:flex tpl:items-center tpl:gap-2">
          <select
            :class="inputClass"
            class="tpl:flex-1"
            :value="icon.platform"
            @change="
              updateSocialIcon(
                icon.id,
                'platform',
                ($event.target as HTMLSelectElement).value as SocialPlatform,
              )
            "
          >
            <option
              v-for="platform in socialPlatformOptions"
              :key="platform"
              :value="platform"
            >
              {{ socialIcons[platform].name }}
            </option>
          </select>
          <button
            :class="removeItemBtnClass"
            :title="t.social.removeIcon"
            @click="removeSocialIcon(icon.id)"
          >
            <X :size="14" :stroke-width="2" />
          </button>
        </div>
        <MergeTagInput
          :model-value="icon.url"
          type="url"
          :placeholder="t.social.urlPlaceholder"
          @update:model-value="updateSocialIcon(icon.id, 'url', $event)"
        />
      </div>
      <button :class="addItemBtnClass" @click="addSocialIcon">
        <Plus :size="14" :stroke-width="2" />
        {{ t.social.addIcon }}
      </button>
    </div>
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.social.style }}</label>
    <SlidingPillSelect
      :options="[
        { value: 'solid', label: t.social.styleSolid },
        { value: 'outlined', label: t.social.styleOutlined },
        { value: 'rounded', label: t.social.styleRounded },
        { value: 'square', label: t.social.styleSquare },
        { value: 'circle', label: t.social.styleCircle },
      ]"
      :model-value="block.iconStyle"
      @update:model-value="updateField('iconStyle', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.social.size }}</label>
    <SlidingPillSelect
      :options="[
        { value: 'small', label: t.social.sizeSmall },
        { value: 'medium', label: t.social.sizeMedium },
        { value: 'large', label: t.social.sizeLarge },
      ]"
      :model-value="block.iconSize"
      @update:model-value="updateField('iconSize', $event)"
    />
  </div>
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.social.spacing }}</label>
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
  <div class="tpl:mb-3.5">
    <label :class="labelClass">{{ t.social.align }}</label>
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft, icon: AlignLeft },
        { value: 'center', label: t.title.alignCenter, icon: AlignCenter },
        { value: 'right', label: t.title.alignRight, icon: AlignRight },
      ]"
      :model-value="block.align"
      @update:model-value="updateField('align', $event)"
    />
  </div>
</template>
