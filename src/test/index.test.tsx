import { expect, test } from 'vitest';
import {
  getDisplayName,
  getRDTHook,
  getType,
  instrument,
  isCompositeFiber,
  isHostFiber,
  isValidElement,
} from '../index.js';
import React, { act } from 'react';
import ReactDOM from 'react-dom/client';
import { FiberRoot } from 'react-reconciler';
import { vi } from 'vitest';
import {
  createFiberVisitor,
  getTimings,
  traverseFiber,
  getNearestHostFiber,
  getFiberStack,
  getMutatedHostFibers,
  didFiberCommit,
  traverseProps,
  traverseState,
  traverseContexts,
} from '../index.js';
import type { Fiber } from 'react-reconciler';

// @ts-expect-error https://github.com/testing-library/react-testing-library/issues/1061#issuecomment-1117450890
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

test('isValidElement', () => {
  expect(isValidElement(React.createElement('div'))).toBe(true);
  expect(isValidElement({})).toBe(false);
});

test('getType', () => {
  const Component = () => <div>Hello</div>;
  const ForwardedComponent = React.forwardRef(Component);
  const MemoComponent = React.memo(Component);
  const MemoForwardedComponent = React.memo(ForwardedComponent);
  expect(getType(Component)).toBe(Component);
  expect(getType(ForwardedComponent)).toBe(Component);
  expect(getType(MemoComponent)).toBe(Component);
  expect(getType(MemoForwardedComponent)).toBe(Component);
});

test('getDisplayName', () => {
  const ArrowFnComponent = () => null;
  ArrowFnComponent.displayName = 'ArrowFnComponent';
  function FnComponent() {
    return null;
  }
  const MemoComponent = React.memo(FnComponent);
  MemoComponent.displayName = 'MemoComponent';
  expect(getDisplayName(ArrowFnComponent)).toBe('ArrowFnComponent');
  expect(getDisplayName(FnComponent)).toBe('FnComponent');
  expect(getDisplayName(MemoComponent)).toBe('MemoComponent');
});

test('getRDTHook', () => {
  const hook = getRDTHook();
  expect(hook).toEqual(window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
});

test('instrument', async () => {
  let fiberRoot: FiberRoot | null = null;
  await sleep(1);
  instrument({
    onCommitFiberRoot: (_rendererID, root) => {
      fiberRoot = root;
    },
  });
  const root = ReactDOM.createRoot(document.createElement('div'));
  function ChildComponent() {
    return <p></p>;
  }
  function ParentComponent() {
    return (
      <div>
        <ChildComponent />
      </div>
    );
  }
  root.render(<ParentComponent />);
  await sleep(1);
  expect(fiberRoot).not.toBeNull();
  let i = 0;
  let fiber = fiberRoot?.current.child;
  while (fiber) {
    switch (i) {
      case 0:
        expect(fiber.elementType).toEqual(ParentComponent);
        expect(isCompositeFiber(fiber)).toEqual(true);
        break;
      case 1:
        expect(isHostFiber(fiber)).toEqual(true);
        expect(fiber.type).toEqual('div');
        break;
      case 2:
        expect(fiber.elementType).toEqual(ChildComponent);
        expect(isCompositeFiber(fiber)).toEqual(true);
        break;
      case 3:
        expect(isHostFiber(fiber)).toEqual(true);
        expect(fiber.type).toEqual('p');
        break;
    }
    i++;
    fiber = fiber.child;
  }
  expect(i).toEqual(4);
});

test('createFiberVisitor', async () => {
  const onRenderMock = vi.fn();
  const visitor = createFiberVisitor({
    onRender(fiber) {
      if (fiber.type === TestComponent) {
        onRenderMock();
      }
    },
  });
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  instrument({
    onCommitFiberRoot: (rendererID, fiberRoot) => {
      visitor(rendererID, fiberRoot);
    },
  });

  function TestComponent() {
    const [count, setCount] = React.useState(0);
    React.useEffect(() => {
      setTimeout(() => {
        setCount(1);
      }, 100);
    }, []);
    return <div>Test Component {count}</div>;
  }

  await act(async () => {
    root.render(<TestComponent />);
    await sleep(1);
  });

  expect(onRenderMock).toHaveBeenCalledTimes(1);

  await act(async () => {
    await sleep(100);
  });

  expect(onRenderMock).toHaveBeenCalledTimes(2);
});

test('getTimings', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    return <div>Test Component</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const timings = getTimings(fiber);

  expect(timings).toHaveProperty('selfTime');
  expect(timings).toHaveProperty('totalTime');
});

