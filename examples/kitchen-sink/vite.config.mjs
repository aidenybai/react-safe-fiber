import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";

export default defineConfig({
	build: {
		minify: false,
	},
	plugins: [
		react({
			// babel: {
			//   plugins: [['babel-plugin-react-compiler', {}]],
			// },
		}),
		tailwindcss(),
	],
	define: {
		__VERSION__: `"v${JSON.parse(fs.readFileSync('../../package.json', 'utf8')).version}"`,
	},
	resolve:
		process.env.NODE_ENV === 'production'
			? {}
			: {
					alias: {
						bippy: path.resolve(__dirname, '../../packages/bippy/dist'),
					},
				},
});
