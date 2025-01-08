import { defineConfig } from 'vite';
import type { LibraryFormats, LibraryOptions } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';
import svgSpritePlugin from '@pivanov/vite-plugin-svg-sprite';

const banner = `/**
* Copyright 2024 Aiden Bai, Million Software, Inc.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy of this software
* and associated documentation files (the “Software”), to deal in the Software without restriction,
* including without limitation the rights to use, copy, modify, merge, publish, distribute,
* sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all copies or
* substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
* BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
* DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/`;

// Configuration for scan package
const config = {
  plugins: [
    dts({
      outDir: '../bippy/dist/scan',
      include: ['src/**/*.ts', '../bippy/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      rollupTypes: true,
      copyDtsFiles: false,
      insertTypesEntry: true,
      compilerOptions: {
        emitDeclarationOnly: true,
        preserveSymlinks: false,
        skipLibCheck: true,
        composite: false,
        declaration: true,
        declarationMap: false,
        incremental: false,
        baseUrl: '.',
        paths: {
          '~assets/*': ['./src/assets/*'],
          '~core/*': ['./src/core/*'],
          '~web/*': ['./src/web/*'],
          '*.worker': ['./src/*.worker.ts'],
          bippy: ['../bippy/src'],
        },
      },
      beforeWriteFile: (filePath, content) => {
        if (filePath.endsWith('.d.ts')) {
          return {
            filePath,
            content,
          };
        }
        return false;
      },
    }),
    tsconfigPaths(),
    svgSpritePlugin({
      iconDirs: [resolve(process.cwd(), 'src/web/assets/svgs')],
      symbolId: '[dir]-[name]',
      svgDomId: 'svg-sprite',
    }),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env.VERSION': JSON.stringify(process.env.npm_package_version),
  },
  resolve: {
    dedupe: ['preact', '@preact/signals'],
    mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
  },
  optimizeDeps: {
    include: ['preact', '@preact/signals'],
    exclude: ['./src/outlines/offscreen-canvas.worker'],
  },
  build: {
    outDir: '../bippy/dist/scan',
    target: 'esnext',
    sourcemap: false,
    minify: process.env.NODE_ENV === 'production',
    emptyOutDir: false,
    lib: {
      formats: ['es', 'cjs', 'iife'] as LibraryFormats[],
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ReactScan',
      fileName: (format) => {
        if (format === 'es') return 'index.js';
        if (format === 'cjs') return 'index.cjs';
        return 'index.global.js';
      },
    } satisfies LibraryOptions,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-reconciler',
        'next',
        'next/navigation',
        'react-router',
        'react-router-dom',
        '@remix-run/react',
      ],
      treeshake: false,
      output: {
        banner: `'use client';\n${banner}`,
        globals: {
          bippy: 'Bippy',
        },
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
        },
        preserveModules: false,
        minifyInternalExports: true,
        compact: true,
        hoistTransitiveImports: false,
        assetFileNames: 'assets/[name][extname]',
      },
    },
    worker: {
      format: 'iife',
      plugins: [],
      rollupOptions: {
        output: {
          format: 'iife',
          name: 'OffscreenCanvasWorker',
        },
      },
      inline: true,
    },
  },
};

export default defineConfig(config);
