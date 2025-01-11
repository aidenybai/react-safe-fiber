import {
  getDisplayName,
  getFiberFromHostInstance,
  traverseFiber,
  isInstrumentationActive,
  getRDTHook,
  detectReactBuildType,
  isCompositeFiber,
  getFiberStack,
  getFiberId,
  type Fiber,
  getNearestHostFiber,
} from './index.js';
import React, {
  useState,
  useEffect,
  type ReactNode,
  type MouseEvent,
} from 'react';
import {
  Inspector as ReactInspector,
  ObjectRootLabel,
  ObjectLabel,
} from 'react-inspector';

const FIBER_PROP_EXPLANATIONS: Record<string, string> = {
  tag: 'Numeric type identifier for this fiber (e.g. 1=FunctionComponent, 5=HostComponent)',
  elementType: 'The original function/class/element type',
  type: 'The resolved function/class after going through any HOCs',
  stateNode: 'Reference to the actual instance (DOM node, class instance, etc)',
  return: 'Parent fiber',
  child: 'First child fiber',
  sibling: 'Next sibling fiber',
  index: 'Position among siblings',
  ref: 'Ref object or function',
  pendingProps: 'Props that are about to be applied',
  memoizedProps: 'Props from the last render',
  memoizedState: 'State from the last render',
  dependencies: 'Context and other dependencies this fiber subscribes to',
  flags: 'Side-effects flags (e.g. needs update, deletion)',
  lanes: 'Priority lanes for updates',
  childLanes: 'Priority lanes for child updates',
};

// biome-ignore lint/suspicious/noExplicitAny: OK
const throttle = (fn: (...args: any[]) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown) {
    if (!timeout) {
      timeout = setTimeout(() => {
        // biome-ignore lint/style/noArguments: perf
        fn.apply(this, arguments as unknown as unknown[]);
        timeout = null;
      }, wait);
    }
  };
};

export interface InspectorProps {
  enabled?: boolean;
  children?: ReactNode;
  dangerouslyRunInProduction?: boolean;
}

const isMac =
  typeof navigator !== 'undefined' &&
  navigator.platform.toLowerCase().includes('mac');

