import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

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
    __VERSION__: `"v${
      JSON.parse(fs.readFileSync("../package.json", "utf8")).version
    }"`,
  },
  resolve:
    process.env.NODE_ENV === "production"
      ? {}
      : {
          alias: {
            bippy: path.resolve(__dirname, ".."),
          },
        },
});
