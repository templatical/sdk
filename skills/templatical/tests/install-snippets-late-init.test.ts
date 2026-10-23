import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFunction } from "node:vm";
import ts from "typescript";

// The installation page's Vue, Svelte and Angular tabs, run rather than read.
// integrate.md sends agents there for every stack but React, and they copy the
// tab verbatim. init() is async: a component that unmounts while it is pending
// still gets an editor once it resolves, mounted into the removed container,
// and only the snippet can unmount it. Each tab's script is transpiled and run
// against stand-ins for its framework's lifecycle and an init() whose promise
// the test settles, before and after the component unmounts.

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

const PAGES = [
  "apps/docs/getting-started/installation.md",
  "apps/docs/de/getting-started/installation.md",
];

function extract(src: string, pattern: RegExp, what: string): string {
  const found = src.match(pattern)?.[1];
  if (found === undefined) throw new Error(`no ${what} found`);
  return found;
}

/**
 * Transpiles a tab's TypeScript to CommonJS and runs it with `modules` as its
 * imports. `epilogue` runs in the module's scope, after its body.
 */
function run(
  source: string,
  modules: Record<string, unknown>,
  epilogue = "",
): Record<string, any> {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      // How Angular compiles a component's decorators and fields.
      experimentalDecorators: true,
      useDefineForClassFields: false,
    },
  });
  const module = { exports: {} as Record<string, any> };
  const require = (id: string) => {
    if (id in modules) return modules[id];
    if (id.endsWith(".css")) return {};
    throw new Error(
      `the snippet imports ${id}, which this test has no stand-in for`,
    );
  };
  compileFunction(`${outputText}\n${epilogue}`, [
    "require",
    "module",
    "exports",
  ])(require, module, module.exports);
  return module.exports;
}

type Init = (config: { container: unknown }) => Promise<unknown>;

interface Mounted {
  /** The element the framework bound to the snippet's container. */
  el: object;
  /** Settles once the mount hook's async work has finished. */
  settled: Promise<unknown>;
  /** Runs the framework's teardown hooks. */
  unmount(): void;
}

/** `<script setup>`: template refs are bound before `onMounted` hooks run. */
function mountVue(tab: string, init: Init): Mounted {
  const script = extract(
    tab,
    /<script setup lang="ts">\n([\s\S]*?)<\/script>/,
    "<script setup>",
  );
  const refName = extract(
    tab,
    /<template>[\s\S]*?\bref="(\w+)"/,
    "template ref",
  );
  const mounted: Array<() => unknown> = [];
  const unmounted: Array<() => unknown> = [];
  const vue = {
    ref: (value?: unknown) => ({ value }),
    onMounted: (hook: () => unknown) => mounted.push(hook),
    onUnmounted: (hook: () => unknown) => unmounted.push(hook),
  };
  const scope = run(
    script,
    { vue, "@templatical/editor": { init } },
    `module.exports.bindRef = (el) => { ${refName}.value = el; };`,
  );
  const el = {};
  scope.bindRef(el);
  return {
    el,
    settled: Promise.all(mounted.map((hook) => hook())),
    unmount: () => unmounted.forEach((hook) => hook()),
  };
}

/** Svelte: `bind:this` is set before `onMount` runs; a function onMount returns runs on destroy. */
function mountSvelte(tab: string, init: Init): Mounted {
  const script = extract(
    tab,
    /<script lang="ts">\n([\s\S]*?)<\/script>/,
    "<script>",
  );
  const bound = extract(
    tab,
    /<\/script>[\s\S]*?bind:this=\{(\w+)\}/,
    "bind:this",
  );
  const onMount: Array<() => unknown> = [];
  const onDestroy: Array<() => unknown> = [];
  const svelte = {
    onMount: (fn: () => unknown) => onMount.push(fn),
    onDestroy: (fn: () => unknown) => onDestroy.push(fn),
  };
  const scope = run(
    script,
    { svelte, "@templatical/editor": { init } },
    `module.exports.bindThis = (el) => { ${bound} = el; };`,
  );
  const el = {};
  scope.bindThis(el);
  const results = onMount.map((fn) => fn());
  const cleanups = results.filter(
    (r): r is () => unknown => typeof r === "function",
  );
  return {
    el,
    settled: Promise.all(results.filter((r) => r instanceof Promise)),
    unmount: () => [...cleanups, ...onDestroy].forEach((fn) => fn()),
  };
}

/** Angular: a `static: true` view query resolves before `ngOnInit`. */
function mountAngular(tab: string, init: Init): Mounted {
  const queries: string[] = [];
  const core = {
    Component: () => (component: unknown) => component,
    ViewChild: () => (_prototype: unknown, key: string) => {
      queries.push(key);
    },
  };
  const exported = Object.values(
    run(tab, { "@angular/core": core, "@templatical/editor": { init } }),
  ).filter((value) => typeof value === "function");
  expect(exported).toHaveLength(1);
  const component = new exported[0]();
  const el = {};
  for (const key of queries) component[key] = { nativeElement: el };
  return {
    el,
    settled: component.ngOnInit(),
    unmount: () => component.ngOnDestroy(),
  };
}

const FRAMEWORKS = [
  { name: "Vue", fence: /```vue \[Vue\]\n([\s\S]*?)```/, mount: mountVue },
  {
    name: "Svelte",
    fence: /```svelte \[Svelte\]\n([\s\S]*?)```/,
    mount: mountSvelte,
  },
  {
    name: "Angular",
    fence: /```ts \[Angular\]\n([\s\S]*?)```/,
    mount: mountAngular,
  },
];

/** An init() that stays pending until the test resolves it with `editor`. */
function pendingInit() {
  const editor = { unmount: vi.fn() };
  let settle!: () => void;
  const init = vi.fn<Init>(
    () =>
      new Promise((resolveInit) => {
        settle = () => resolveInit(editor);
      }),
  );
  return { init, editor, resolve: () => settle() };
}

describe.each(PAGES)("the framework tabs in %s", (page) => {
  describe.each(FRAMEWORKS)("$name", ({ name, fence, mount }) => {
    const tab = () => extract(read(`../../../${page}`), fence, `${name} tab`);

    it("unmounts an editor whose init() resolves after the component unmounted", async () => {
      const { init, editor, resolve: resolveInit } = pendingInit();
      const component = mount(tab(), init);
      expect(init).toHaveBeenCalledTimes(1);
      expect(init.mock.calls[0][0].container).toBe(component.el);

      component.unmount();
      resolveInit();
      await component.settled;

      expect(editor.unmount).toHaveBeenCalledTimes(1);
    });

    it("keeps the editor until the component unmounts, then unmounts it once", async () => {
      const { init, editor, resolve: resolveInit } = pendingInit();
      const component = mount(tab(), init);
      resolveInit();
      await component.settled;

      expect(editor.unmount).not.toHaveBeenCalled();

      component.unmount();

      expect(editor.unmount).toHaveBeenCalledTimes(1);
    });
  });
});
