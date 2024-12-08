import { type VNode } from 'preact';
import type { Fiber } from 'react-reconciler';
import {
  ComponentTags,
  isHostFiber,
  isCompositeFiber,
  traverseFiber,
} from './preact-core';
import {
  getTimings,
  initPerformanceMonitoring,
  clearPerformanceData,
  cleanupPerformanceMonitoring,
  getTreeImpact,
} from './performance';
import {
  initDevTools,
  instrument,
} from './devtools-bridge';

// Re-export constants for API compatibility
export const {
  FunctionComponent: FunctionComponentTag,
  ClassComponent: ClassComponentTag,
  HostComponent: HostComponentTag,
  Fragment,
  MemoComponent: MemoComponentTag,
} = ComponentTags;

export const SimpleMemoComponentTag = MemoComponentTag;
export const ContextConsumerTag = 9;
export const ForwardRefTag = 11;
export const HostHoistableTag = 26;
export const HostSingletonTag = 27;
export const DehydratedSuspenseComponent = 18;
export const HostText = 6;
export const LegacyHiddenComponent = 23;
export const OffscreenComponent = 22;
export const HostRoot = 3;
export const CONCURRENT_MODE_NUMBER = 0xeacf;
export const CONCURRENT_MODE_SYMBOL_STRING = 'Symbol(react.concurrent_mode)';
export const DEPRECATED_ASYNC_MODE_SYMBOL_STRING = 'Symbol(react.async_mode)';
export const PerformedWorkFlag = 0b01;

// Initialize performance monitoring
initPerformanceMonitoring();

// Initialize DevTools if in development
declare const __DEV__: boolean;
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  void initDevTools();
}

const isFiber = (node: Fiber | VNode | undefined | null): node is Fiber => {
  if (!node) {
    return false;
  }
  return Boolean(node && 'alternate' in node);
};

const isHostFiberNode = (node: Fiber | VNode): boolean => {
  if (isFiber(node)) {
    return node.tag === HostComponentTag;
  }
  return isHostFiber(node);
};

export const getNearestHostFiber = (fiber: Fiber | VNode): Fiber | VNode | null => {
  if (isFiber(fiber)) {
    let hostFiber = fiber.child;
    while (hostFiber) {
      if (isHostFiberNode(hostFiber)) return hostFiber;
      hostFiber = hostFiber.sibling;
    }
    return null;
  }
  return traverseFiber(fiber, isHostFiber);
};

const getType = (type: any): any => {
  if (typeof type === 'function') {
    return type;
  }
  if (typeof type === 'object' && type) {
    // memo / forwardRef case
    return getType(type.type || type.render);
  }
  return null;
};

const getDisplayName = (type: any): string | null => {
  if (typeof type !== 'function' && !(typeof type === 'object' && type)) {
    return null;
  }
  const name = type.displayName || type.name || null;
  if (name) return name;
  type = getType(type);
  if (!type) return null;
  return type.displayName || type.name || null;
};

const createFiberVisitor = ({
  onRender,
  onError,
}: {
    onRender: (fiber: Fiber | VNode, phase: 'mount' | 'update' | 'unmount') => void;
  onError?: (error: unknown) => void;
}) => {
  return (_rendererID: number, root: { current: Fiber | VNode }) => {
    try {
      const rootFiber = root.current;
      // For Preact, we consider it mounted if it's a VNode or if it's a new Fiber
      const wasMounted = !isFiber(rootFiber) || rootFiber.alternate === null;
      const isMounted = true; // If we have the node, it's mounted

      const mountFiber = (firstChild: Fiber | VNode, traverseSiblings: boolean) => {
        let node: Fiber | VNode | null = firstChild;
        while (node) {
          onRender(node, 'mount');
          if (isFiber(node)) {
            if (node.child) mountFiber(node.child, true);
            node = traverseSiblings ? node.sibling : null;
          } else {
            const children = node.props?.children;
            if (children) {
              const childArray = Array.isArray(children) ? children : [children];
              childArray.forEach(child => {
                if (child && typeof child === 'object') {
                  mountFiber(child as VNode, false);
                }
              });
            }
            node = null;
          }
        }
      };

      if (!wasMounted && isMounted) {
        mountFiber(rootFiber, false);
      }
    } catch (err) {
      if (onError) {
        onError(err);
      } else {
        throw err;
      }
    }
  };
};

