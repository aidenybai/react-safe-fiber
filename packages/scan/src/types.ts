type ReactScanInternals = typeof import('./core/index')['ReactScanInternals'];
type Scan = typeof import('./index')['scan'];

declare global {
  var __REACT_SCAN__: {
    ReactScanInternals: ReactScanInternals;
  };
  var reactScan: Scan;
  var scheduler: {
    postTask: (cb: unknown, options: { priority: string }) => void;
  };

  type TTimer = NodeJS.Timeout;

  interface Window {
    isReactScanExtension?: boolean;
    reactScan: Scan;
  }
}

export {};
