import type {
  Context,
  Emitter,
  Liquid,
  TagToken,
  TopLevelToken,
  Value,
} from "liquidjs";

/** The module members needed by the custom-block engine factory. */
export interface CustomBlockLiquidModule {
  Liquid: new (...args: any[]) => any;
  Tag: abstract new (...args: any[]) => any;
  CycleTag: new (...args: any[]) => any;
  Value: new (...args: any[]) => any;
  toValue: (value: any) => any;
}

/** The shared Liquid engine for custom-block templates. Pass the engine module. */
export function createCustomBlockLiquid<M extends CustomBlockLiquidModule>(
  module: M,
): InstanceType<M["Liquid"]> {
  const {
    CycleTag,
    Liquid: LiquidClass,
    Tag,
    Value: LiquidValue,
    toValue,
  } = module as unknown as typeof import("liquidjs");
  const engine = new LiquidClass({
    strictVariables: false,
    strictFilters: false,
    outputEscape: "escape",
    // File tags resolve only against this empty map, never disk or network.
    templates: {},
  });

  // liquidjs's outputEscape covers {{ }} but not echo or cycle tags. Reuse
  // its own escape filter; the public peer range pins these tag internals.
  const escapeFilter = new LiquidValue("'' | escape", engine).filters[0];
  class EscapingEchoTag extends Tag {
    private value?: Value;

    constructor(token: TagToken, tokens: TopLevelToken[], liquid: Liquid) {
      super(token, tokens, liquid);
      this.tokenizer.skipBlank();
      if (!this.tokenizer.end()) {
        this.value = new LiquidValue(
          this.tokenizer.readFilteredValue(),
          liquid,
        );
        if (!this.value.filters.at(-1)?.raw) {
          this.value.filters.push(escapeFilter);
        }
      }
    }

    *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
      if (this.value) {
        emitter.write(toValue(yield this.value.value(ctx, false)));
      }
    }

    *arguments() {
      if (this.value) yield this.value;
    }
  }
  class EscapingCycleTag extends CycleTag {
    *render(
      ctx: Context,
      emitter: Emitter,
    ): Generator<unknown, unknown, unknown> {
      const value = yield* super.render(ctx, emitter);
      // Stock liquidjs does not write a falsy tag return at all.
      if (!value) return value;
      return toValue(yield escapeFilter.render(value, ctx));
    }
  }
  engine.registerTag("echo", EscapingEchoTag);
  engine.registerTag("cycle", EscapingCycleTag);
  return engine as InstanceType<M["Liquid"]>;
}
