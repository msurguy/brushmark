import { defineConfig, type Plugin } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

// Import vendored p5.brush GLSL shaders as plain strings (replaces the
// rollup-plugin-glslify step of upstream p5.brush's own build — the shaders
// use no glslify pragmas).
function glslRaw(): Plugin {
  return {
    name: "glsl-raw",
    enforce: "pre",
    transform(_code, id) {
      if (/\.(vert|frag|glsl)$/.test(id)) {
        const src = readFileSync(id, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .split("\n")
          .map((l) => l.replace(/\/\/.*$/, "").trim())
          .filter(Boolean)
          .join("\n");
        return { code: `export default ${JSON.stringify(src)};`, map: null };
      }
    },
  };
}

// `vite` / `vite dev`  → demo MPA (vanilla + react pages)
// `vite build --mode lib` → library build (ESM, two entries)
export default defineConfig(({ mode }) => {
  const common = {
    plugins: [glslRaw(), react()],
    resolve: {
      alias: [
        { find: /^brushmark\/react$/, replacement: resolve(__dirname, "src/react/index.ts") },
        { find: /^brushmark\/gsap$/, replacement: resolve(__dirname, "src/animation/gsap.ts") },
        { find: /^brushmark\/anime$/, replacement: resolve(__dirname, "src/animation/anime.ts") },
        { find: /^brushmark$/, replacement: resolve(__dirname, "src/index.ts") },
        // Vendored p5.brush standalone build (see vendor/p5.brush/README.md).
        {
          find: /^p5\.brush\/standalone$/,
          replacement: resolve(__dirname, "vendor/p5.brush/src/index.standalone.js"),
        },
      ],
    },
  };

  if (mode === "lib") {
    return {
      ...common,
      plugins: [...common.plugins, dts({ rollupTypes: false, include: ["src"] })],
      build: {
        lib: {
          entry: {
            brushmark: resolve(__dirname, "src/index.ts"),
            react: resolve(__dirname, "src/react/index.ts"),
            gsap: resolve(__dirname, "src/animation/gsap.ts"),
            anime: resolve(__dirname, "src/animation/anime.ts"),
          },
          formats: ["es"] as const,
        },
        rollupOptions: {
          external: ["gsap", "animejs", "react", "react-dom", "react/jsx-runtime"],
        },
      },
    };
  }

  return {
    ...common,
    root: resolve(__dirname, "demo"),
    // GitHub Pages serves the demo from /brushmark/ — the deploy workflow
    // sets DEMO_BASE; local dev/build stay at "/".
    base: process.env.DEMO_BASE || "/",
    build: {
      // Demo only: the engine switcher uses top-level await for dynamic
      // adapter imports.
      target: "es2022",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "demo/index.html"),
          vanilla: resolve(__dirname, "demo/vanilla/index.html"),
          react: resolve(__dirname, "demo/react/index.html"),
        },
      },
    },
  };
});
