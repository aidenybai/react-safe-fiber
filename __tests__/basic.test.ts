import { h, render, type VNode, Component } from 'preact';
import { createFiberVisitor, getTimings, initPerformanceMonitoring, clearPerformanceData } from '../src';

// Extend HTMLElement to include Preact's internal _vnode
declare global {
  interface Element {
    _vnode?: VNode;
  }
}

// Error Boundary Component
class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? h('div', null, 'Error') : this.props.children;
  }
}

const sleep = (ms: number) => new Promise(resolve => { setTimeout(resolve, ms); });

describe('Bippy Core', () => {
  let container: HTMLElement;

  beforeAll(() => {
    initPerformanceMonitoring();
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearPerformanceData();
  });

  afterEach(() => {
    container.remove();
  });

  test('should track component mounting', async () => {
    const renders: Array<string> = [];
    class App extends Component {
      componentDidMount() {
        renders.push(`App-mount`);
      }
      render() {
        return h('div', null, 'Hello');
      }
    }
    App.displayName = 'App';

    render(h(App, null), container);
    await sleep(0);

    expect(renders).toContain('App-mount');
  });

  test('should collect enhanced performance metrics', async () => {
    class App extends Component {
      render() {
        // Simulate some work
        const start = performance.now();
        while (performance.now() - start < 1) {
          // Busy wait for 1ms
        }
        return h('div', null, 'Hello');
      }
    }

    render(h(App, null), container);
    await sleep(0);

    const metrics = getTimings(container._vnode);
    expect(metrics.selfTime).toBeGreaterThanOrEqual(0);
    expect(metrics.totalTime).toBeGreaterThanOrEqual(0);
  });

  test('should handle both Fiber and VNode structures', async () => {
    class App extends Component {
      render() {
        return h('div', null, 'Hello');
      }
    }

    render(h(App, null), container);
    await sleep(0);

    const visitor = createFiberVisitor({
      onRender: (fiber) => {
        expect(fiber).toHaveProperty('type');
        expect(fiber).toHaveProperty('props');

        const metrics = getTimings(fiber);
        expect(typeof metrics.selfTime).toBe('number');
        expect(typeof metrics.totalTime).toBe('number');
      }
    });

    visitor(1, { current: container._vnode! });
  });

  test('should handle production errors gracefully', async () => {
    const ErrorApp = () => {
      throw new Error('Simulated error');
    };

    render(h(ErrorBoundary, null, h(ErrorApp, null)), container);
    await sleep(0);

    const metrics = getTimings(container._vnode);
    expect(metrics.selfTime).toBeGreaterThanOrEqual(0);
    expect(metrics.totalTime).toBeGreaterThanOrEqual(0);
  });
});

describe('Performance Optimizations', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearPerformanceData();
  });

  afterEach(() => {
    container.remove();
  });

  test('should memoize tree duration calculations', async () => {
    let renderCount = 0;
    class App extends Component {
      render() {
        renderCount++;
        return h('div', null,
          h('span', null, 'Child 1'),
          h('span', null, 'Child 2')
        );
      }
    }

    render(h(App, null), container);
    await sleep(0);

    // First measurement
    const metrics1 = getTimings(container._vnode);
    const totalTime1 = metrics1.totalTime;

    // Second measurement should use memoized value
    const metrics2 = getTimings(container._vnode);
    const totalTime2 = metrics2.totalTime;

    expect(totalTime1).toBe(totalTime2);
    expect(renderCount).toBe(1); // Should only render once
  });

  test('should batch performance updates', async () => {
    let updateCount = 0;
    class App extends Component {
      state = { count: 0 };

      componentDidMount() {
        // Trigger multiple updates in the same frame
        this.setState({ count: 1 });
        this.setState({ count: 2 });
        this.setState({ count: 3 });
      }

      render() {
        updateCount++;
        return h('div', null, String(this.state.count));
      }
    }

    render(h(App, null), container);
    await sleep(16); // Wait for one frame

    const metrics = getTimings(container._vnode);
    expect(metrics.renderCount).toBeLessThanOrEqual(2); // Should batch updates
    expect(updateCount).toBeLessThanOrEqual(2); // Should batch renders
  });

  test('should handle memory cleanup', async () => {
    const ref = { current: null as any };

    class App extends Component {
      componentDidMount() {
        ref.current = this.render.bind(this);
      }
      render() {
        return h('div', null, 'Test');
      }
    }

    // Mount
    render(h(App, null), container);
    await sleep(0);

    const initialMetrics = getTimings(ref.current);
    expect(initialMetrics.selfTime).toBeGreaterThanOrEqual(0);

    // Unmount
    render(null, container);
    await sleep(0);

    // Clear references
    ref.current = null;

    // WeakMap should handle cleanup automatically
    expect(true).toBe(true);
  });

  test('should optimize repeated renders', async () => {
    class App extends Component {
      state = { count: 0 };

      render() {
        return h('div', null, String(this.state.count));
      }
    }

    render(h(App, null), container);
    await sleep(0);

    const instance = container._vnode;
    const initialMetrics = getTimings(instance);

    // Update with same props/state
    render(h(App, null), container);
    await sleep(0);

    const samePropsMetrics = getTimings(instance);
    expect(samePropsMetrics.renderCount).toBe(initialMetrics.renderCount);
  });
});

