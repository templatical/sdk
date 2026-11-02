/** The module members needed by the custom-block engine factory. */
export interface CustomBlockLiquidModule {
  Liquid: new (...args: any[]) => any;
}

/** The shared Liquid engine for custom-block templates. Pass the engine module. */
export function createCustomBlockLiquid<M extends CustomBlockLiquidModule>(
  module: M,
): InstanceType<M["Liquid"]> {
  // outputEscape covers {{ }}, echo and cycle output from liquidjs 10.30.1,
  // the peer floor. Registering an escaping tag on top escapes twice.
  return new module.Liquid({
    strictVariables: false,
    strictFilters: false,
    outputEscape: "escape",
    // File tags resolve only against this empty map, never disk or network.
    templates: {},
  }) as InstanceType<M["Liquid"]>;
}