test('traverseFiber', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function ChildComponent() {
    return <span>Child</span>;
  }

  function ParentComponent() {
    return (
      <div>
        <ChildComponent />
      </div>
    );
  }

  root.render(<ParentComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const foundFiber = traverseFiber(
    fiber,
    (node: Fiber) => node.type === ChildComponent,
  );

  expect(foundFiber?.type).toBe(ChildComponent);
});

test('getNearestHostFiber', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    return <div>Test Component</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const hostFiber = getNearestHostFiber(fiber!);

  expect(hostFiber?.type).toBe('div');
});

test('getFiberStack', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function GrandChildComponent() {
    return <span>GrandChild</span>;
  }

  function ChildComponent() {
    return <GrandChildComponent />;
  }

  function ParentComponent() {
    return <ChildComponent />;
  }

  root.render(<ParentComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child?.child?.child;

  const stack = getFiberStack(fiber!);

  expect(stack.length).toBeGreaterThan(0);
  expect(stack[0].type).toBe(ParentComponent);
});

test('getMutatedHostFibers', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    const [count, setCount] = React.useState(0);

    React.useEffect(() => {
      setCount(1);
    }, []);

    return <div>{count}</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current;

  const mutatedFibers = getMutatedHostFibers(fiber!);

  expect(mutatedFibers.length).toBeGreaterThan(0);
});

test('didFiberCommit', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent({ text }: { text: string }) {
    return <div>{text}</div>;
  }

  root.render(<TestComponent text="Hello" />);
  await sleep(1);

  root.render(<TestComponent text="Bye" />);
  await sleep(1);
  const fiber = fiberRoot?.current.child;

  const committed = didFiberCommit(fiber!);

  expect(committed).toBe(true);
});

test('traverseProps', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent(props: { text: string }) {
    return <div>{props.text}</div>;
  }

  root.render(<TestComponent text="Hello" />);
  await sleep(1);

  root.render(<TestComponent text="Hello" />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const changed = traverseProps(fiber!, (prevValue: any, nextValue: any) => {
    return prevValue !== nextValue;
  });

  expect(changed).toBe(false);
});

test('traverseState', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    const [state, setState] = React.useState(0);

    React.useEffect(() => {
      setState(1);
    }, []);

    return <div>{state}</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const stateChanged = traverseState(
    fiber!,
    (prevState: any, nextState: any) => {
      return prevState.memoizedState !== nextState.memoizedState;
    },
  );

  expect(stateChanged).toBe(true);
});

test('traverseContexts', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  const MyContext = React.createContext('default');

  function TestComponent() {
    const value = React.useContext(MyContext);
    return <div>{value}</div>;
  }

  root.render(
    <MyContext.Provider value="updated">
      <TestComponent />
    </MyContext.Provider>,
  );
  await sleep(1);

  const fiber = fiberRoot?.current.child?.child;

  const contextChanged = traverseContexts(fiber!, (prev: any, next: any) => {
    return prev.memoizedValue !== next.memoizedValue;
  });

  expect(contextChanged).toBe(false);
});

test('traverseFiber with null fiber', () => {
  const result = traverseFiber(null, () => true);
  expect(result).toBeNull();
});

test('traverseFiber with no matching selector', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    return <div>Test</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const result = traverseFiber(fiber, () => false);
  expect(result).toBeNull();
});

test('traverseFiber in a deep tree', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function ChildComponent() {
    return <span>Child</span>;
  }

  function SiblingComponent() {
    return <span>Sibling</span>;
  }

  function ParentComponent() {
    return (
      <div>
        <ChildComponent />
        <SiblingComponent />
      </div>
    );
  }

  function GrandParentComponent() {
    return (
      <section>
        <ParentComponent />
      </section>
    );
  }

  root.render(<GrandParentComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const foundFiber = traverseFiber(
    fiber,
    (node: Fiber) => node.type === SiblingComponent,
  );

  expect(foundFiber?.type).toBe(SiblingComponent);
});

test('traverseProps with no props', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    return <div>No props</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const changed = traverseProps(fiber, (prevValue, nextValue) => {
    return prevValue !== nextValue;
  });

  expect(changed).toBe(false);
});

