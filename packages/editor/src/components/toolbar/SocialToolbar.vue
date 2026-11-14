<script setup lang="ts">
import FieldRow from "./FieldRow.vue";
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
import { socialPlatformOptions } from "../../constants/socialIcons";
import SocialCustomIconFields from "./SocialCustomIconFields.vue";
import type {
  CustomSocialIcon,
  SocialIcon,
  SocialIconTone,
  SocialIconsBlock,
  SocialIconStyle,
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

function replaceSocialIcon(next: SocialIcon): void {
  emit("update", {
    icons: props.block.icons.map((icon) => (icon.id === next.id ? next : icon)),
  });
}

/**
 * Only `url` is shared by both icon shapes. `imageUrl` and `alt` belong to
 * a custom icon, so they travel as a whole `CustomSocialIcon` from
 * {@link replaceSocialIcon} and cannot land on a built-in icon.
 */
function updateSocialIcon(iconId: string, field: "url", value: string): void {
  emit("update", {
    icons: props.block.icons.map((icon) =>
      icon.id === iconId ? { ...icon, [field]: value } : icon,
    ),
  });
}

function isCustomIcon(icon: SocialIcon): icon is CustomSocialIcon {
  return icon.platform === "custom";
}

function setSocialIconPlatform(
  icon: SocialIcon,
  platform: SocialPlatform,
): void {
  if (platform === icon.platform) return;
  // A fresh object: a custom icon is id, platform, url and imageUrl, and a
  // built-in icon is only id, platform and url.
  const next: SocialIcon =
    platform === "custom"
      ? {
          id: icon.id,
          platform: "custom",
          url: icon.url,
          imageUrl: "",
        }
      : {
          id: icon.id,
          platform,
          url: icon.url,
        };
  replaceSocialIcon(next);
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
          <FieldRow
            :path="
              icon.id.includes('.') ? undefined : `icons.${icon.id}.platform`
            "
            :label="t.social.icons"
            ><select
              data-testid="social-platform-select"
              :class="inputClass"
              class="tpl:flex-1"
              :value="icon.platform"
              @change="
                setSocialIconPlatform(
                  icon,
                  ($event.target as HTMLSelectElement).value as SocialPlatform,
                )
              "
            >
              <option
                v-for="platform in socialPlatformOptions"
                :key="platform"
                :value="platform"
              >
                {{ t.social.platforms[platform] }}
              </option>
              <option value="custom">{{ t.social.platforms.custom }}</option>
            </select></FieldRow
          >
          <button
            :class="removeItemBtnClass"
            :title="t.social.removeIcon"
            @click="removeSocialIcon(icon.id)"
          >
            <X :size="14" :stroke-width="2" />
          </button>
        </div>
        <SocialCustomIconFields
          v-if="isCustomIcon(icon)"
          :icon="icon"
          @update="replaceSocialIcon"
        />
        <FieldRow
          :path="icon.id.includes('.') ? undefined : `icons.${icon.id}.url`"
          :label="t.button.url"
          ><MergeTagInput
            :model-value="icon.url"
            type="url"
            :placeholder="t.social.urlPlaceholder"
            @update:model-value="updateSocialIcon(icon.id, 'url', $event)"
        /></FieldRow>
        <p
          v-if="isCustomIcon(icon)"
          class="tpl:mt-1.5 tpl:text-xs tpl:text-[var(--tpl-text-dim)]"
        >
          {{ t.social.customIconHint }}
        </p>
      </div>
      <button :class="addItemBtnClass" @click="addSocialIcon">
        <Plus :size="14" :stroke-width="2" />
        {{ t.social.addIcon }}
      </button>
    </div>
  </div>
  <FieldRow :label="t.social.style" class="tpl:mb-3.5" path="iconStyle">
    <select
      :class="inputClass"
      :value="block.iconStyle"
      @change="
        updateField(
          'iconStyle',
          ($event.target as HTMLSelectElement).value as SocialIconStyle,
        )
      "
    >
      <option value="solid">{{ t.social.styleSolid }}</option>
      <option value="outlined">{{ t.social.styleOutlined }}</option>
      <option value="rounded">{{ t.social.styleRounded }}</option>
      <option value="square">{{ t.social.styleSquare }}</option>
      <option value="circle">{{ t.social.styleCircle }}</option>
      <option value="plain">{{ t.social.stylePlain }}</option>
    </select>
  </FieldRow>
  <FieldRow :label="t.social.color" class="tpl:mb-3.5" path="iconTone">
    <select
      data-testid="social-tone-select"
      :class="inputClass"
      :value="block.iconTone ?? 'brand'"
      @change="
        updateField(
          'iconTone',
          ($event.target as HTMLSelectElement).value as SocialIconTone,
        )
      "
    >
      <option value="brand">{{ t.social.colorBrand }}</option>
      <option value="dark">{{ t.social.colorDark }}</option>
      <option value="light">{{ t.social.colorLight }}</option>
    </select>
  </FieldRow>
  <FieldRow :label="t.social.size" class="tpl:mb-3.5" path="iconSize">
    <SlidingPillSelect
      :options="[
        { value: 'small', label: t.social.sizeSmall },
        { value: 'medium', label: t.social.sizeMedium },
        { value: 'large', label: t.social.sizeLarge },
      ]"
      :model-value="block.iconSize"
      @update:model-value="updateField('iconSize', $event)"
    />
  </FieldRow>
  <FieldRow :label="t.social.spacing" class="tpl:mb-3.5" path="spacing">
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
  </FieldRow>
  <FieldRow :label="t.social.align" class="tpl:mb-3.5" path="align">
    <SlidingPillSelect
      :options="[
        { value: 'left', label: t.title.alignLeft, icon: AlignLeft },
        { value: 'center', label: t.title.alignCenter, icon: AlignCenter },
        { value: 'right', label: t.title.alignRight, icon: AlignRight },
      ]"
      :model-value="block.align"
      @update:model-value="updateField('align', $event)"
    />
  </FieldRow>
</template>
