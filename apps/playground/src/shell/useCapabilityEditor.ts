import { ref, shallowRef, type Ref, type ShallowRef } from "vue";
import {
  init,
  type TemplaticalEditor,
  type TemplaticalEditorConfig,
} from "@templatical/editor";

export interface CapabilityEditor {
  host: Ref<HTMLElement | null>;
  editor: Ref<TemplaticalEditor | null>;
  lastInitConfig: ShallowRef<TemplaticalEditorConfig | null>;
  initEditor: () => Promise<void>;
  destroy: () => void;
}

/**
 * The shell's one editor: a host element, the mounted instance, and the exact
 * config it was handed.
 *
 * `buildConfig` is a callback rather than a config object because the shell
 * rebuilds it per init from control state and the current fixture; this module
 * stays ignorant of capabilities entirely.
 *
 * `afterInit` runs on the freshly mounted instance before it is published, for
 * work that needs a live editor rather than a config key — attaching a
 * template is the one case today. It is a callback for the same reason
 * `buildConfig` is: what to do with the instance is the shell's policy, and
 * putting it here would drag a provider's semantics into the lifecycle.
 */
export function useCapabilityEditor(
  buildConfig: (container: HTMLElement) => TemplaticalEditorConfig,
  afterInit?: (editor: TemplaticalEditor) => Promise<void>,
): CapabilityEditor {
  const host = ref<HTMLElement | null>(null);
  const editor = ref<TemplaticalEditor | null>(null);

  // The Config tab renders THIS object — the one the mounted editor was
  // handed, never a copy rebuilt for display. A second copy is free to drift
  // from the call site (a key added to `init()` and forgotten there), and the
  // tab's only value is that it cannot: what it shows is what booted.
  // `shallowRef` keeps it raw, so a provider's methods reach `renderConfig` as
  // themselves rather than through a reactive proxy.
  const lastInitConfig = shallowRef<TemplaticalEditorConfig | null>(null);

  let destroyed = false;

  // Requests are queued, never overlapped. The SDK's `unmount()` is keyed to
  // the container, so a second `init()` racing the first tears down whichever
  // app currently owns that node — leaving an empty container and a dead
  // handle when the calls settle out of order. They settle in order only while
  // every call awaits the same cached locale chunk; a per-call locale breaks
  // that, and the queue is what makes the guarantee independent of it.
  let queue: Promise<void> = Promise.resolve();

  // Which request is the newest. A queued call that has been superseded skips
  // its own mount rather than building an editor nobody asked for.
  let requestToken = 0;

  async function runInit(token: number): Promise<void> {
    const container = host.value;
    if (!container || destroyed || token !== requestToken) return;

    editor.value?.unmount();
    editor.value = null;

    const config = buildConfig(container);
    const instance = await init(config);

    if (destroyed || token !== requestToken) {
      instance.unmount();
      return;
    }
    editor.value = instance;
    // Written under the same guard as `editor.value`, so the Config tab can
    // never describe a config that lost the race and was never mounted.
    lastInitConfig.value = config;

    await afterInit?.(instance);
    // Re-checked after that await too: attaching a template is a round-trip
    // through the consumer's store, and a rail click landing during it would
    // otherwise leave this instance published after a newer one replaced it.
    if (destroyed || token !== requestToken) {
      instance.unmount();
      if (editor.value === instance) editor.value = null;
    }
  }

  function initEditor(): Promise<void> {
    const token = ++requestToken;
    const run = queue.then(() => runInit(token));
    // What the chain carries forward is a settled promise, never a rejected
    // one: `queue` is what every later request waits on, so a rejection left
    // in it would turn every future re-init into a silent no-op for the rest
    // of the session. The caller still sees the failure through `run`.
    queue = run.catch(() => {});
    return run;
  }

  function destroy(): void {
    destroyed = true;
    editor.value?.unmount();
    editor.value = null;
  }

  return { host, editor, lastInitConfig, initEditor, destroy };
}
