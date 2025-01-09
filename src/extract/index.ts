import {
  type Fiber,
  type FiberRoot,
  getDisplayName,
  getFiberFromHostInstance,
  getFiberId,
  getFiberStack,
  instrument,
  isCompositeFiber,
  isHostFiber,
  secure,
  traverseFiber,
  traverseRenderedFibers,
} from '../index.js';
import { isFiberInteractive } from './is-fiber-interactive.js';

export interface ReactSpecTree {
  root: BaseReactSpecNode;
}

export enum ReactSpecNodeType {
  Component = 'component',
  A11y = 'a11y',
  Interactive = 'interactive',
  Element = 'element',
}

export interface BaseReactSpecNode {
  type: ReactSpecNodeType;
  children: ReactSpecNode[];
}

export interface ReactElementSpecNode extends BaseReactSpecNode {
  type:
    | ReactSpecNodeType.Element
    | ReactSpecNodeType.Interactive
    | ReactSpecNodeType.A11y;
  element: Element | null;
}

export interface ReactInteractiveSpecNode extends ReactElementSpecNode {
  eventHandlers: Record<string, string>;
  element: Element | null;
  type: ReactSpecNodeType.Interactive | ReactSpecNodeType.A11y;
}

export interface ReactA11ySpecNode extends ReactInteractiveSpecNode {
  type: ReactSpecNodeType.A11y;
  role: string | null;
  ariaLabel: string | null;
}

export interface ReactComponentSpecNode extends BaseReactSpecNode {
  type: ReactSpecNodeType.Component;
  props: Record<string, unknown>;
  name: string | null;
}

export type ReactSpecNode =
  | ReactInteractiveSpecNode
  | ReactA11ySpecNode
  | ReactComponentSpecNode
  | ReactElementSpecNode;

declare global {
  var __RST__: boolean;
}
const fiberRoots = new Set<FiberRoot>();

const getDpr = () => {
  return Math.min(window.devicePixelRatio || 1, 2);
};

const CANVAS_HTML_STR = `<canvas style="position:fixed;top:0;left:0;pointer-events:none;z-index:2147483646" aria-hidden="true"></canvas>`;
export const primaryColor = '115,97,230';

const lerp = (start: number, end: number) => {
  return Math.floor(start + (end - start) * 0.2);
};

