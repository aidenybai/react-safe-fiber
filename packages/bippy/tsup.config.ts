import fs from 'node:fs';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';
import { type Options, defineConfig } from 'tsup';

const banner = `/**
 * @license bippy
 *
 * Copyright (c) Aiden Bai, Million Software, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */`;

const DEFAULT_OPTIONS: Options = {
  entry: [],
  banner: {
    js: banner,
  },
  clean: false,
  outDir: './dist',
  splitting: false,
  sourcemap: false,
  format: [],
  target: 'esnext',
  platform: 'browser',
  treeshake: true,
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  minify: false,
  env: {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    VERSION: JSON.parse(fs.readFileSync('package.json', 'utf8')).version,
  },
  esbuildPlugins: [inlineWorkerPlugin()],
  external: ['react', 'react-dom', 'react-reconciler'],
};

export default defineConfig([
  {
    ...DEFAULT_OPTIONS,
    format: ['esm', 'cjs'],
    entry: ['./src/index.ts', './src/core.ts'],
  },
  {
    ...DEFAULT_OPTIONS,
    format: ['iife'],
    outDir: './dist',
    minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
    globalName: 'Bippy',
    entry: ['./src/index.ts'],
  },
]);
