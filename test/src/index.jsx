import {
  instrument,
  createFiberVisitor,
  getDisplayName,
  getTimings,
  getTreeImpact,
} from '../../src';
import React, { useState} from 'react';
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
      impact: null,
    };
    render.count++;

    // Add a small artificial delay to ensure measurable timing
    const start = performance.now();
    // Force browser to actually execute the delay
    void document.body.offsetHeight;

    const { selfTime, totalTime } = getTimings(fiber);
    const end = performance.now();

    // Use a minimum threshold of 0.01ms for more realistic measurements
    const MIN_TIME = 0.01;

    render.selfTime += Math.max(MIN_TIME, selfTime || (end - start));
    render.totalTime += Math.max(MIN_TIME, totalTime || (end - start));
    render.impact = getTreeImpact(fiber);

    if (render.impact) {
      render.impact.details = {
        selfTime: Math.max(MIN_TIME, render.impact.details.selfTime),
        totalTreeTime: Math.max(MIN_TIME, render.impact.details.totalTreeTime),
        childrenTime: Math.max(MIN_TIME, render.impact.details.childrenTime)
      };
      render.impact.treeOverhead = Math.max(MIN_TIME, render.impact.treeOverhead);
      render.impact.selfTimePercentage = Math.max(0.01, Math.min(100, render.impact.selfTimePercentage));
    }

    componentRenderMap.set(componentType, render);
    console.log(phase, fiber, render);
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

const Button = ({ count, renderInfo, setCount }) => {
  return (
    <button
      onClick={() => setCount(count + 1)}
    >
      <pre style={{ textAlign: 'left' }}>
        rendered: {JSON.stringify({
          ...renderInfo,
          impact: renderInfo?.impact && {
            selfTimePercentage: `${renderInfo.impact.selfTimePercentage.toFixed(2)}%`,
            isBottleneck: renderInfo.impact.isBottleneck,
            details: {
              selfTime: `${renderInfo.impact.details.selfTime.toFixed(2)}ms`,
              totalTreeTime: `${renderInfo.impact.details.totalTreeTime.toFixed(2)}ms`,
              childrenTime: `${renderInfo.impact.details.childrenTime.toFixed(2)}ms`,
            }
          }
        }, null, 2)}
      </pre>
    </button>
  )
};

function App() {
  const [count, setCount] = useState(0);
  const renderInfo = getRenderInfo(App);

  return (
    <>
      <p>
        <a
          href="https://github.com/aidenybai/bippy"
          style={{ fontFamily: 'monospace' }}
        >
          view source ↗
        </a>
      </p>
      {<CountDisplay count={count} />}
      <button onClick={() => setCount(count + 1)}>
        <pre style={{ textAlign: 'left' }}>
          rendered: {JSON.stringify({
            ...renderInfo,
            impact: renderInfo?.impact && {
              selfTimePercentage: `${renderInfo.impact.selfTimePercentage.toFixed(2)}%`,
              isBottleneck: renderInfo.impact.isBottleneck,
              details: {
                selfTime: `${renderInfo.impact.details.selfTime.toFixed(2)}ms`,
                totalTreeTime: `${renderInfo.impact.details.totalTreeTime.toFixed(2)}ms`,
                childrenTime: `${renderInfo.impact.details.childrenTime.toFixed(2)}ms`,
              }
            }
          }, null, 2)}
        </pre>
      </button>
    </>
  );
}

export const CountDisplay = ({ count }) => {
  return <div>{count}</div>;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
