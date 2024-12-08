import { type VNode, options } from 'preact';

interface TimingData {
  startTime: number;
  duration: number;
  totalTime: number;
  isRendering: boolean;
  actualStartTime: number;
  actualDuration: number;
  selfBaseDuration: number;
  treeBaseDuration: number;
  baseDuration: number;
  renderCount: number;
  lastUpdate: number;
  phase: 'mount' | 'update' | 'unmount' | null;
  phaseTimings: {
    mount?: { startTime: number; duration: number };
    update?: Array<{ startTime: number; duration: number }>;
    unmount?: { startTime: number; duration: number };
  };
  rerenderCause?: {
    propsChanged?: boolean;
    stateChanged?: boolean;
    parentUpdate?: boolean;
    forceUpdate?: boolean;
  };
  nodeCount?: number;
  memoizedProps?: any;
  memoizedState?: any;
}

// Performance optimization: Use WeakMap for O(1) lookups and automatic cleanup
let componentTimings = new WeakMap<any, TimingData>();
let memoizedTreeDurations = new WeakMap<any, number>();

// Batch updates using requestAnimationFrame
const pendingUpdates = new Set<any>();
let isProcessingUpdates = false;

const processPendingUpdates = () => {
  if (isProcessingUpdates) {
    return;
  }
  isProcessingUpdates = true;

  requestAnimationFrame(() => {
    pendingUpdates.forEach(key => {
      const timing = componentTimings.get(key);
      if (timing) {
        memoizedTreeDurations.delete(key); // Invalidate memoized duration
      }
    });
    pendingUpdates.clear();
    isProcessingUpdates = false;
  });
};

// Re-entry prevention flags
let isProcessingVNode = false;
let isProcessingDiff = false;
let isProcessingCommit = false;

// Store original hooks
let originalVNode: ((vnode: VNode) => void) | undefined;
let originalDiff: ((vnode: VNode) => void) | undefined;
let originalCommit: ((vnode: VNode) => void) | undefined;

// Optimized key resolution with type caching
const getTimingKey = (node: VNode | any): any => {
  try {
    if (!node) {
      return null;
    }

    // Ensure we return an object for WeakMap key
    if (typeof node === 'function') {
      return node.prototype;
    }

    if (node.elementType) {
      return typeof node.elementType === 'function' ? node.elementType.prototype : node;
    }

    if (node.type) {
      return typeof node.type === 'function' ? node.type.prototype : node;
    }

    return node;
  } catch (e) {
    return node;
  }
};

// Memoized tree duration calculation
const calculateTreeDuration = (node: VNode | any): number => {
  try {
    if (!node) return 0;

    // Check memoized value
    const memoized = memoizedTreeDurations.get(node);
    if (memoized !== undefined) return memoized;

    const selfTime = (node.actualDuration || 0) as number;
    const childTime = (node.child ? calculateTreeDuration(node.child) : 0);
    const siblingTime = (node.sibling ? calculateTreeDuration(node.sibling) : 0);

    const total = selfTime + childTime + siblingTime;
    memoizedTreeDurations.set(node, total);
    return total;
  } catch (e) {
    return 0;
  }
};

// Optimized hooks with batching
const vnodeHook = (vnode: VNode): void => {
  if (!vnode || !vnode.type || isProcessingVNode) return;
  isProcessingVNode = true;

  try {
    const key = getTimingKey(vnode);
    if (!key) return;

    const now = performance.now();
    const existingTiming = componentTimings.get(key);
    const phase = existingTiming ? 'update' : 'mount';

    // Enhanced rerender cause tracking
    const rerenderCause = {
      propsChanged: existingTiming?.memoizedProps !== vnode.props,
      stateChanged: vnode.__v !== existingTiming?.memoizedState,
      parentUpdate: vnode.__v?.parentNode !== existingTiming?.memoizedState?.parentNode,
      forceUpdate: Boolean((vnode as any).flags && ((vnode as any).flags & 2048))
    };

    if (rerenderCause.propsChanged || rerenderCause.stateChanged || rerenderCause.parentUpdate) {
      const timing: TimingData = {
        startTime: now,
        duration: existingTiming?.duration ?? 0,
        totalTime: existingTiming?.totalTime ?? 0,
        isRendering: true,
        actualStartTime: now,
        actualDuration: existingTiming?.actualDuration ?? 0,
        selfBaseDuration: existingTiming?.selfBaseDuration ?? 0,
        treeBaseDuration: existingTiming?.treeBaseDuration ?? 0,
        baseDuration: existingTiming?.baseDuration ?? 0,
        renderCount: (existingTiming?.renderCount ?? 0) + 1,
        lastUpdate: now,
        phase,
        phaseTimings: {
          ...existingTiming?.phaseTimings,
          [phase]: phase === 'mount'
            ? { startTime: now, duration: 0 }
            : [...(existingTiming?.phaseTimings?.update ?? []), { startTime: now, duration: 0 }]
        },
        rerenderCause,
        nodeCount: countDescendants(vnode),
        memoizedProps: vnode.props,
        memoizedState: vnode.__v
      };

      componentTimings.set(key, timing);
      pendingUpdates.add(key);
      processPendingUpdates();
    }

    if (originalVNode) {
      originalVNode.call(options, vnode);
    }
  } finally {
    isProcessingVNode = false;
  }
};

