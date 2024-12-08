// import { type Fiber } from 'react-reconciler';

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      checkDCE: () => void;
      supportsFiber: boolean;
      supportsFlight: boolean;
      renderers: Map<number, DevToolsRenderer>;
      onCommitFiberRoot: (id: number, root: unknown) => void;
      onCommitFiberUnmount: (id: number, fiber: unknown) => void;
      onPostCommitFiberRoot: (id: number, root: unknown) => void;
      inject: (renderer: unknown) => number;
    };
  }
}

declare module 'preact' {
  interface Options {
    __c?: (vnode: VNode) => void;
  }
  interface VNode {
    __v?: any; // Internal state
  }
}

export {};
