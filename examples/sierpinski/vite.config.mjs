import path from "node:path";
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import Inspect from 'vite-plugin-inspect';

export default defineConfig({
  plugins: [
    react({
      // babel: {
      //   plugins: [['babel-plugin-react-compiler', {}]],
      // },
    }),
    Inspect(),
  ],
	resolve:
		process.env.NODE_ENV === 'production'
			? {}
			: {
					alias: {
						bippy: path.resolve(__dirname, '../../packages/bippy/dist'),
					},
				},
});