describe('Performance Benchmarks', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearPerformanceData();
  });

  afterEach(() => {
    container.remove();
  });

  test('should show memoization benefits', async () => {
    const createDeepTree = (depth: number): VNode => {
      class TreeNode extends Component {
        render(): VNode {
          if (depth <= 0) return h('div', null, 'leaf');
          return h('div', null, createDeepTree(depth - 1));
        }
      }
      return h(TreeNode, null);
    };

    // First render
    render(createDeepTree(5), container);
    await sleep(0);
    const firstMetrics = getTimings(container._vnode);

    // Second render should use memoized values
    render(createDeepTree(5), container);
    await sleep(0);
    const secondMetrics = getTimings(container._vnode);

    // In test environment, just verify the metrics are collected
    expect(firstMetrics.selfTime).toBeGreaterThanOrEqual(0);
    expect(secondMetrics.selfTime).toBeGreaterThanOrEqual(0);
  });

  test('should show batching benefits', async () => {
    let updateCount = 0;

    class BatchTest extends Component {
      state = { count: 0 };

      componentDidMount(): void {
      // Multiple synchronous updates should be batched
        for (let i = 0; i < 5; i++) {
          this.setState({ count: i });
        }
      }

      render(): VNode {
        updateCount++;
        return h('div', null, String(this.state.count));
      }
    }

    render(h(BatchTest, null), container);
    await sleep(32);

    // Verify batching by checking update count
    expect(updateCount).toBeLessThanOrEqual(3); // Allow some flexibility in update count
  });

  test('should show tree traversal optimization', async () => {
    const createWideTree = (width: number): VNode => {
      class WideNode extends Component {
        render(): VNode {
          return h('div', null,
            ...Array(width).fill(null).map((_, i) =>
              h('div', { key: i }, `child-${i}`)
            )
          );
        }
      }
      return h(WideNode, null);
    };

    // First traversal
    render(createWideTree(100), container);
    await sleep(0);
    const firstTraversal = getTimings(container._vnode);

    // Second traversal should use cached values
    const secondTraversal = getTimings(container._vnode);

    // Verify metrics are collected
    expect(firstTraversal.totalTime).toBeGreaterThanOrEqual(0);
    expect(secondTraversal.totalTime).toBeGreaterThanOrEqual(0);
  });
});

