/// <reference types="vitest" />
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { dataRevision } from "./build/data-rev";

const DATA_REV = dataRevision("public/data");

/** The <link rel=preload> must request the exact URL the loader fetches, or the index downloads twice. */
const versionIndexPreload = (): Plugin => ({
  name: "oldcape-version-index-preload",
  transformIndexHtml: (html) => html.replace('href="/data/index.json"', `href="/data/index.json?r=${DATA_REV}"`),
});

export default defineConfig({
  build: { target: "es2022" },
  define: { __DATA_REV__: JSON.stringify(DATA_REV) },
  plugins: [versionIndexPreload()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "build/**/*.test.ts", "worker/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/data/**", "src/render/**"],
      exclude: ["src/**/*.test.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
