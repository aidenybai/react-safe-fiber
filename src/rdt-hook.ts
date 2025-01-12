import type { ReactDevToolsGlobalHook, ReactRenderer } from './types.js';

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
  let i = 0;
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
      const nextID = ++i;
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
  } catch {
    patchRDTHook(onActive);
  }
  return rdtHook;
};

export const patchRDTHook = (onActive?: () => unknown) => {
  try {
    const currentRDTHook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    currentRDTHook.checkDCE = checkDCE;
    currentRDTHook.supportsFiber = true;
    currentRDTHook.supportsFlight = true;
    currentRDTHook.hasUnsupportedRendererAttached = false;
  } catch {}
  onActive?.();
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
  if (!hasRDTHook()) {
    return installRDTHook(onActive);
  }
  const rdtHook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  patchRDTHook(onActive);
  return rdtHook;
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

export const INSTALL_HOOK_SCRIPT_STRING =
  '(()=>{try{var t=()=>{};const n=new Map;let o=0;globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__={checkDCE:t,supportsFiber:!0,supportsFlight:!0,hasUnsupportedRendererAttached:!1,renderers:n,onCommitFiberRoot:t,onCommitFiberUnmount:t,onPostCommitFiberRoot:t,inject(t){var e=++o;return n.set(e,t),globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__._instrumentationIsActive=!0,e},_instrumentationIsActive:!1}}catch{}})();';