test('traverseProps with nested props', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  const nestedProps = { data: { id: 1, value: 'test' } };

  function TestComponent(props: any) {
    return <div>{props.data.value}</div>;
  }

  root.render(<TestComponent {...nestedProps} />);
  await sleep(1);

  nestedProps.data = { id: 2, value: 'updated' };
  root.render(<TestComponent {...nestedProps} />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const changed = traverseProps(fiber, (prevValue, nextValue) => {
    return prevValue !== nextValue;
  });

  expect(changed).toBe(true);
});

test('traverseState with no state', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    return <div>No state</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const stateChanged = traverseState(fiber, (prevState, nextState) => {
    return prevState.memoizedState !== nextState.memoizedState;
  });

  expect(stateChanged).toBe(false);
});

test('traverseState with multiple updates', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    const [count, setCount] = React.useState(0);
    const [flag, setFlag] = React.useState(false);

    React.useEffect(() => {
      setTimeout(() => {
        setCount(1);
        setFlag(true);
      }, 0);
    }, []);

    return (
      <div>
        {count} - {String(flag)}
      </div>
    );
  }

  await act(async () => {
    root.render(<TestComponent />);
  });

  await act(async () => {
    await sleep(0);
  });

  const fiber = fiberRoot?.current.child;

  const stateChanged = traverseState(fiber!, (prevState, nextState) => {
    return prevState.memoizedState !== nextState.memoizedState;
  });

  expect(stateChanged).toBe(true);
});

test('traverseContexts with no context', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    return <div>No context</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const contextChanged = traverseContexts(fiber, (prev, next) => {
    return prev.memoizedValue !== next.memoizedValue;
  });

  expect(contextChanged).toBe(false);
});

test('traverseContexts with multiple contexts', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  const ContextA = React.createContext('A');
  const ContextB = React.createContext('B');

  function TestComponent() {
    const valueA = React.useContext(ContextA);
    const valueB = React.useContext(ContextB);
    return (
      <div>
        {valueA} - {valueB}
      </div>
    );
  }

  root.render(
    <ContextA.Provider value="A1">
      <ContextB.Provider value="B1">
        <TestComponent />
      </ContextB.Provider>
    </ContextA.Provider>,
  );
  await sleep(1);

  root.render(
    <ContextA.Provider value="A2">
      <ContextB.Provider value="B2">
        <TestComponent />
      </ContextB.Provider>
    </ContextA.Provider>,
  );
  await sleep(1);

  const fiber = fiberRoot?.current.child?.child?.child;

  const contextChanged = traverseContexts(fiber, (prev, next) => {
    return prev.memoizedValue !== next.memoizedValue;
  });

  expect(contextChanged).toBe(true);
});

test('getMutatedHostFibers with no mutations', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    return <div>Initial</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current;

  const mutatedFibers = getMutatedHostFibers(fiber);
  expect(mutatedFibers.length).toBe(0);
});

test('getMutatedHostFibers with multiple updates', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    const [text, setText] = React.useState('Initial');

    React.useEffect(() => {
      setTimeout(() => {
        setText('Updated');
      }, 0);
    }, []);

    return <div>{text}</div>;
  }

  await act(async () => {
    root.render(<TestComponent />);
  });

  await act(async () => {
    await sleep(0);
  });

  const fiber = fiberRoot?.current;

  const mutatedFibers = getMutatedHostFibers(fiber!);
  expect(mutatedFibers.length).toBeGreaterThan(0);
});

test('getFiberStack with shallow component', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function TestComponent() {
    return <div>Shallow</div>;
  }

  root.render(<TestComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child;

  const stack = getFiberStack(fiber);
  expect(stack.length).toBe(1);
  expect(stack[0].type).toBe(TestComponent);
});

test('getFiberStack in deeply nested components', async () => {
  const container = document.createElement('div');
  const root = ReactDOM.createRoot(container);

  let fiberRoot: FiberRoot | null = null;
  instrument({
    onCommitFiberRoot: (_rendererID, rootParam) => {
      fiberRoot = rootParam;
    },
  });

  function ChildComponent() {
    return <span>Child</span>;
  }

  function ParentComponent() {
    return <ChildComponent />;
  }

  function GrandParentComponent() {
    return <ParentComponent />;
  }

  function GreatGrandParentComponent() {
    return <GrandParentComponent />;
  }

  root.render(<GreatGrandParentComponent />);
  await sleep(1);

  const fiber = fiberRoot?.current.child?.child?.child?.child;

  const stack = getFiberStack(fiber!);
  expect(stack.length).toBe(4);
  expect(stack[0].type).toBe(GreatGrandParentComponent);
});
