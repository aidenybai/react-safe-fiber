import { type VNode } from 'preact';
import { type Fiber } from 'react-reconciler';
import { createFiberFromVNode } from './preact-core';

const NO_OP = (): void => {
  /* no-op */
};

interface DevToolsRenderer {
  findFiberByHostInstance: (element: HTMLElement) => Fiber | null;
  bundleType?: number;
  version?: string;
  rendererPackageName?: string;
}

interface Hook {
  checkDCE: () => void;
  supportsFiber: boolean;
  supportsFlight: boolean;
  renderers: Map<number, DevToolsRenderer>;
  onScheduleFiberRoot: () => void;
  onCommitFiberRoot: (rendererID: number, root: unknown) => void;
  onCommitFiberUnmount: (rendererID: number, fiber: unknown) => void;
  onPostCommitFiberRoot: (rendererID: number, root: unknown) => void;
  inject: (renderer: unknown) => number;
}

// Create a minimal React DevTools hook
const createDevToolsHook = () => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  let devtoolsHook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ as Hook | undefined;
  const renderers = new Map();
  let i = 0;

  if (!devtoolsHook) {
    devtoolsHook = {
      checkDCE: NO_OP,
      supportsFiber: true,
      supportsFlight: false,
      renderers: new Map<number, DevToolsRenderer>(),
      onScheduleFiberRoot: NO_OP,
      onCommitFiberRoot: NO_OP,
      onCommitFiberUnmount: NO_OP,
      onPostCommitFiberRoot: NO_OP,
      inject(renderer) {
        const nextID = ++i;
        renderers.set(nextID, renderer);
        return nextID;
      },
    };

    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = devtoolsHook;
  }

  return devtoolsHook;
};

interface PreactDevToolsRenderer extends DevToolsRenderer {
  bundleType: number;
  version: string;
  rendererPackageName: string;
  createFiber: (vnode: VNode) => Fiber;
}

// Create a Preact-compatible renderer for React DevTools
export const createDevToolsRenderer = (): PreactDevToolsRenderer => {
  const renderer: PreactDevToolsRenderer = {
    bundleType: 1, // Dev
    version: '18.2.0', // React version for DevTools
    rendererPackageName: 'preact-in-bippy',

    // Find the Fiber node for a DOM element
    findFiberByHostInstance: (_instance: HTMLElement): Fiber | null => {
      // This would require a reverse mapping from DOM to VNode
      // For now, return null as it's not critical for core functionality
      return null;
    },

    // Create a Fiber node from a Preact VNode
    createFiber: (vnode: VNode): Fiber => {
      return createFiberFromVNode(vnode);
    },
  };

  return renderer;
};

interface DevToolsInstance {
  rendererID: number;
  notifyMount: (vnode: VNode) => void;
  notifyUpdate: (vnode: VNode) => void;
  notifyUnmount: (vnode: VNode) => void;
}

// Initialize DevTools integration
export const initDevTools = (): DevToolsInstance | undefined => {
  const hook = createDevToolsHook();
  if (!hook) {
    return undefined;
  }

  const renderer = createDevToolsRenderer();
  const rendererID = hook.inject(renderer);

  return {
    rendererID,
    notifyMount: (vnode: VNode): void => {
      const fiber = createFiberFromVNode(vnode);
      hook.onCommitFiberRoot(rendererID, { current: fiber });
    },
    notifyUpdate: (vnode: VNode): void => {
      const fiber = createFiberFromVNode(vnode);
      hook.onCommitFiberRoot(rendererID, { current: fiber });
    },
    notifyUnmount: (vnode: VNode): void => {
      const fiber = createFiberFromVNode(vnode);
      hook.onCommitFiberUnmount(rendererID, fiber);
    },
  };
};

export const instrument = ({
  onCommitFiberRoot,
  onCommitFiberUnmount,
  onPostCommitFiberRoot,
}: {
  onCommitFiberRoot?: (rendererID: number, root: unknown) => void;
  onCommitFiberUnmount?: (rendererID: number, root: unknown) => void;
  onPostCommitFiberRoot?: (rendererID: number, root: unknown) => void;
}) => {
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) return hook;

  const prevOnCommitFiberRoot = hook.onCommitFiberRoot;
  if (onCommitFiberRoot) {
    hook.onCommitFiberRoot = (rendererID: number, root: unknown) => {
      if (prevOnCommitFiberRoot) prevOnCommitFiberRoot(rendererID, root);
      onCommitFiberRoot(rendererID, root);
    };
  }

  const prevOnCommitFiberUnmount = hook.onCommitFiberUnmount;
  if (onCommitFiberUnmount) {
    hook.onCommitFiberUnmount = (rendererID: number, root: unknown) => {
      if (prevOnCommitFiberUnmount) prevOnCommitFiberUnmount(rendererID, root);
      onCommitFiberUnmount(rendererID, root);
    };
  }

  const prevOnPostCommitFiberRoot = hook.onPostCommitFiberRoot;
  if (onPostCommitFiberRoot) {
    hook.onPostCommitFiberRoot = (rendererID: number, root: unknown) => {
      if (prevOnPostCommitFiberRoot) prevOnPostCommitFiberRoot(rendererID, root);
      onPostCommitFiberRoot(rendererID, root);
    };
  }

  return hook;
};