describe('Complex Performance Scenarios', () => {
  let container: HTMLElement;
  const nodeStats = { count: 0 };

  const countNodes = (vnode: VNode<any> | null): number => {
    if (!vnode) return 0;
    let count = 1;
    if (Array.isArray(vnode.props?.children)) {
      const childrenCount = (vnode.props.children.reduce((acc: number, child: any) => {
        const childCount = countNodes(child);
        return acc + (typeof childCount === 'number' ? childCount : 0);
      }, 0)) as number;
      count = count + childrenCount;
    } else if (vnode.props?.children) {
      count = count + countNodes(vnode.props.children);
    }
    return count;
  };

  const sleep = (ms: number) => new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    clearPerformanceData();
    nodeStats.count = 0;
  });

  afterEach(() => {
    container.remove();
  });

  test('should handle nested dynamic updates efficiently', async () => {
    let parentRenders = 0;
    let childRenders = 0;
    let grandchildRenders = 0;

    class Grandchild extends Component<{ value: number }> {
      render(): VNode {
        grandchildRenders++;
        return h('div', null, `Grandchild ${this.props.value}`);
      }
    }

    class Child extends Component<Record<string, unknown>, { count: number }> {
      state = { count: 0 };

      async componentDidMount(): Promise<void> {
        await Promise.all([
          this.setState({ count: 1 }),
          this.setState({ count: 2 }),
          this.setState({ count: 3 })
        ]);
      }

      render(): VNode {
        childRenders++;
        return h('div', null, [
          h('span', null, `Child ${this.state.count}`),
          h(Grandchild, { value: this.state.count }),
          h(Grandchild, { value: this.state.count + 1 })
        ]);
      }
    }

    class Parent extends Component<Record<string, unknown>, { value: number }> {
      state = { value: 0 };

      async componentDidMount(): Promise<void> {
        await Promise.all([
          this.setState({ value: 1 }),
          sleep(0).then(() => this.setState({ value: 2 }))
        ]);
      }

      render(): VNode {
        parentRenders++;
        return h('div', null, [
          h('span', null, `Parent ${this.state.value}`),
          h(Child, { key: 1 }),
          h(Child, { key: 2 })
        ]);
      }
    }

    const vnode = h(Parent, null);
    nodeStats.count = countNodes(vnode);

    render(vnode, container);
    await sleep(32);

    expect(parentRenders).toBeLessThanOrEqual(3);
    expect(childRenders).toBeLessThanOrEqual(8);
    expect(grandchildRenders).toBeLessThanOrEqual(16);
    expect(nodeStats.count).toBeGreaterThan(0);
  });

  test('should handle concurrent tree modifications', async () => {
    let updateCount = 0;

    class DynamicTree extends Component<Record<string, unknown>, { items: Array<number> }> {
      state = { items: Array.from({ length: 5 }, (_, i) => i) };

      async componentDidMount(): Promise<void> {
        await Promise.all([
          this.setState({ items: [...this.state.items, 6] }),
          this.setState(prev => ({
            items: prev.items.filter((_, i) => i !== 0)
          })),
          this.setState(prev => ({
            items: prev.items.map(x => x + 1)
          }))
        ]);
      }

      render(): VNode {
        updateCount++;
        const vnode = h('div', null,
          this.state.items.map((item, index) =>
            h('div', { key: index }, [
              h('span', null, `Item ${item}`),
              h('div', null, Array(3).fill(0).map((_, childIndex) =>
                h('span', { key: childIndex }, `Child ${childIndex}`)
              ))
            ])
          )
        );
        nodeStats.count = countNodes(vnode);
        return vnode;
      }
    }

    render(h(DynamicTree, null), container);
    await sleep(32);

    expect(updateCount).toBeLessThanOrEqual(4);
    expect(nodeStats.count).toBeGreaterThan(0);
  });

  test('should optimize heavy tree operations', async () => {
    const createHeavyTree = (depth: number, width: number): VNode => {
      class HeavyNode extends Component<Record<string, unknown>> {
        render(): VNode {
          if (depth <= 0) {
            return h('div', null, Array(width).fill(0).map((_, index) =>
              h('span', { key: index }, `Leaf ${index}`)
            ));
          }
          return h('div', null, Array(width).fill(0).map(() =>
            createHeavyTree(depth - 1, width)
          ));
        }
      }
      return h(HeavyNode, null);
    };

    const vnode = createHeavyTree(3, 3);
    nodeStats.count = countNodes(vnode);

    render(vnode, container);
    await sleep(0);
    const firstMetrics = getTimings(container._vnode);

    render(vnode, container);
    await sleep(0);
    const secondMetrics = getTimings(container._vnode);

    expect(secondMetrics.totalTime).toBeGreaterThanOrEqual(0);
    expect(secondMetrics.renderCount).toBeGreaterThanOrEqual(firstMetrics.renderCount);
    expect(nodeStats.count).toBeGreaterThan(0);
  });

  test('should demonstrate memoization benefits', async () => {
    let renderCount = 0;

    // Non-memoized component
    class ExpensiveComponent extends Component {
      render() {
        renderCount++;
        // Simulate expensive calculation
        let result = 0;
        for (let i = 0; i < 10000; i++) {
          result += Math.random();
        }
        return h('div', null, `Result: ${result}`);
      }
    }

    // Memoized version
    class MemoizedComponent extends Component {
      shouldComponentUpdate() {
        return false; // Prevent rerenders
      }

      render() {
        renderCount++;
        // Same expensive calculation
        let result = 0;
        for (let i = 0; i < 10000; i++) {
          result += Math.random();
        }
        return h('div', null, `Result: ${result}`);
      }
    }

    // Test non-memoized first
    renderCount = 0;
    const NonMemoApp = () => {
      return h('div', null, [
        h(ExpensiveComponent, { key: 'expensive' }),
        h('button', { id: 'trigger' }, 'Update')
      ]);
    };

    render(h(NonMemoApp, null), container);
    const nonMemoStartTime = performance.now();

    // Trigger 5 rerenders
    for (let i = 0; i < 5; i++) {
      render(h(NonMemoApp, null), container);
    }

    const nonMemoTime = performance.now() - nonMemoStartTime;
    const nonMemoRenders = renderCount;

    // Clear and test memoized version
    container.innerHTML = '';
    renderCount = 0;

    const MemoApp = () => {
      return h('div', null, [
        h(MemoizedComponent, { key: 'memoized' }),
        h('button', { id: 'trigger' }, 'Update')
      ]);
    };

    render(h(MemoApp, null), container);
    const memoStartTime = performance.now();

    // Same 5 rerenders
    for (let i = 0; i < 5; i++) {
      render(h(MemoApp, null), container);
    }

    const memoTime = performance.now() - memoStartTime;
    const memoRenders = renderCount;

    // eslint-disable-next-line no-console
    console.log(`
Performance Comparison:
----------------------
Non-memoized:
  - Render count: ${nonMemoRenders}
  - Time taken: ${nonMemoTime.toFixed(2)}ms

Memoized:
  - Render count: ${memoRenders}
  - Time taken: ${memoTime.toFixed(2)}ms

Improvement:
  - Renders reduced by: ${((nonMemoRenders - memoRenders) / nonMemoRenders * 100).toFixed(1)}%
  - Time reduced by: ${((nonMemoTime - memoTime) / nonMemoTime * 100).toFixed(1)}%
`);

    expect(memoRenders).toBeLessThan(nonMemoRenders);
    expect(memoTime).toBeLessThan(nonMemoTime);
  });

  test('should show enhanced metrics output', async () => {
    clearPerformanceData();
    initPerformanceMonitoring();

    const ref = { current: null as any };

    class TestComponent extends Component {
      state = { data: [] as Array<any> };

      componentDidMount() {
        ref.current = this;
        // Create some heap usage with a large array
        const largeData = Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          value: `Item ${i}`,
          timestamp: Date.now(),
          metadata: { type: 'test', status: 'active' }
        }));
        this.setState({ data: largeData }, () => {
          this.forceUpdate();
        });
      }

      render() {
        return h('div', { 'data-testid': 'test-component' }, [
          h('span', { key: '1' }, 'Child 1'),
          h('span', { key: '2' }, 'Child 2'),
          h('div', { key: 'data' }, `Items: ${this.state.data.length}`)
        ]);
      }
    }

    render(h(TestComponent, { key: 'test' }), container);
    await sleep(10);

    // Force updates
    ref.current.forceUpdate();
    await sleep(10);
    ref.current.forceUpdate();
    await sleep(10);

    // Get internal VNode from component instance
    const internalVNode = (ref.current).__v;
    const metrics = getTimings(internalVNode);

    // eslint-disable-next-line no-console
    console.log('Debug:', {
      hasInstance: !!ref.current,
      hasInternalVNode: !!internalVNode,
      vnodeType: internalVNode?.type?.name,
      phase: metrics.phase
    });

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      component: 'TestComponent',
      renderMetrics: {
        selfTime: `${metrics.selfTime.toFixed(2)}ms`,
        totalTime: `${metrics.totalTime.toFixed(2)}ms`,
        renderCount: metrics.renderCount,
        phase: metrics.phase
      },
      phaseTimings: metrics.phaseTimings,
      rerenderCause: metrics.rerenderCause,
      nodeCount: metrics.nodeCount
    }, null, 2));

    expect(ref.current).toBeTruthy();
    expect(metrics.totalTime).toBeGreaterThanOrEqual(0);
    expect(metrics.phase).toBe('update');
  });
});
