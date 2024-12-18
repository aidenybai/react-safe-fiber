# <img src="https://github.com/aidenybai/bippy/blob/main/.github/assets/bippy.png?raw=true" width="60" align="center" /> bippy

a hacky way to get fibers from react. used internally for [`react-scan`](https://github.com/aidenybai/react-scan).

bippy works by monkey-patching `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` with [custom handlers](https://github.com/facebook/react/blob/6a4b46cd70d2672bc4be59dcb5b8dede22ed0cef/packages/react-refresh/src/ReactFreshRuntime.js#L427). this gives us access to react internals without needing to use react devtools.

> [!WARNING]
> this project uses react internals, which can change at any time. **this is not recommended for usage and may break production apps** - unless you acknowledge this risk and know exactly you're doing.

## tutorial: create a mini react-scan

[`react-scan`](https://github.com/aidenybai/react-scan) is a tool that highlights renders in your react app. under the hood, it uses bippy to detect rendered fibers.

fibers are how "work" is represented in react. each fiber either represents a composite (function/class component) or a host (dom element). [here is a live visualization](https://jser.pro/ddir/rie?reactVersion=18.3.1&snippetKey=hq8jm2ylzb9u8eh468) of what the fiber tree looks like, and here is a [deep dive article](https://jser.dev/2023-07-18-how-react-rerenders/).

a simplified version of a fiber looks roughly like this:

```typescript
interface Fiber {
  // component type (function/class)
  type: any;

  child: Fiber | null;
  sibling: Fiber | null;

  // parent fiber
  return: Fiber | null;

  // saved props input
  memoizedProps: any;

  // state (useState, useReducer, useSES, etc.)
  memoizedState: any;

  // contexts (useContext)
  dependencies: Dependencies | null;
}
```

however, fibers aren't directly accessible by the user. so, we have to hack our way around to accessing it.

luckily, react [reads from a property](https://github.com/facebook/react/blob/6a4b46cd70d2672bc4be59dcb5b8dede22ed0cef/packages/react-reconciler/src/ReactFiberDevToolsHook.js#L48) in the window object: `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` and runs handlers on it when certain events happen. this is intended for react devtools, but we can use it to our advantage.

here's what it roughly looks like:

```typescript
interface __REACT_DEVTOOLS_GLOBAL_HOOK__ {
  // list of renderers (react-dom, react-native, etc.)
  renderers: Map<RendererID, ReactRenderer>;

  // called when react has rendered everythign and ready to apply changes to the host tree (e.g. DOM mutations)
  onCommitFiberRoot: (
    rendererID: RendererID,
    fiber: Record<string, unknown>,
    commitPriority?: number,
    didError?: boolean,
  ) => void;
}
```

we can use bippy's utils and the `onCommitFiberRoot` handler to detect renders!

### 0. setup

first, [create a new react project via stackblitz](https://stackblitz.com/fork/github/vitejs/vite/tree/main/packages/create-vite/template-react?file=src/App.jsx&terminal=dev)

then, install bippy:

```bash
npm install bippy
```

finally, re-run the dev server:

```bash
npm run dev
```

### 1. use `onCommitFiberRoot` to get fibers

let's use `instrument` to stub the `__REACT_DEVTOOLS_GLOBAL_HOOK__` object, and setup a custom handler for `onCommitFiberRoot`.

```jsx
import { instrument } from 'bippy'; // must be imported BEFORE react

// rest of your code ...

instrument({
  onCommitFiberRoot(rendererID, root) {
    const fiberRoot = root.current;
    console.log('fiberRoot', fiberRoot);
  },
});
```

running this should log `fiberRoot` to the console. i recommend you playing with this code to get a feel for how fibers work.

### 2. create a fiber visitor

now, let's create a fiber visitor with `createFiberVisitor` to "visit" fibers that render. not every fiber actually renders, so we need to filter for the ones that do.

```jsx
import { instrument, createFiberVisitor } from 'bippy'; // must be imported BEFORE react

// rest of your code ...

const visit = createFiberVisitor({
  onRender(fiber) {
    console.log('fiber render', fiber);
  },
});

instrument({
  onCommitFiberRoot(rendererID, root) {
    visit(rendererID, root);
  },
});
```

### 3. determine DOM nodes to highlight

next, we need to identify which DOM nodes we are going to highlight. we can do this by checking if the fiber is a host fiber, or if it's not, find the nearest host fiber.

```jsx
import {
  instrument,
  isHostFiber,
  getNearestHostFiber,
  createFiberVisitor,
} from 'bippy'; // must be imported BEFORE react

// rest of your code ...

const highlightFiber = (fiber) => {
  if (!(fiber instanceof HTMLElement)) return;

  console.log('highlight dom node', fiber.stateNode);
};

const visit = createFiberVisitor({
  onRender(fiber) {
    if (isHostFiber(fiber)) {
      highlightFiber(fiber);
    } else {
      // can be a component
      const hostFiber = getNearestHostFiber(fiber);
      highlightFiber(hostFiber);
    }
  },
});

instrument({
  onCommitFiberRoot(rendererID, root) {
    visit(rendererID, root);
  },
});
```

### 4. highlight DOM nodes

now, let's implement the `highlightFiber` function to highlight the DOM node. the simplest way is to just overlay a div (with a red border) on top of the DOM node.

```jsx
import {
  instrument,
  isHostFiber,
  getNearestHostFiber,
  createFiberVisitor,
} from 'bippy'; // must be imported BEFORE react

// rest of your code ...

const highlightFiber = (fiber) => {
  if (!(fiber.stateNode instanceof HTMLElement)) return;

  const rect = fiber.stateNode.getBoundingClientRect();
  const highlight = document.createElement('div');
  highlight.style.border = '1px solid red';
  highlight.style.position = 'fixed';
  highlight.style.top = `${rect.top}px`;
  highlight.style.left = `${rect.left}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
  highlight.style.zIndex = 999999999;
  document.documentElement.appendChild(highlight);
  setTimeout(() => {
    document.documentElement.removeChild(highlight);
  }, 100);
};

const visit = createFiberVisitor({
  onRender(fiber) {
    if (isHostFiber(fiber)) {
      highlightFiber(fiber);
    } else {
      // can be a component
      const hostFiber = getNearestHostFiber(fiber);
      highlightFiber(hostFiber);
    }
  },
});

instrument({
  onCommitFiberRoot(rendererID, root) {
    visit(rendererID, root);
  },
});
```

### 5. profit

try a completed version [here](https://bippy.million.dev)

you can learn more about bippy by [reading the source code](https://github.com/aidenybai/bippy/blob/main/src/index.ts).

looking for a more robust version of our mini react-scan? try out [react-scan](https://github.com/aidenybai/react-scan).

## misc

the original bippy character is owned and created by [@dairyfreerice](https://www.instagram.com/dairyfreerice). this project is not related to the bippy brand, i just think the character is cute
