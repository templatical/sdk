import { onBeforeUnmount, onMounted, shallowRef, type ShallowRef } from "vue";

const pixels = (value: string) => Number.parseFloat(value) || 0;

interface HeaderFitMeasurement {
  availableWidth: number;
  leftWidth: number;
  centerWidth: number;
  rightWidth: number;
  paddingWidth: number;
  columnGap: number;
  borderWidth: number;
  /** What the save-status words add to `rightWidth`, their gap included. */
  statusLabelWidth?: number;
}

/** Internal decision shared by DOM measurement and numeric boundary tests. */
export function decideHeaderFit(measurement: HeaderFitMeasurement) {
  // Equal side tracks keep the centre anchored. A sum of the unequal side
  // widths would let the larger group overlap the centred view controls.
  const required = (rightWidth: number) =>
    measurement.centerWidth +
    2 * Math.max(measurement.leftWidth, rightWidth) +
    measurement.paddingWidth +
    2 * measurement.columnGap +
    measurement.borderWidth;
  // The save-status words appear on every edit and leave seconds after each
  // save. Counting them would toggle the whole header into its compact layout
  // and back on every edit, so they show only where there is room for them.
  const labelWidth = measurement.statusLabelWidth ?? 0;
  const fullWidth = required(measurement.rightWidth - labelWidth);
  const compact = measurement.availableWidth < fullWidth;
  return {
    compact,
    fullWidth,
    statusLabel:
      !compact &&
      measurement.availableWidth >= required(measurement.rightWidth),
  };
}