export const init = () => {
  let hasInitedIds = false;
  let prevX: number | undefined;
  let prevY: number | undefined;
  let isAnimating = false;

  const handleFiber = (fiber: Fiber) => {
    getFiberId(fiber);
  };

  instrument(
    secure(
      {
        onActive() {
          globalThis.__RST__ = true;
        },
        onCommitFiberRoot(_, root) {
          fiberRoots.add(root);
          if (!hasInitedIds) {
            traverseFiber(root, handleFiber);
            hasInitedIds = true;
            return;
          }
          traverseRenderedFibers(root, handleFiber);
        },
      },
      {
        dangerouslyRunInProduction: true,
        onError: (error) => {
          if (error) {
            console.error(error);
          }
        },
      },
    ),
  );

  let focusedElement: Element | null = null;
  let focusedFiber: Fiber | null = null;
  let text: string | null = null;

  const draw = async () => {
    if (!ctx) return;
    const currentElement = focusedElement;
    if (!currentElement) {
      clear();
      return false;
    }

    const elements = [currentElement];

    if (focusedFiber) {
      traverseFiber(focusedFiber, (fiber) => {
        if (isHostFiber(fiber)) {
          elements.push(fiber.stateNode);
        }
      });
    }

    const rectMap = await getRectMap(elements);
    const currentRect = rectMap.get(currentElement);
    if (!currentRect) return false;

    clear();

    let shouldContinueAnimating = false;
    const interpolatedX =
      prevX !== undefined ? lerp(prevX, currentRect.x) : currentRect.x;
    const interpolatedY =
      prevY !== undefined ? lerp(prevY, currentRect.y) : currentRect.y;

    if (
      prevX !== undefined &&
      (Math.abs(interpolatedX - currentRect.x) > 0.1 ||
        Math.abs(interpolatedY - currentRect.y) > 0.1)
    ) {
      shouldContinueAnimating = true;
    }

    for (const element of elements) {
      const rect = rectMap.get(element);
      if (!rect) continue;
      const { width, height } = rect;
      const x = element === currentElement ? interpolatedX : rect.x;
      const y = element === currentElement ? interpolatedY : rect.y;

      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.strokeStyle = `rgba(${primaryColor},0.5)`;
      if (currentElement === element) {
        ctx.fillStyle = `rgba(${primaryColor},0.1)`;
        ctx.strokeStyle = `rgba(${primaryColor})`;
        ctx.fill();
      }
      ctx.stroke();
    }

    if (text) {
      const { width: textWidth } = ctx.measureText(text);
      const textHeight = 11;
      ctx.textRendering = 'optimizeSpeed';
      ctx.font = '11px monospace';

      let labelY: number = interpolatedY - textHeight - 4;
      if (labelY < 0) {
        labelY = 0;
      }

      ctx.fillStyle = `rgba(${primaryColor})`;
      ctx.fillRect(interpolatedX, labelY, textWidth + 4, textHeight + 4);

      ctx.fillStyle = 'rgba(255,255,255)';
      ctx.fillText(text, interpolatedX + 2, labelY + textHeight);

      prevX = interpolatedX;
      prevY = interpolatedY;
    }

    return shouldContinueAnimating;
  };

  const animate = async () => {
    if (!isAnimating) return;
    const shouldContinue = await draw();
    if (shouldContinue) {
      requestAnimationFrame(animate);
    } else {
      isAnimating = false;
    }
  };

  const startAnimation = () => {
    if (!isAnimating) {
      isAnimating = true;
      requestAnimationFrame(animate);
    }
  };

  document.addEventListener('contextmenu', async (event) => {
    // if (event.button !== 2) return;
    const target = event.target as Element;
    const fiber = getFiberFromHostInstance(target);

    focusedElement = target;
    if (fiber) {
      focusedFiber = fiber;
      const stack = getFiberStack(fiber);
      const displayNames = stack.map((fiber) => getDisplayName(fiber));
      const orderedDisplayNames: string[] = [];
      let count = 0;

      let nearestCompositeFiber: Fiber | null = null;
      let currentFiber: Fiber | null = fiber;
      while (currentFiber) {
        if (isCompositeFiber(currentFiber)) {
          nearestCompositeFiber = currentFiber;
          break;
        }
        currentFiber = currentFiber.return;
      }

      for (let i = displayNames.length - 1; i >= 0; i--) {
        const displayName = displayNames[i];
        if (displayName) {
          orderedDisplayNames.push(displayName);
          count++;
        }
        if (count > 2) break;
      }
      text = orderedDisplayNames.join(' > ');
      const rst = createRSTWithFiber(nearestCompositeFiber || fiber, target);
      // console.log(printRST(rst));
      console.log(rst);
    } else {
      focusedFiber = null;
      // text = target.tagName.toLowerCase();
      // const rst = await createRSTWithElement(target);
      // // console.log(printRST(rst));
      // console.log(rst);
      // TODO: implement version with only a11y tree
    }

    startAnimation();
  });

  const clear = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  };

  const host = document.createElement('div');
  host.setAttribute('data-react-scan', 'true');
  const shadowRoot = host.attachShadow({ mode: 'open' });

  shadowRoot.innerHTML = CANVAS_HTML_STR;
  const canvas = shadowRoot.firstChild as HTMLCanvasElement;
  if (!canvas) return null;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const { innerWidth, innerHeight } = window;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  const width = innerWidth * dpr;
  const height = innerHeight * dpr;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (ctx) {
    ctx.scale(dpr, dpr);
  }

  let isResizeScheduled = false;
  window.addEventListener('resize', () => {
    if (!isResizeScheduled) {
      isResizeScheduled = true;
      setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        dpr = getDpr();
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        if (ctx) {
          ctx.resetTransform();
          ctx.scale(dpr, dpr);
        }
        startAnimation();
        isResizeScheduled = false;
      });
    }
  });

  let isScrollScheduled = false;

  window.addEventListener('scroll', () => {
    if (!isScrollScheduled) {
      isScrollScheduled = true;
      setTimeout(() => {
        requestAnimationFrame(() => {
          startAnimation();
        });
        isScrollScheduled = false;
      }, 16 * 2);
    }
  });

  let prevFocusedElement: Element | null = null;
  setInterval(() => {
    if (prevFocusedElement === focusedElement) {
      return;
    }
    prevFocusedElement = focusedElement;
    startAnimation();
  }, 16 * 2);

  shadowRoot.appendChild(canvas);

  document.documentElement.appendChild(host);
};

