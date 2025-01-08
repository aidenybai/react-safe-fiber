import {
  type Attributes,
  type Component,
  type FunctionComponent,
  createElement,
} from 'preact';

function CONSTANT_UPDATE() {
  return false;
}

export function constant<P extends Attributes>(
  Component: FunctionComponent<P>,
) {
  function Memoed(this: Component<P>, props: P) {
    this.shouldComponentUpdate = CONSTANT_UPDATE;
    return createElement<P>(Component, props);
  }
  Memoed.displayName =
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    `Memo(${Component.displayName || Component.name})`;
  Memoed.prototype.isReactComponent = true;
  Memoed._forwarded = true;
  return Memoed;
}
