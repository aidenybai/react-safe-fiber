import type { ReactDevToolsGlobalHook } from './index.js';

declare global {
  // eslint-disable-next-line no-var
  var __REACT_DEVTOOLS_GLOBAL_HOOK__: ReactDevToolsGlobalHook;
  // eslint-disable-next-line no-var
  var __REACT_DEVTOOLS_BACKEND_MANAGER_INJECTED__: boolean | undefined;
}

export {};