export const Inspector = ({
  enabled = true,
  dangerouslyRunInProduction = false,
}: InspectorProps) => {
  const [element, setElement] = useState<Element | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isDialogMode, setIsDialogMode] = useState(false);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [selectedFiber, setSelectedFiber] = useState<Fiber | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const getFiberForDisplay = () => {
    if (selectedFiber) return selectedFiber;
    const fiber = getFiberFromHostInstance(element);
    if (!fiber) return null;
    return fiber.return && isCompositeFiber(fiber.return)
      ? fiber.return
      : fiber;
  };

  const handlePropertyHover = (
    _e: MouseEvent<HTMLElement>,
    propName: string,
  ) => {
    if (!isDialogMode) return;

    const explanation = FIBER_PROP_EXPLANATIONS[propName];
    setTooltip(explanation || null);
  };

  const handlePropertyLeave = () => {
    setTooltip(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'o' && (e.metaKey || e.ctrlKey) && rect) {
        e.preventDefault();
        setIsDialogMode(true);
      } else if (e.key === 'Escape' && isDialogMode) {
        setIsDialogMode(false);
        setTooltip(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rect, isDialogMode]);

  useEffect(() => {
    if (!isDialogMode) {
      setTooltip(null);
    }
  }, [isDialogMode]);

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (isDialogMode) return;

      const isActive = isInstrumentationActive();
      if (!isActive) {
        setIsActive(false);
        return;
      }

      if (!dangerouslyRunInProduction) {
        const rdtHook = getRDTHook();
        for (const renderer of rdtHook.renderers.values()) {
          const buildType = detectReactBuildType(renderer);
          if (buildType === 'production') {
            setIsActive(false);
            return;
          }
        }
      }

      if (!enabled) {
        setElement(null);
        setRect(null);
        setSelectedFiber(null);
        return;
      }
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (!element) return;
      setElement(element);
      setRect(element.getBoundingClientRect());
      setSelectedFiber(null);
    };

    const throttledMouseMove = throttle(handleMouseMove, 16);

    document.addEventListener('mousemove', throttledMouseMove);
    return () => {
      document.removeEventListener('mousemove', throttledMouseMove);
    };
  }, [enabled, isDialogMode, dangerouslyRunInProduction]);

  useEffect(() => {
    if (!rect) return;

    const padding = 10;
    const inspectorWidth = 400;
    const inspectorHeight = 320;

    let left = rect.left + rect.width + padding;
    let top = rect.top;

    if (left + inspectorWidth > window.innerWidth) {
      left = Math.max(padding, rect.left - inspectorWidth - padding);
    }

    if (top >= rect.top && top <= rect.bottom) {
      if (rect.bottom + inspectorHeight + padding <= window.innerHeight) {
        top = rect.bottom + padding;
      } else if (rect.top - inspectorHeight - padding >= 0) {
        top = rect.top - inspectorHeight - padding;
      } else {
        top = window.innerHeight - inspectorHeight - padding;
      }
    }

    top = Math.max(
      padding,
      Math.min(top, window.innerHeight - inspectorHeight - padding),
    );
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - inspectorWidth - padding),
    );

    setPosition({ top, left });
  }, [rect]);

  useEffect(() => {
    if (selectedFiber) {
      const element = getNearestHostFiber(selectedFiber)?.stateNode;
      if (element) {
        setElement(element);
        setRect(element.getBoundingClientRect());
      }
    }
  }, [selectedFiber]);

  if (window.innerWidth < 800 || !rect || !isActive) return null;

  const fiber = getFiberForDisplay();
  if (!fiber) return null;

  let foundInspect = false;
  traverseFiber(
    fiber,
    (innerFiber) => {
      if (innerFiber.type === Inspector) {
        foundInspect = true;
        return true;
      }
    },
    true,
  );
  if (foundInspect) return null;

  const dialogStyle = isDialogMode
    ? ({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80vw',
        height: '80vh',
        maxWidth: 'none',
        maxHeight: 'none',
        padding: '2ch',
        boxShadow: '0 0 0 5px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
      } as const)
    : {};

  const overlayStyle = isDialogMode
    ? ({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 999,
      } as const)
    : {};

  const fiberStack = fiber ? getFiberStack(fiber) : [];

  return (
    <>
      {isDialogMode && (
        <div
          style={overlayStyle}
          onClick={() => setIsDialogMode(false)}
          onKeyDown={(e) => e.key === 'Escape' && setIsDialogMode(false)}
          role="button"
          tabIndex={0}
        />
      )}
      <div
        style={{
          position: 'fixed',
          backgroundColor: 'white',
          zIndex: 50,
          padding: '1ch',
          width: '50ch',
          height: '40ch',
          transition: 'all 150ms',
          overflow: 'visible',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          border: '1px solid black',
          top: position.top,
          left: position.left,
          opacity: rect ? 1 : 0,
          transform: rect ? 'translateY(0)' : 'translateY(10px)',
          pointerEvents: rect ? 'auto' : 'none',
          display: 'flex',
          flexDirection: 'column',
          ...dialogStyle,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1ch',
          }}
        >
          <h3
            style={{
              fontSize: '0.875rem',
              backgroundColor: '#f5f5f5',
              padding: '0 0.5ch',
              borderRadius: '0.125rem',
              width: 'fit-content',
              margin: 0,
            }}
          >
            {`<${typeof fiber.type === 'string' ? fiber.type : getDisplayName(fiber.type) || 'unknown'}>`}
            {!isDialogMode && (
              <span
                style={{ marginLeft: '1ch', opacity: 0.5, fontSize: '0.75rem' }}
              >
                {`Press ${isMac ? '⌘' : 'ctrl'}O to expand`}
              </span>
            )}
          </h3>
          {isDialogMode && fiber.child && (
            <div
              style={{
                marginTop: '1ch',
                marginBottom: '1ch',
                marginRight: 'auto',
                marginLeft: '1ch',
                fontSize: '0.75rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5ch',
              }}
            >
              <span style={{ opacity: 0.5 }}>Children:</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5ch' }}>
                {(() => {
                  const children: Fiber[] = [];
                  let currentChild = fiber.child as Fiber | null;
                  while (currentChild !== null) {
                    children.push(currentChild);
                    currentChild = currentChild.sibling;
                  }
                  return children.map((child) => {
                    const name =
                      typeof child.type === 'string'
                        ? child.type
                        : getDisplayName(child.type) || 'unknown';
                    return (
                      <button
                        key={getFiberId(child)}
                        type="button"
                        onClick={() => {
                          setSelectedFiber(child);
                          const element = getNearestHostFiber(child)?.stateNode;
                          if (element) {
                            setElement(element);
                            setRect(element.getBoundingClientRect());
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedFiber(child);
                            const element =
                              getNearestHostFiber(child)?.stateNode;
                            if (element) {
                              setElement(element);
                              setRect(element.getBoundingClientRect());
                            }
                          }
                        }}
                        style={{
                          cursor: 'pointer',
                          padding: '0 0.5ch',
                          background: '#f5f5f5',
                          border: '1px solid #eee',
                          borderRadius: '0.125rem',
                          fontSize: 'inherit',
                          color: '#666',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#000';
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.borderColor = '#000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f5f5f5';
                          e.currentTarget.style.color = '#666';
                          e.currentTarget.style.borderColor = '#eee';
                        }}
                      >
                        {name}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}
          {isDialogMode && (
            <button
              type="button"
              onClick={() => setIsDialogMode(false)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: '0.5ch',
                fontSize: '2ch',
                opacity: 0.5,
              }}
            >
              ×
            </button>
          )}
        </div>
        {isDialogMode && (
          <div
            style={{
              borderTop: '1px solid #eee',
              padding: '0.5ch 0',
              fontSize: '0.75rem',
              color: '#666',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: '2ch',
            }}
          >
            {fiberStack.reverse().map((f, i, arr) => {
              const name =
                typeof f.type === 'string'
                  ? f.type
                  : getDisplayName(f.type) || 'unknown';
              if (!name) return null;
              return (
                <React.Fragment key={getFiberId(f)}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFiber(f);
                      const element = getNearestHostFiber(f)?.stateNode;
                      if (element) {
                        setElement(element);
                        setRect(element.getBoundingClientRect());
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedFiber(f);
                        const element = getNearestHostFiber(f)?.stateNode;
                        if (element) {
                          setElement(element);
                          setRect(element.getBoundingClientRect());
                        }
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      color: '#666',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#000';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '';
                      e.currentTarget.style.color = '#666';
                    }}
                  >
                    {name}
                  </button>
                  {i < arr.length - 1 && ' > '}
                </React.Fragment>
              );
            })}
          </div>
        )}
        <div
          onMouseLeave={handlePropertyLeave}
          style={{
            flex: 1,
            overflow: 'auto',
          }}
        >
          <ReactInspector
            data={fiber}
            expandLevel={1}
            table={false}
            nodeRenderer={(props: {
              depth: number;
              name: string;
              data: unknown;
              isNonenumerable?: boolean;
              expanded?: boolean;
            }) => {
              const Component =
                props.depth === 0 ? ObjectRootLabel : ObjectLabel;
              return (
                <span
                  onMouseEnter={(e) => handlePropertyHover(e, props.name)}
                  onMouseLeave={handlePropertyLeave}
                  style={{
                    cursor: FIBER_PROP_EXPLANATIONS[props.name]
                      ? 'help'
                      : 'default',
                    padding: '1px 0',
                    display: 'inline-block',
                    fontWeight: FIBER_PROP_EXPLANATIONS[props.name]
                      ? 500
                      : 'normal',
                  }}
                >
                  <Component
                    name={props.name}
                    data={props.data}
                    isNonenumerable={props.isNonenumerable}
                  />
                </span>
              );
            }}
          />
        </div>
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              zIndex: 1001,
              backgroundColor: '#000',
              color: 'white',
              bottom: '2ch',
              right: '2ch',
              pointerEvents: 'none',
              overflowY: 'auto',
              padding: '1ch',
              fontSize: '1ch',
            }}
          >
            {tooltip}
          </div>
        )}
      </div>
      {!isDialogMode && (
        <div
          style={{
            position: 'fixed',
            zIndex: 40,
            pointerEvents: 'none',
            transition: 'all 150ms',
            border: '1px dashed #a3a3a3',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            opacity: rect ? 1 : 0,
          }}
        />
      )}
    </>
  );
};

export default Inspector;
