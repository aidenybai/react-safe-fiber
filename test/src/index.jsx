import {
  instrument,
  createFiberVisitor,
  getTimings,
  getDisplayName,
  getFiberMutations,
} from 'bippy'; // must be imported BEFORE react
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const componentRenderMap = new WeakMap();

const visitor = createFiberVisitor({
  onRender(fiber, phase) {
    const componentType = fiber.elementType;
    if (
      typeof componentType !== 'function' &&
      (typeof componentType !== 'object' || !componentType)
    ) {
      return;
    }
    const render = componentRenderMap.get(componentType) || {
      count: 0,
      selfTime: 0,
      totalTime: 0,
      displayName: getDisplayName(componentType),
    };
    render.count++;
    const { selfTime, totalTime } = getTimings(fiber);
    render.selfTime += selfTime;
    render.totalTime += totalTime;
    componentRenderMap.set(componentType, render);
    console.log(phase, fiber, render);

    const mutations = getFiberMutations(fiber);
    if (mutations.length > 0) {
      console.log('mutations', mutations);
    }
  },
});

instrument({
  onCommitFiberRoot: (rendererID, fiberRoot) => {
    visitor(rendererID, fiberRoot);
  },
});

export const getRenderInfo = (componentType) => {
  return componentRenderMap.get(componentType);
};

function App() {
  const [count, setCount] = useState(0);
  const renderInfo = getRenderInfo(App);

  return (
    <>
      <p>
        <a
          href="https://github.com/aidenybai/bippy"
          // style={{ fontFamily: 'monospace' }}
        >
          view source ↗
        </a>
      </p>
      <CountDisplay count={count} />
      <button onClick={() => setCount(count + 1)}>
        <pre style={{ textAlign: 'left' }}>
          rendered: {JSON.stringify(renderInfo, null, 2)}
        </pre>
      </button>
    </>
  );
}

export const CountDisplay = ({ count }) => {
  return <div>{count}</div>;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
