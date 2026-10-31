/**
 * Bundles the widget into a single drop-in IIFE at
 * `dist/neetix-edge-widget.js`, exposing the global `NeetixCapture`.
 *
 * Usage:  node build.mjs           (minified production bundle)
 *         node build.mjs --dev     (readable, unminified)
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes("--dev");

const result = await build({
  entryPoints: [resolve(__dirname, "src/index.ts")],
  outfile: resolve(__dirname, "dist/neetix-edge-widget.js"),
  bundle: true,
  format: "iife",
  globalName: "NeetixCapture",
  platform: "browser",
  target: ["es2020", "chrome90", "firefox90", "safari15"],
  minify: !dev,
  sourcemap: dev,
  legalComments: "none",
  metafile: true,
  banner: {
    js: "/*! @neetix/edge-widget — on-device guided face capture. Apache-2.0. https://liveliness.neetix.in/edge/ */",
  },
});

const out = Object.entries(result.metafile.outputs).find(([f]) =>
  f.endsWith("neetix-edge-widget.js"),
);
const bytes = out ? out[1].bytes : 0;
console.log(
  `built dist/neetix-edge-widget.js — ${(bytes / 1024).toFixed(1)} KB ${dev ? "(dev)" : "(min)"}`,
);
