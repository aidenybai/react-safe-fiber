import { getNearestHostFiber, instrument, traverseFiber } from 'bippy';
import type { Fiber, FiberRoot } from 'bippy';
import { useState } from 'react';
import ReactDOM from 'react-dom/client';

const createOverlay = (diff: string, target: HTMLElement) => {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    background: rgba(184, 0, 59, 0.8);
    color: white;
    padding: 12px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    white-space: pre;
    pointer-events: none;
    z-index: 999999;
    max-width: 600px;
    display: none;
  `;
  overlay.textContent = `⚠️ Hydration error:\n\n${diff}`;
  document.body.appendChild(overlay);

  // Create warning badge
  const badge = document.createElement('div');
  badge.style.cssText = `
    position: absolute;
    top: -19px;
    left: -4px;
    background: red;
    color: white;
    font-size: 10px;
    padding: 2px 4px;
    pointer-events: none;
    z-index: 999998;
  `;
  badge.textContent = '⚠️ hydration error';

  target.style.outline = '2px solid red';
  target.style.position = 'relative';
  target.appendChild(badge);

  target.addEventListener('mouseover', () => {
    overlay.style.display = 'block';
    const rect = target.getBoundingClientRect();
    overlay.style.top = `${rect.bottom + 8}px`;
    overlay.style.left = `${rect.left}px`;
  });
  target.addEventListener('mouseout', () => {
    overlay.style.display = 'none';
  });
};

const parseComponentStack = (stackTrace: string): string[] => {
  return stackTrace
    .trim()
    .split('\n')
    .map((line) => {
      const [, name = ''] = line.trim().split('at ');
      return name.split(' ')[0];
    })
    .filter(Boolean);
};

const findFiberFromComponentStack = (
  root: FiberRoot,
  componentStack: string[],
): Fiber | null => {
  let currentFiber = root.current;
  let stackIndex = componentStack.length - 1; // Start from the root (last in stack)

  while (currentFiber && stackIndex >= 0) {
    const targetName = componentStack[stackIndex];
    let foundFiber: Fiber | null = null;
    const alternativePaths: Fiber[] = [];

    // Traverse children at current level
    traverseFiber(currentFiber, (fiber) => {
      const name =
        fiber.elementType?.displayName ||
        fiber.elementType?.name ||
        fiber.type?.name ||
        fiber.type;
      if (name === targetName) {
        if (!foundFiber) {
          foundFiber = fiber;
        } else {
          alternativePaths.push(fiber);
        }
      }
    });

    if (!foundFiber) return null;

    // If we found siblings and we're not at the target yet, try alternative paths
    if (alternativePaths.length > 0 && stackIndex > 0) {
      for (const altFiber of alternativePaths) {
        const result = findFiberFromComponentStack(
          { current: altFiber } as FiberRoot,
          componentStack.slice(0, stackIndex),
        );
        if (result) return result;
      }
    }

    currentFiber = foundFiber;
    stackIndex--;
  }

  return currentFiber;
};

const onRecoverableError = (
  root: FiberRoot,
  error: Error,
  errorInfo: { componentStack: string },
) => {
  const stack = parseComponentStack(errorInfo.componentStack);
  const fiber = findFiberFromComponentStack(root, stack);
  console.log('Found fiber:', fiber);

  if (fiber) {
    const hostFiber = getNearestHostFiber(fiber);
    if (hostFiber?.stateNode) {
      createOverlay(error.message, hostFiber.stateNode);
    }
  }
};

instrument({
  onCommitFiberRoot: (_, root) => {
    const prevOnRecoverableError = root.onRecoverableError;

    traverseFiber(root.current, (fiber) => {
      console.log('fiber', fiber.stateNode?.outerHTML);
    });

    root.onRecoverableError = (
      error: Error,
      errorInfo: {
        componentStack: string;
      },
    ) => {
      onRecoverableError(root, error, errorInfo);
      prevOnRecoverableError?.(error, errorInfo);
    };
  },
});

const hydratedRoot = document.createElement('div');
document.body.appendChild(hydratedRoot);

hydratedRoot.innerHTML =
  '<div><h1>react hydration</h1><p>what if we made hydration errors enjoyable to debug?</p><button type="button">0 server mismatch</button></div>';

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {count} client mismatch
    </button>
  );
}

function A() {
  return (
    <div>
      <h1>react hydration</h1>
      <p>what if we made hydration errors enjoyable to debug?</p>
      <Counter />
    </div>
  );
}

ReactDOM.hydrateRoot(hydratedRoot, <A />);
