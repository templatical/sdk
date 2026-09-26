<script setup lang="ts">
import { computed } from "vue";
import { ArrowRight } from "@lucide/vue";
import { HERO_PROOF_IDS, proofFor } from "@/host/proofs";
import { sceneHref } from "@/host/sceneHref";
import { format, usePlaygroundI18n } from "@/i18n";
import { getScene, type Scene } from "@/scenes";

const emit = defineEmits<{
  open: [event: MouseEvent, scene: Scene];
}>();

const { t } = usePlaygroundI18n();

function hrefFor(scene: Scene): string {
  return sceneHref(scene.id, window.location.search);
}

const cards = computed(() =>
  HERO_PROOF_IDS.flatMap((id, slot) => {
    const scene = getScene(id);
    const proof = proofFor(id);
    return scene && proof ? [{ scene, proof, slot }] : [];
  }),
);
</script>

<template>
  <div
    data-testid="catalog-proofs"
    class="pg-proof-table relative w-full overflow-hidden rounded-[14px] bg-table"
  >
    <ul class="m-0 list-none p-0" :aria-label="t.host.proofsLabel">
      <li
        v-for="card in cards"
        :key="card.scene.id"
        class="pg-fan-card"
        :data-slot="card.slot"
      >
        <a
          :href="hrefFor(card.scene)"
          :data-testid="`hero-proof-${card.scene.id}`"
          :aria-label="format(t.host.openProof, { name: card.scene.title })"
          class="pg-fan-link"
          @click="emit('open', $event, card.scene)"
        >
          <img
            :src="card.proof.src"
            :width="card.proof.width"
            :height="card.proof.height"
            alt=""
            decoding="async"
            fetchpriority="high"
            class="block h-auto w-full"
          />
          <span class="pg-fan-caption" aria-hidden="true">
            {{ card.scene.title }}
            <ArrowRight :size="12" :stroke-width="2" />
          </span>
        </a>
      </li>
    </ul>
  </div>
</template>
