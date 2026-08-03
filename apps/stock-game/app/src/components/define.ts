export function defineElement(tag: string, ctor: CustomElementConstructor): void {
  const registry: CustomElementRegistry | undefined = (
    globalThis as { customElements?: CustomElementRegistry }
  ).customElements
  if (registry !== undefined && registry.get(tag) === undefined) {
    registry.define(tag, ctor)
  }
}
