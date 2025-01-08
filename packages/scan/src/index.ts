import 'bippy';
import { scan } from './core';

if (typeof window !== 'undefined') {
  scan();
  window.reactScan = scan;
}

export * from './core';