init();

export const createRSTWithFiber = (
  fiber: Fiber,
  element: Element,
): ReactSpecTree => {
  const nodes: ReactSpecNode[] = [];
  traverseNode(fiber, element, nodes);
  return { root: nodes[0] };
};

const traverseNode = (
  fiber: Fiber,
  element: Element | null,
  nodes: ReactSpecNode[],
) => {
  if (isCompositeFiber(fiber)) {
    const node: ReactComponentSpecNode = {
      type: ReactSpecNodeType.Component,
      name: getDisplayName(fiber),
      props: {},
      children: [],
    };

    if (fiber.memoizedProps) {
      const props = fiber.memoizedProps as Record<string, unknown>;
      for (const [key, value] of Object.entries(props)) {
        node.props[key] = value;
      }
    }

    nodes.push(node);
    traverseChildren(fiber, node.children);
  } else if (isHostFiber(fiber) && element) {
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const hasA11y = role || ariaLabel;

    if (hasA11y) {
      const node: ReactA11ySpecNode = {
        type: ReactSpecNodeType.A11y,
        role,
        ariaLabel,
        element,
        eventHandlers: {},
        children: [],
      };
      nodes.push(node);
      traverseChildren(fiber, node.children);
    } else if (isFiberInteractive(fiber)) {
      const node: ReactInteractiveSpecNode = {
        type: ReactSpecNodeType.Interactive,
        element,
        eventHandlers: {},
        children: [],
      };
      nodes.push(node);
      traverseChildren(fiber, node.children);
    } else {
      const node: ReactElementSpecNode = {
        type: ReactSpecNodeType.Element,
        element,
        children: [],
      };
      nodes.push(node);
      traverseChildren(fiber, node.children);
    }
  } else {
    // For other fiber types, just traverse children
    traverseChildren(fiber, nodes);
  }
};

const traverseChildren = (fiber: Fiber, nodes: ReactSpecNode[]) => {
  let child = fiber.child;
  while (child) {
    if (isHostFiber(child)) {
      traverseNode(child, child.stateNode as Element, nodes);
    } else if (isCompositeFiber(child)) {
      traverseNode(child, null, nodes);
    } else {
      // For other fiber types (e.g. text), traverse their children
      traverseNode(child, null, nodes);
    }
    child = child.sibling;
  }
};

export const getRectMap = (
  elements: Element[],
): Promise<Map<Element, DOMRect>> => {
  return new Promise((resolve) => {
    const rects = new Map<Element, DOMRect>();
    const observer = new IntersectionObserver((entries) => {
      for (let i = 0, len = entries.length; i < len; i++) {
        const entry = entries[i];
        const element = entry.target;
        const rect = entry.boundingClientRect;
        if (entry.isIntersecting && rect.width && rect.height) {
          rects.set(element, rect);
        }
      }
      observer.disconnect();
      resolve(rects);
    });

    for (let i = 0, len = elements.length; i < len; i++) {
      const element = elements[i];
      observer.observe(element);
    }
  });
};
