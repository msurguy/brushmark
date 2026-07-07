import type { AnnotationConfig } from "brushmark";

// Single source of truth for the "Recipes" section and the GIF capture page.
// Each recipe stores its config once as an object-literal STRING: the code we
// display is derived from it and the live preview / capture is executed from the
// same string, so the shown code and the running animation can never drift.

export interface Recipe {
  id: string;
  title: string;
  text: string;
  config: string;
}

export const RECIPES: Recipe[] = [
  {
    id: "underline",
    title: "Underline",
    text: "gather the pigments",
    config: `{
  type: "underline",
  brush: { name: "pen", color: "#c93030" },
  duration: 0.8,
  ease: "power2.out",
}`,
  },
  {
    id: "highlight",
    title: "Highlight (marker)",
    text: "lay down the wash",
    config: `{
  type: "highlight",
  brush: { name: "marker", color: "#f2c94c" },
  duration: 1.2,
}`,
  },
  {
    id: "circle",
    title: "Circle (rough passes)",
    text: "the key idea",
    config: `{
  type: "circle",
  brush: { name: "charcoal", color: "#5f3dc4" },
  iterations: 2,
  duration: 1,
}`,
  },
  {
    id: "box",
    title: "Box",
    text: "boxed in",
    config: `{
  type: "box",
  brush: { name: "HB", color: "#1f6feb" },
  padding: 5,
  duration: 0.9,
}`,
  },
  {
    id: "strike",
    title: "Strike-through",
    text: "cross this out",
    config: `{
  type: "strike-through",
  brush: { name: "2B", color: "#c93030" },
  duration: 0.7,
}`,
  },
  {
    id: "bracket",
    title: "Brackets",
    text: "hold this thought",
    config: `{
  type: "bracket",
  brackets: ["left", "right"],
  brush: { name: "2B", color: "#26221c" },
  duration: 0.8,
}`,
  },
  {
    id: "contour",
    title: "Contour (hand-drawn hull)",
    text: "wrap the whole phrase",
    config: `{
  type: "contour",
  brush: { name: "2B", color: "#c93030", weight: 1.4 },
  contour: { inflate: 6, roundness: 0.8 },
  duration: 1.4,
  ease: "power2.inOut",
}`,
  },
  {
    id: "watercolor",
    title: "Watercolor highlight",
    text: "bleeding pigment",
    config: `{
  type: "highlight",
  highlightStyle: "watercolor",
  brush: {
    fill: { color: "#74c0fc", opacity: 90, bleed: 0.2, texture: 0.5 },
  },
  duration: 1.4,
}`,
  },
  {
    id: "word-stagger",
    title: "Word-by-word stagger",
    text: "one word after another",
    config: `{
  type: "underline",
  brush: { name: "pen", color: "#c93030" },
  stagger: { by: "word" },
  duration: 1.2,
}`,
  },
  {
    id: "center-out",
    title: "Reveal from the center",
    text: "grows both directions",
    config: `{
  type: "highlight",
  brush: { name: "marker", color: "#8ce99a" },
  direction: "center-out",
  duration: 1,
}`,
  },
  {
    id: "loop",
    title: "Looping (repeat + yoyo)",
    text: "back and forth",
    config: `{
  type: "underline",
  brush: { name: "pen", color: "#c93030" },
  duration: 0.9,
  repeat: -1,
  yoyo: true,
}`,
  },
];

export const recipeById = (id: string): Recipe | undefined =>
  RECIPES.find((r) => r.id === id);

export const recipeShown = (r: Recipe): string =>
  `import { annotate } from "brushmark";\n\nannotate(el, ${r.config});`;

export const recipeConfig = (r: Recipe): AnnotationConfig =>
  new Function(`return (${r.config})`)() as AnnotationConfig;