const diffedHook = (vnode: VNode): void => {
  if (!vnode || !vnode.type || isProcessingDiff) return;
  isProcessingDiff = true;

  try {
    const key = getTimingKey(vnode);
    if (!key) return;

    const timing = componentTimings.get(key);
    if (timing && timing.isRendering) {
      const now = performance.now();
      const duration = now - timing.startTime;

      // Batch timing updates
      requestAnimationFrame(() => {
        timing.duration = duration;
        timing.totalTime += duration;
        timing.actualDuration = duration;
        timing.isRendering = false;
        timing.lastUpdate = now;

        componentTimings.set(key, timing);
        memoizedTreeDurations.delete(key); // Invalidate memoized duration
      });
    }

    if (originalDiff) {
      originalDiff.call(options, vnode);
    }
  } finally {
    isProcessingDiff = false;
  }
};

const commitHook = (vnode: VNode): void => {
  if (!vnode || !vnode.type || isProcessingCommit) return;
  isProcessingCommit = true;

  try {
    const key = getTimingKey(vnode);
    if (!key) return;

    const timing = componentTimings.get(key);
    if (timing && timing.isRendering) {
      const now = performance.now();
      const duration = now - timing.startTime;

      // Batch timing updates
      requestAnimationFrame(() => {
        timing.duration = duration;
        timing.totalTime += duration;
        timing.actualDuration = duration;
        timing.isRendering = false;
        timing.lastUpdate = now;

        componentTimings.set(key, timing);
        pendingUpdates.add(key);
        processPendingUpdates();
      });
    }

    if (originalCommit) {
      originalCommit.call(options, vnode);
    }
  } finally {
    isProcessingCommit = false;
  }
};

// Helper function to count descendants
const countDescendants = (vnode: VNode): number => {
  if (!vnode) return 0;
  let count = 1;
  if (Array.isArray(vnode.props?.children)) {
    const childrenCount = vnode.props.children.reduce((acc: number, child: VNode | null) =>
      acc + (child && typeof child === 'object' ? countDescendants(child) : 0), 0) as number;
    count += childrenCount;
  } else if (vnode.props?.children && typeof vnode.props.children === 'object') {
    count += countDescendants(vnode.props.children as VNode);
  }
  return count;
};

export const getTimings = (node: VNode | any) => {
  if (!node) return {
    selfTime: 0,
    totalTime: 0,
    phase: null,
    renderCount: 0,
    phaseTimings: {},
    rerenderCause: {},
    nodeCount: 0,
  };

  try {
    // Handle Fiber node
    if (node.actualDuration) {
      const treeDuration = calculateTreeDuration(node);
      return {
        selfTime: node.actualDuration as number,
        totalTime: treeDuration,
        phase: node.alternate ? 'update' : 'mount',
        renderCount: 1,
        phaseTimings: {
          [node.alternate ? 'update' : 'mount']: {
            startTime: performance.now(),
            duration: node.actualDuration as number
          }
        },
        rerenderCause: {
          propsChanged: node.pendingProps !== node.memoizedProps,
          stateChanged: node.memoizedState !== node.alternate?.memoizedState,
          parentUpdate: false,
          forceUpdate: (node.flags & 2048) !== 0 // ForceUpdate flag
        },
        nodeCount: countDescendants(node)
      };
    }

    // Handle VNode
    const key = getTimingKey(node);
    if (!key) return {
      selfTime: 0,
      totalTime: 0,
      phase: null,
      renderCount: 0,
      phaseTimings: {},
      rerenderCause: {},
      nodeCount: 0
    };

    const timing = componentTimings.get(key);
    if (!timing) return {
      selfTime: 0,
      totalTime: 0,
      phase: null,
      renderCount: 0,
      phaseTimings: {},
      rerenderCause: {},
      nodeCount: 0
    };

    return {
      selfTime: timing.duration,
      totalTime: timing.totalTime,
      phase: timing.phase,
      renderCount: timing.renderCount,
      phaseTimings: timing.phaseTimings,
      rerenderCause: timing.rerenderCause,
      nodeCount: timing.nodeCount
    };
  } catch (e) {
    return {
      selfTime: 0,
      totalTime: 0,
      phase: null,
      renderCount: 0,
      phaseTimings: {},
      rerenderCause: {},
      nodeCount: 0
    };
  }
};

export const clearPerformanceData = (): void => {
  componentTimings = new WeakMap();
  memoizedTreeDurations = new WeakMap();
  pendingUpdates.clear();
};

export const initPerformanceMonitoring = (): void => {
  originalVNode = options.vnode?.bind(options);
  originalDiff = options.diffed?.bind(options);
  originalCommit = options.__c?.bind(options);

  options.vnode = vnodeHook;
  options.diffed = diffedHook;
  options.__c = commitHook;
};

export const cleanupPerformanceMonitoring = (): void => {
  if (originalVNode) {
    options.vnode = originalVNode;
  }

  if (originalDiff) {
    options.diffed = originalDiff;
  }

  if (originalCommit) {
    options.__c = originalCommit;
  }

  clearPerformanceData();
};

// Initialize immediately
initPerformanceMonitoring();

export const getTreeImpact = (node: VNode | any) => {
  const timings = getTimings(node);

  if (!timings || timings.selfTime === 0) {
    return {
      selfTimePercentage: 0,
      treeOverhead: 0,
      isBottleneck: false,
      details: {
        selfTime: 0,
        totalTreeTime: 0,
        childrenTime: 0
      }
    };
  }

  const childrenTime = timings.totalTime - timings.selfTime;
  const selfTimePercentage = (timings.selfTime / timings.totalTime) * 100;

  return {
    selfTimePercentage,
    treeOverhead: childrenTime,
    isBottleneck: timings.selfTime > childrenTime,
    details: {
      selfTime: timings.selfTime,
      totalTreeTime: timings.totalTime,
      childrenTime
    }
  };
};
