import { type VNode } from 'preact';
import { type Fiber } from 'react-reconciler';

// Preact VNode to React Fiber mapping
const vNodeMap = new WeakMap<VNode, Fiber>();

// Constants matching React's tags for API compatibility
export const ComponentTags = {
  FunctionComponent: 0,
  ClassComponent: 1,
  HostComponent: 5,
  Fragment: 7,
  MemoComponent: 14,
} as const;

// Convert Preact VNode type to React-compatible tag
export const getComponentTag = (vnode: VNode): number => {
  if (typeof vnode.type === 'function') {
    if ((vnode.type as any).prototype?.render) {
      return ComponentTags.ClassComponent;
    }

    if ((vnode.type as any).prototype?.isReactComponent) {
      return ComponentTags.ClassComponent;
    }
    return ComponentTags.FunctionComponent;
  }

  if (typeof vnode.type === 'string') {
    return ComponentTags.HostComponent;
  }

  return ComponentTags.Fragment;
};

// Create a React Fiber-like structure from Preact VNode
export const createFiberFromVNode = (vnode: VNode): Fiber => {
  const existingFiber = vNodeMap.get(vnode);
  if (existingFiber) {
    return existingFiber;
  }

  const fiber = {
    tag: getComponentTag(vnode),
    type: vnode.type,
    key: vnode.key,
    memoizedProps: vnode.props,
    memoizedState: null,
    return: null,
    child: null,
    sibling: null,
    alternate: null,
    flags: 0,
    actualDuration: 0,
    dependencies: null,
    _debugSource: {
      fileName: '',
      lineNumber: 0,
    },
    _debugOwner: null,
    _mountIndex: 0,
  } as unknown as Fiber;

  vNodeMap.set(vnode, fiber);
  return fiber;
};

// API compatibility layer
export const isHostFiber = (vnode: VNode) => {
  return typeof vnode.type === 'string';
};

export const isCompositeFiber = (vnode: VNode) => {
  return typeof vnode.type === 'function';
};

export const traverseFiber = (
  vnode: VNode | null,
  selector: (node: VNode) => boolean,
  ascending = false,
): VNode | null => {
  if (!vnode) {
    return null;
  }

  if (selector(vnode)) {
    return vnode;
  }

  if (!ascending && vnode.props?.children) {
    const children = Array.isArray(vnode.props.children)
      ? vnode.props.children
      : [vnode.props.children];

    for (const child of children) {
      if (child && typeof child === 'object') {
        const match = traverseFiber(child as VNode, selector, ascending);
        if (match) return match;
      }
    }
  }

  // Use internal _parent property for ascending traversal
  const parent = (vnode as any)._parent || (vnode as any).__p;
  return ascending && parent ? traverseFiber(parent as VNode, selector, ascending) : null;
};

// Get display name for component
export const getDisplayName = (type: any): string => {
  if (!type) return 'Unknown';
  if (typeof type === 'string') return type;
  return type.displayName || type.name || 'Anonymous';
};
