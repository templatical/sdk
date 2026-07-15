<script lang="ts">
import { SYNTAX_PRESETS } from "@templatical/types";
import { computed, defineComponent, h, inject } from "vue";
import { MERGE_TAGS_KEY, MERGE_TAG_SYNTAX_KEY } from "../keys";
import { splitMergeTagLabelSegments } from "../utils/mergeTagLabelSegments";

/**
 * Renders a plain-string field value on the canvas with merge tags resolved to
 * their labels, marking each tag run with a dotted underline (`.tpl-merge-tag-
 * label`, in `currentColor`) so a dynamic value is distinguishable from
 * user-typed text on any background. Display-only — the raw token is unchanged
 * in the stored value and MJML output.
 *
 * A render function (not a template) is used so the text/tag runs render inline
 * with no stray whitespace between them.
 */
export default defineComponent({
  name: "MergeTagPreviewText",
  props: {
    text: { type: String, required: true },
  },
  setup(props) {
    const mergeTags = inject(MERGE_TAGS_KEY, []);
    const syntax = inject(MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.liquid);
    const segments = computed(() =>
      splitMergeTagLabelSegments(props.text, mergeTags, syntax),
    );

    return () =>
      segments.value.map((segment, index) =>
        segment.type === "tag"
          ? h(
              "span",
              { key: index, class: "tpl-merge-tag-label" },
              segment.value,
            )
          : segment.value,
      );
  },
});
</script>
