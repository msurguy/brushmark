import { annotate } from "brushmark";
import { recipeById, recipeConfig } from "../vanilla/recipes";

// Isolated one-effect page used by scripts/capture.mjs to record README GIFs.
// It builds a single annotation, pauses its timeline, and exposes `__seek(t)`
// so the capture script can drive progress frame-by-frame (deterministic, not
// wall-clock) and screenshot #capture-frame at each step.

declare global {
  interface Window {
    __ready?: boolean;
    __seek?: (t: number) => void;
  }
}

const id = new URLSearchParams(location.search).get("id") ?? "underline";
const recipe = recipeById(id);
const target = document.getElementById("capture-target") as HTMLElement;
if (recipe) target.textContent = recipe.text;

async function main(): Promise<void> {
  if (!recipe) {
    window.__ready = true;
    return;
  }
  // Wait for the webfont so strokes fit the Patrick Hand glyphs, not fallbacks.
  await document.fonts.ready;

  const a = annotate(target, recipeConfig(recipe));
  a.prepare();
  a.timeline.pause(0);
  a.timeline.progress(0);

  window.__seek = (t: number) => {
    a.timeline.progress(Math.max(0, Math.min(1, t)));
  };

  // Let the compositor paint the (empty) t=0 frame before we signal readiness.
  await new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
  window.__ready = true;
}

void main();
