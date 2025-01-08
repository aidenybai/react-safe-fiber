import type { ReactDevToolsGlobalHook, ReactRenderer } from './types';

export const version = process.env.VERSION;
export const BIPPY_INSTRUMENTATION_STRING = `bippy-${version}`;

const NO_OP = () => {
  /**/
};

const checkDCE = (fn: unknown) => {
  try {
    const code = Function.prototype.toString.call(fn);
    if (code.indexOf('^_^') > -1) {
      setTimeout(() => {
        throw new Error(
          'React is running in production mode, but dead code ' +
            'elimination has not been applied. Read how to correctly ' +
            'configure React for production: ' +
            'https://reactjs.org/link/perf-use-production-build',
        );
      });
    }
  } catch {}
};

export const installRDTHook = (onActive?: () => unknown) => {
  const renderers = new Map<number, ReactRenderer>();
  let id = 0;

  const rdtHook: ReactDevToolsGlobalHook = {
    checkDCE,
    supportsFiber: true,
    supportsFlight: true,
    hasUnsupportedRendererAttached: false,
    renderers,
    onCommitFiberRoot: NO_OP,
    onCommitFiberUnmount: NO_OP,
    onPostCommitFiberRoot: NO_OP,
    inject(renderer) {
      const nextID = ++id;
      renderers.set(nextID, renderer);
      if (!rdtHook._instrumentationIsActive) {
        rdtHook._instrumentationIsActive = true;
        onActive?.();
      }
      return nextID;
    },
    _instrumentationSource: BIPPY_INSTRUMENTATION_STRING,
    _instrumentationIsActive: false,
  };

  try {
    Object.defineProperty(globalThis, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
      value: rdtHook,
    });
  } catch {}

  return rdtHook;
};

export const hasRDTHook = () => {
  return Object.prototype.hasOwnProperty.call(
    globalThis,
    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
  );
};

/**
 * Returns the current React DevTools global hook.
 */
export const getRDTHook = (onActive?: () => unknown) => {
  const rdtHook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (rdtHook) {
    onActive?.();
    return rdtHook;
  }
  return installRDTHook(onActive);
};

try {
  // __REACT_DEVTOOLS_GLOBAL_HOOK__ must exist before React is ever executed
  if (
    typeof window !== 'undefined' &&
    // @ts-expect-error `document` may not be defined in some enviroments
    (window.document?.createElement ||
      window.navigator?.product === 'ReactNative') &&
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  ) {
    installRDTHook();
  }
} catch {}