/** Keep the full header until its labels would overlap the centred controls. */
export function useHeaderFit(
  container: ShallowRef<HTMLElement | null>,
  header: ShallowRef<HTMLElement | null>,
) {
  const compact = shallowRef(false);
  const fullWidth = shallowRef(0);
  const statusLabel = shallowRef(false);
  // The full width with the save-status words included.
  let labelledWidth = 0;
  let resizeObserver: ResizeObserver | undefined;
  let mutationObserver: MutationObserver | undefined;
  let mounted = false;
  let contentDirty = true;
  let scheduledFrame: number | null = null;
  let metricProbe: HTMLSpanElement | undefined;
  let probeWidth = 0;
  let probeHeight = 0;
  let headerGroups: HTMLElement[] = [];

  function groupsOverflow() {
    return headerGroups.some((group) => {
      const track = group.getBoundingClientRect();
      // Only direct controls count: an open, absolutely positioned popover can
      // extend beyond its track without changing the header's natural width.
      return Array.from(group.children).some((control) => {
        const bounds = control.getBoundingClientRect();
        return (
          bounds.width > 0 &&
          (bounds.left < track.left - 0.5 || bounds.right > track.right + 0.5)
        );
      });
    });
  }

  function measure() {
    if (!mounted || !container.value || !header.value) return;
    const available = container.value.getBoundingClientRect().width;
    // Hidden editors have no usable geometry yet. ResizeObserver retries when
    // their container becomes visible.
    if (available <= 0) return;
    if (
      !contentDirty &&
      !compact.value &&
      available >= fullWidth.value &&
      groupsOverflow()
    )
      contentDirty = true;
    if (!contentDirty && fullWidth.value > 0) {
      compact.value = available < fullWidth.value;
      statusLabel.value = !compact.value && available >= labelledWidth;
      return;
    }

    const element = header.value;
    const copy = element.ownerDocument.createElement("div");
    for (const attribute of element.attributes) {
      if (!attribute.name.startsWith("data-")) {
        copy.setAttribute(attribute.name, attribute.value);
      }
    }
    copy.classList.remove("tpl-header");
    copy.classList.add("tpl-header-measure");
    copy.setAttribute("aria-hidden", "true");
    copy.inert = true;
    for (const child of element.childNodes) {
      if (child !== metricProbe) copy.appendChild(child.cloneNode(true));
    }
    // No second Vue tree, duplicate IDs, test targets or focusable controls.
    for (const child of copy.querySelectorAll("*")) {
      child.removeAttribute("id");
      child.removeAttribute("data-testid");
    }
    Object.assign(copy.style, {
      position: "absolute",
      inset: "0 auto auto 0",
      width: "max-content",
      height: "auto",
      visibility: "hidden",
      pointerEvents: "none",
      gridTemplateColumns: "max-content max-content max-content",
    });
    const groups = [
      ".tpl-header-left",
      ".tpl-header-center",
      ".tpl-header-right",
    ].map((selector) => copy.querySelector<HTMLElement>(selector)!);
    for (const group of groups) {
      group.style.width = "max-content";
      group.style.minWidth = "0";
    }
    // The name is the one truncatable item. Measure the full controls with its
    // 24px floor, rather than compacting merely because a long name can shrink.
    const identity = copy.querySelector<HTMLElement>(".tpl-header-identity");
    if (identity) {
      identity.style.width = "24px";
      identity.style.minWidth = "24px";
      identity.style.flexShrink = "0";
      for (const child of identity.children) {
        (child as HTMLElement).style.maxWidth = "100%";
      }
    }
    container.value.appendChild(copy);
    try {
      const style = getComputedStyle(copy);
      const widths = groups.map((group) => group.getBoundingClientRect().width);
      // The status words are measured inside the right group, so the
      // decision can take them out again.
      const statusText = copy.querySelector<HTMLElement>(".tpl-status-label");
      const statusLabelWidth = statusText
        ? statusText.getBoundingClientRect().width +
          pixels(getComputedStyle(statusText.parentElement!).columnGap)
        : 0;
      // Always compare with full geometry, even while compact: the smaller
      // compact layout must never immediately trigger a return to full mode.
      const measurement = {
        availableWidth: available,
        leftWidth: widths[0],
        centerWidth: widths[1],
        rightWidth: widths[2],
        paddingWidth:
          pixels(style.paddingLeft || style.paddingInline) +
          pixels(style.paddingRight || style.paddingInline),
        columnGap: pixels(style.columnGap),
        borderWidth:
          pixels(style.borderLeftWidth) + pixels(style.borderRightWidth),
      };
      const decision = decideHeaderFit({ ...measurement, statusLabelWidth });
      fullWidth.value = decision.fullWidth;
      compact.value = decision.compact;
      statusLabel.value = decision.statusLabel;
      labelledWidth = decideHeaderFit(measurement).fullWidth;
      contentDirty = false;
    } finally {
      copy.remove();
    }
  }

  function invalidateSize() {
    if (!mounted || scheduledFrame !== null) return;
    scheduledFrame = window.requestAnimationFrame(() => {
      scheduledFrame = null;
      measure();
    });
  }

  function invalidateContent() {
    if (!mounted) return;
    contentDirty = true;
    invalidateSize();
  }

  onMounted(() => {
    mounted = true;
    headerGroups = Array.from(header.value?.children ?? []) as HTMLElement[];
    // Establish the first compact/full state before paint. Later observer and
    // window deliveries share one frame; size changes reuse this full width.
    measure();
    if (!container.value || !header.value) return;
    // Intrinsic text size catches inherited base size, root size and already
    // loaded font changes without watching mutations on consumer-owned roots.
    metricProbe = header.value.ownerDocument.createElement("span");
    metricProbe.className = "tpl-header-metric-probe";
    metricProbe.setAttribute("aria-hidden", "true");
    metricProbe.inert = true;
    metricProbe.textContent = "MWmw0123456789";
    Object.assign(metricProbe.style, {
      position: "absolute",
      inset: "0 auto auto 0",
      width: "max-content",
      margin: "0",
      padding: "0",
      border: "0",
      font: "inherit",
      whiteSpace: "pre",
      visibility: "hidden",
      pointerEvents: "none",
    });
    header.value.appendChild(metricProbe);
    const initialProbe = metricProbe.getBoundingClientRect();
    probeWidth = initialProbe.width;
    probeHeight = initialProbe.height;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        let metricsChanged = false;
        for (const entry of entries) {
          if (entry.target !== metricProbe) continue;
          const { width, height } = entry.contentRect;
          if (width !== probeWidth || height !== probeHeight)
            metricsChanged = true;
          probeWidth = width;
          probeHeight = height;
        }
        if (metricsChanged) invalidateContent();
        else invalidateSize();
      });
      resizeObserver.observe(container.value);
      for (const group of headerGroups) resizeObserver.observe(group);
      resizeObserver.observe(metricProbe);
    }
    // Includes lazy provider controls, slots, translated labels, language
    // names/counts, save states and comment counts. It also works while the
    // changed text is hidden by the compact styling.
    mutationObserver = new MutationObserver(invalidateContent);
    mutationObserver.observe(header.value, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "title", "aria-label", "hidden"],
    });
    window.addEventListener("resize", invalidateSize);
    const fonts = header.value.ownerDocument.fonts;
    fonts?.addEventListener("loadingdone", invalidateContent);
    if (fonts?.status === "loading") void fonts.ready.then(invalidateContent);
  });

  onBeforeUnmount(() => {
    mounted = false;
    if (scheduledFrame !== null) {
      window.cancelAnimationFrame(scheduledFrame);
      scheduledFrame = null;
    }
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    metricProbe?.remove();
    metricProbe = undefined;
    headerGroups = [];
    window.removeEventListener("resize", invalidateSize);
    header.value?.ownerDocument.fonts?.removeEventListener(
      "loadingdone",
      invalidateContent,
    );
  });

  return { compact, fullWidth, statusLabel };
}