// Export types
export type { VNode as PreactVNode };
export type { Fiber as ReactFiber };

export const shouldFilterFiber = (fiber: Fiber | VNode): boolean => {
  if (isFiber(fiber)) {
    const tag = fiber.tag;
    if (tag === DehydratedSuspenseComponent) return true;
    if (tag === HostText) return true;
    if (tag === Fragment) return true;
    if (tag === LegacyHiddenComponent) return true;
    if (tag === OffscreenComponent) return true;
    if (tag === HostRoot) return false;

    const symbolOrNumber = typeof fiber.type === 'object' && fiber.type !== null
      ? fiber.type.$$typeof
      : fiber.type;

    const typeSymbol = typeof symbolOrNumber === 'symbol'
      ? symbolOrNumber.toString()
      : symbolOrNumber;

    return typeSymbol === CONCURRENT_MODE_SYMBOL_STRING ||
      typeSymbol === DEPRECATED_ASYNC_MODE_SYMBOL_STRING;
  }

  // For Preact VNodes
  return typeof fiber.type === 'string' && !fiber.props?.children;
};

export const hasMemoCache = (fiber: Fiber | VNode): boolean => {
  if (!isFiber(fiber)) return false;
  return Boolean((fiber.updateQueue as any)?.memoCache);
};

export {
  getTimings,
  isHostFiber,
  isCompositeFiber,
  traverseFiber,
  clearPerformanceData,
  initPerformanceMonitoring,
  cleanupPerformanceMonitoring,
  instrument,
  createFiberVisitor,
  getDisplayName,
  getTreeImpact,
};

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
const visualizedElements: Array<{ stateNode: HTMLElement }> = [];

// Initialize canvas if not already initialized
if (canvas === null) {
  canvas = document.createElement('canvas');
  canvas.id = 'visualizer-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.zIndex = '9999999999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  ctx = canvas.getContext('2d')!;

  // Update canvas size on window resize
  window.addEventListener('resize', updateCanvasSize);

  // Update canvas on scroll
  window.addEventListener('scroll', updateCanvas);
} else {
  ctx = (canvas as any).getContext('2d')!;
}

function updateCanvasSize() {
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    updateCanvas();
  }
}

function updateCanvas() {
  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Re-draw the visualized elements
    visualizedElements.forEach(({ stateNode }) => {
      const rect = stateNode.getBoundingClientRect();

      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);

      // Draw the innerText with white text on red background
      ctx.font = '12px Arial';
      const text = stateNode.innerText;
      const textWidth = ctx.measureText(text).width;
      const textHeight = 16; // approximate height
      ctx.fillStyle = 'red'; // background color
      ctx.fillRect(rect.left, rect.top, textWidth + 10, textHeight);
      ctx.fillStyle = 'white'; // text color
      ctx.fillText(text, rect.left + 5, rect.top + 12);
    });
  }
}

instrument({
  onCommitFiberRoot: (rendererID, root) => {
    visualizedElements.length = 0;

    traverseFiber((root as { current: VNode }).current, (fiber) => {
      if (
        isHostFiber(fiber) &&
        fiber.props &&
        typeof fiber.props === 'object' &&
        'stateNode' in fiber &&
        (fiber as any).stateNode instanceof HTMLElement &&
        typeof fiber.type === 'string'
      ) {
        if ('onClick' in fiber.props) {
          const stateNode = (fiber as any).stateNode;
          visualizedElements.push({ stateNode });
        }
      }
      return false;
    });

    updateCanvas();
  },
});
