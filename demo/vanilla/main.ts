import {
  annotate,
  annotationGroup,
  listBrushes,
  registerBrush,
  setAnimationEngine,
  type AnnotationConfig,
  type AnnotationType,
  type BrushAnnotation,
} from "brushmark";
import { RECIPES, recipeConfig, recipeShown } from "./recipes";

const $ = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector(sel) as T;

// ---------------------------------------------------------------------------
// Engine switcher — ?engine=builtin|gsap|anime (annotations capture the
// engine at creation time, so switching reloads the page). The adapters are
// dynamically imported so the default bundle stays gsap/anime-free.
// ---------------------------------------------------------------------------

const engineName = new URLSearchParams(location.search).get("engine") ?? "builtin";
if (engineName === "gsap") {
  setAnimationEngine((await import("brushmark/gsap")).gsapEngine);
} else if (engineName === "anime") {
  setAnimationEngine((await import("brushmark/anime")).animeEngine);
}

document.querySelectorAll<HTMLButtonElement>("#engine-switch button").forEach((b) => {
  if (b.dataset.engine === engineName) b.classList.add("active");
  b.addEventListener("click", () => {
    location.search = b.dataset.engine === "builtin" ? "" : `?engine=${b.dataset.engine}`;
  });
});

// Count GL context creations (before any annotation renders) to prove the
// single-context architecture in the stress section.
let glContexts = 0;
const glCanvases = new WeakSet<HTMLCanvasElement>();
const origGetContext = HTMLCanvasElement.prototype.getContext;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(HTMLCanvasElement.prototype as any).getContext = function (
  this: HTMLCanvasElement,
  kind: string,
  ...args: unknown[]
) {
  if ((kind === "webgl2" || kind === "webgl") && !glCanvases.has(this)) {
    glCanvases.add(this);
    glContexts++;
  }
  return (origGetContext as (this: HTMLCanvasElement, ...a: unknown[]) => unknown).call(
    this,
    kind,
    ...args,
  );
};

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

const heroContour = annotate($("#hero-target"), {
  type: "contour",
  brush: { name: "2B", color: "#c93030", weight: 1.4 },
  duration: 1.4,
  ease: "power2.inOut",
  delay: 0.4,
});
const ledeHighlight = annotate($("#lede-highlight"), {
  type: "highlight",
  brush: { name: "marker", color: "#f2c94c" },
  duration: 1.2,
  delay: 1.6,
});
void heroContour.show();
void ledeHighlight.show();

// ---------------------------------------------------------------------------
// Recipes — every card shows the exact annotate() call that paints its preview.
// The config is stored once as an object-literal string: the displayed code is
// derived from it and the live preview is executed from the SAME string, so the
// two can never drift.
// ---------------------------------------------------------------------------

// Load highlight.js from the CDN as a plain <script> (UMD → window.hljs) so
// Vite never tries to resolve it; degrade to plain monospace if it fails.
type Hljs = { highlightElement: (el: HTMLElement) => void };
const hljs = await new Promise<Hljs | null>((resolve) => {
  const w = window as unknown as { hljs?: Hljs };
  if (w.hljs) return resolve(w.hljs);
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.10.0/build/highlight.min.js";
  s.onload = () => resolve(w.hljs ?? null);
  s.onerror = () => resolve(null);
  document.head.appendChild(s);
});

const recipeGrid = $("#recipe-grid");

for (const recipe of RECIPES) {
  const card = document.createElement("div");
  card.className = "recipe";
  card.innerHTML = `
    <div class="preview">
      <span class="recipe-title">${recipe.title}</span>
      <span class="target">${recipe.text}</span>
      <div class="recipe-actions">
        <button class="replay-one">Replay</button>
        <button class="copy">Copy</button>
      </div>
    </div>
    <div class="code"><pre><code class="language-typescript"></code></pre></div>
  `;
  recipeGrid.appendChild(card);

  const codeEl = card.querySelector("code") as HTMLElement;
  const source = recipeShown(recipe);
  codeEl.textContent = source;
  hljs?.highlightElement(codeEl);

  const target = card.querySelector(".target") as HTMLElement;
  const annotation = annotate(target, recipeConfig(recipe));
  void annotation.show();

  card.querySelector(".replay-one")!.addEventListener("click", () => {
    void annotation.hide("instant").then(() => annotation.show());
  });

  const copyBtn = card.querySelector(".copy") as HTMLButtonElement;
  copyBtn.addEventListener("click", () => {
    void navigator.clipboard.writeText(source).then(() => {
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 1200);
    });
  });
}

// Sequencing recipe — annotationGroup chains child timelines into one master.
const sequenceContainer = $("#recipe-sequence");
const SEQUENCE_CODE = `import { annotate, annotationGroup } from "brushmark";

const group = annotationGroup([
  annotate(one,   { type: "underline",      brush: { name: "pen",     color: "#c93030" } }),
  annotate(two,   { type: "highlight",      brush: { name: "marker",  color: "#f2c94c" } }),
  annotate(three, { type: "strike-through", brush: { name: "2B",      color: "#c93030" } }),
], { overlap: 0.15 });

group.show();                 // plays the children one after another
group.timeline.progress(0.5); // …or scrub the master timeline`;

sequenceContainer.innerHTML = `
  <div class="preview">
    <span class="recipe-title">Sequencing (annotationGroup)</span>
    <p>First <span id="rseq-1">gather the pigments</span>, then
      <span id="rseq-2">lay down the wash</span>, and finally
      <span id="rseq-3">cross out the doubts</span>.</p>
    <div class="recipe-actions">
      <button class="replay-one" id="rseq-play">Replay</button>
      <button class="copy" id="rseq-copy">Copy</button>
    </div>
  </div>
  <div class="code"><pre><code class="language-typescript"></code></pre></div>
`;

const seqCodeEl = sequenceContainer.querySelector("code") as HTMLElement;
seqCodeEl.textContent = SEQUENCE_CODE;
hljs?.highlightElement(seqCodeEl);

const recipeSequence = annotationGroup(
  [
    annotate($("#rseq-1"), { type: "underline", brush: { name: "pen", color: "#c93030" }, duration: 0.7 }),
    annotate($("#rseq-2"), { type: "highlight", brush: { name: "marker", color: "#f2c94c" }, duration: 0.9 }),
    annotate($("#rseq-3"), { type: "strike-through", brush: { name: "2B", color: "#c93030" }, duration: 0.7 }),
  ],
  { overlap: 0.15 },
);
void recipeSequence.show();

$("#rseq-play").addEventListener("click", () => {
  recipeSequence.hide();
  void recipeSequence.show();
});
const rseqCopy = $("#rseq-copy") as HTMLButtonElement;
rseqCopy.addEventListener("click", () => {
  void navigator.clipboard.writeText(SEQUENCE_CODE).then(() => {
    rseqCopy.textContent = "Copied!";
    rseqCopy.classList.add("copied");
    setTimeout(() => {
      rseqCopy.textContent = "Copy";
      rseqCopy.classList.remove("copied");
    }, 1200);
  });
});

// ---------------------------------------------------------------------------
// Types showcase
// ---------------------------------------------------------------------------

const TYPES: AnnotationType[] = [
  "underline",
  "highlight",
  "box",
  "circle",
  "contour",
  "strike-through",
  "crossed-off",
  "bracket",
];

const typeAnnotations: BrushAnnotation[] = [];
const typeGrid = $("#type-grid");
for (const type of TYPES) {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.innerHTML = `<span class="label">${type}</span><span class="target">paint over plain text</span>`;
  typeGrid.appendChild(cell);
  const config: AnnotationConfig = {
    type,
    brush: {
      name: type === "highlight" ? "marker" : "HB",
      color: type === "highlight" ? "#7ec8e3" : "#c93030",
      weight: 1.2,
    },
    duration: 0.9,
    iterations: type === "circle" ? 2 : 1,
    brackets: ["left", "right"],
  };
  typeAnnotations.push(annotate(cell.querySelector(".target") as HTMLElement, config));
}

function replayAll(annotations: BrushAnnotation[], staggerSec = 0.12): void {
  annotations.forEach((a, i) => {
    void a.hide("instant").then(() => {
      setTimeout(() => void a.show(), i * staggerSec * 1000);
    });
  });
}

$("#replay-types").addEventListener("click", () => replayAll(typeAnnotations));
replayAll(typeAnnotations, 0.15);

// ---------------------------------------------------------------------------
// Brush gallery — every built-in + a custom registered brush
// ---------------------------------------------------------------------------

registerBrush("demo-ink", {
  type: "custom",
  weight: 0.9,
  vibration: 0.14,
  opacity: 60,
  spacing: 0.6,
  blend: true,
  pressure: { type: "standard", min_max: [1.35, 1], curve: [0.35, 0.25] },
  tip: (ctx: { rotate: (a: number) => void; rect: (...a: number[]) => void }) => {
    ctx.rotate(Math.PI / 4); // standalone build is always radians
    ctx.rect(-1.5, -1.5, 3, 3);
    ctx.rect(1, 1, 1, 1);
  },
  rotate: "natural",
});

const gallery = $("#gallery");
const galleryAnnotations: BrushAnnotation[] = [];
for (const name of [...listBrushes(), "demo-ink"].filter((v, i, a) => a.indexOf(v) === i)) {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.innerHTML = `<span class="label">${name}</span><span class="target">a line of honest ink</span>`;
  gallery.appendChild(cell);
  galleryAnnotations.push(
    annotate(cell.querySelector(".target") as HTMLElement, {
      type: "underline",
      brush: { name, color: "#3a3630", weight: 1.3 },
      duration: 0.8,
    }),
  );
}
$("#replay-gallery").addEventListener("click", () => replayAll(galleryAnnotations, 0.08));
replayAll(galleryAnnotations, 0.08);

// ---------------------------------------------------------------------------
// Contour
// ---------------------------------------------------------------------------

const contour = annotate($("#contour-target"), {
  type: "contour",
  brush: { name: "charcoal", color: "#4c6ef5", weight: 1.2 },
  duration: 1.6,
  ease: "power1.inOut",
  contour: { roundness: 0.9, irregularity: 1.2 },
});
void contour.show();
$("#replay-contour").addEventListener("click", () => {
  void contour.hide("instant").then(() => void contour.show());
});

// ---------------------------------------------------------------------------
// Animation lab
// ---------------------------------------------------------------------------

const labBrushSelect = $("#lab-brush") as unknown as HTMLSelectElement;
for (const name of [...listBrushes(), "demo-ink"].filter((v, i, a) => a.indexOf(v) === i)) {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  if (name === "2B") opt.selected = true;
  labBrushSelect.appendChild(opt);
}

let labAnnotation: BrushAnnotation | null = null;
let labSeed = 1234;

function labConfig(): AnnotationConfig {
  const staggerBy = ($("#lab-stagger") as unknown as HTMLSelectElement).value;
  const yoyo = ($("#lab-yoyo") as unknown as HTMLInputElement).checked;
  return {
    type: ($("#lab-type") as unknown as HTMLSelectElement).value as AnnotationType,
    brush: {
      name: labBrushSelect.value,
      color: ($("#lab-color") as unknown as HTMLInputElement).value,
      weight: Number(($("#lab-weight") as unknown as HTMLInputElement).value),
      wiggle: Number(($("#lab-wiggle") as unknown as HTMLInputElement).value) || false,
    },
    duration: Number(($("#lab-duration") as unknown as HTMLInputElement).value),
    ease: ($("#lab-ease") as unknown as HTMLSelectElement).value,
    direction: ($("#lab-direction") as unknown as HTMLSelectElement).value as
      | "ltr"
      | "rtl"
      | "center-out",
    stagger: staggerBy ? { by: staggerBy as "line" | "word" } : false,
    iterations: Number(($("#lab-iterations") as unknown as HTMLInputElement).value),
    repeat: yoyo ? -1 : 0,
    yoyo,
    brackets: ["left", "right"],
    seed: labSeed,
  };
}

function runLab(): void {
  labAnnotation?.remove();
  labAnnotation = annotate($("#lab-target"), labConfig());
  void labAnnotation.show();
}

$("#lab-run").addEventListener("click", runLab);
$("#lab-reverse").addEventListener("click", () => void labAnnotation?.hide("reverse"));
$("#lab-seed").addEventListener("click", () => {
  labSeed = Math.floor(Math.random() * 1e9);
  runLab();
});
runLab();

// ---------------------------------------------------------------------------
// Responsive
// ---------------------------------------------------------------------------

const responsive = annotate($("#responsive-target"), {
  type: "highlight",
  brush: { name: "marker", color: "#ffd43b" },
  duration: 1.2,
  stagger: { by: "line" },
});
const responsiveUnderline = annotate($("#responsive-target"), {
  type: "box",
  brush: { name: "2B", color: "#c93030", weight: 1 },
  duration: 1,
  delay: 0.9,
});
void responsive.show();
void responsiveUnderline.show();

document.querySelectorAll<HTMLButtonElement>("#responsive .controls-row button").forEach((b) =>
  b.addEventListener("click", () => {
    $("#responsive-target").style.fontSize = `${b.dataset.font}px`;
  }),
);

// ---------------------------------------------------------------------------
// Sequencing + scrub
// ---------------------------------------------------------------------------

const seq = annotationGroup(
  [
    annotate($("#seq-1"), {
      type: "underline",
      brush: { name: "pen", color: "#2b8a3e", weight: 1.4 },
      duration: 0.7,
    }),
    annotate($("#seq-2"), {
      type: "highlight",
      brush: { name: "marker", color: "#ffa8a8" },
      duration: 0.9,
    }),
    annotate($("#seq-3"), {
      type: "strike-through",
      brush: { name: "charcoal", color: "#495057", weight: 1.6 },
      duration: 0.7,
    }),
  ],
  { overlap: 0.15 },
);

$("#seq-play").addEventListener("click", () => void seq.show());
const scrub = $("#seq-scrub") as unknown as HTMLInputElement;
scrub.addEventListener("input", () => {
  seq.timeline.pause();
  for (const a of seq.annotations) (a as { beginShowing?: () => void }).beginShowing?.();
  seq.timeline.progress(Number(scrub.value));
});

// ---------------------------------------------------------------------------
// Watercolor & hatch — permutation galleries
// ---------------------------------------------------------------------------

interface WcCell {
  label: string;
  text?: string;
  config: AnnotationConfig;
}

const wash = (label: string, fill: NonNullable<AnnotationConfig["brush"]>["fill"]): WcCell => ({
  label,
  config: { type: "highlight", highlightStyle: "watercolor", brush: { fill }, duration: 1.2 },
});

const WASH_CELLS: WcCell[] = [
  wash("bleed 0.05 · tight", { color: "#74c0fc", opacity: 90, bleed: 0.05, texture: 0.5 }),
  wash("bleed 0.2", { color: "#74c0fc", opacity: 90, bleed: 0.2, texture: 0.5 }),
  wash("bleed 0.45 · runny", { color: "#74c0fc", opacity: 90, bleed: 0.45, texture: 0.5 }),
  wash("texture 0.1 · flat", { color: "#69db7c", opacity: 90, bleed: 0.15, texture: 0.1 }),
  wash("texture 0.95 · granular", { color: "#69db7c", opacity: 90, bleed: 0.15, texture: 0.95 }),
  wash("opacity 45 · dilute", { color: "#f783ac", opacity: 45, bleed: 0.2, texture: 0.6 }),
  wash("opacity 130 · loaded", { color: "#f783ac", opacity: 130, bleed: 0.2, texture: 0.6 }),
  wash("border 0.9 · pooled edge", { color: "#ffd43b", opacity: 95, bleed: 0.25, texture: 0.7, border: 0.9 }),
];

const SHAPE_CELLS: WcCell[] = [
  {
    label: "box + wash",
    config: {
      type: "box",
      brush: { name: "pen", color: "#1971c2", weight: 1, fill: { color: "#a5d8ff", opacity: 80, bleed: 0.2 } },
      duration: 1.6,
    },
  },
  {
    label: "circle + wash",
    config: {
      type: "circle",
      brush: { name: "2B", color: "#2b8a3e", weight: 1.2, fill: { color: "#8ce99a", opacity: 115, bleed: 0.25 } },
      duration: 1.6,
    },
  },
  {
    label: "contour + wash",
    text: "a soft wash pooling inside a hand-drawn hull",
    config: {
      type: "contour",
      brush: { name: "charcoal", color: "#c92a2a", weight: 1, fill: { color: "#ffa8a8", opacity: 110, bleed: 0.3 } },
      duration: 1.8,
    },
  },
  {
    label: "wash only · weight 0",
    config: {
      type: "box",
      brush: { weight: 0, fill: { color: "#b197fc", opacity: 110, bleed: 0.35, texture: 0.8 } },
      duration: 1.4,
    },
  },
];

const hatchBox = (label: string, hatch: NonNullable<AnnotationConfig["brush"]>["hatch"], color = "#e8590c"): WcCell => ({
  label,
  config: {
    type: "box",
    brush: { name: "HB", color, weight: 1, hatch },
    duration: 1.6,
  },
});

const HATCH_CELLS: WcCell[] = [
  hatchBox("distance 3 · dense", { distance: 3, angle: 45 }),
  hatchBox("distance 6", { distance: 6, angle: 45 }),
  hatchBox("distance 11 · sparse", { distance: 11, angle: 45 }),
  hatchBox("angle 0°", { distance: 5, angle: 0 }, "#1971c2"),
  hatchBox("angle 90°", { distance: 5, angle: 90 }, "#1971c2"),
  hatchBox("angle -41°", { distance: 5, angle: -41 }, "#1971c2"),
  hatchBox("rand 0 · ruled", { distance: 5, angle: 60, rand: 0 }, "#5f3dc4"),
  hatchBox("rand 0.5 · scribbled", { distance: 5, angle: 60, rand: 0.5 }, "#5f3dc4"),
  hatchBox("hatch brush: pen", { distance: 5, angle: -41, brush: "pen" }, "#087f5b"),
  hatchBox("hatch brush: charcoal", { distance: 6, angle: -41, brush: "charcoal" }, "#087f5b"),
  hatchBox("hatch brush: marker", { distance: 7, angle: -41, brush: "marker", weight: 0.9 }, "#087f5b"),
  hatchBox("hatch brush: spray", { distance: 8, angle: -41, brush: "spray" }, "#087f5b"),
];

const COMBO_CELLS: WcCell[] = [
  {
    label: "circle + hatch",
    config: {
      type: "circle",
      brush: { name: "cpencil", color: "#d6336c", weight: 1.3, hatch: { distance: 5, angle: 30, rand: 0.1 } },
      duration: 1.8,
    },
  },
  {
    label: "contour + hatch",
    text: "cross-hatched hull around wrapped lines of text",
    config: {
      type: "contour",
      brush: { name: "2H", color: "#364fc7", weight: 1.2, hatch: { distance: 6, angle: -55, rand: 0.15 } },
      duration: 2,
    },
  },
  {
    label: "wash + hatch layered",
    config: {
      type: "box",
      brush: {
        name: "pen",
        color: "#5c940d",
        weight: 1,
        fill: { color: "#d8f5a2", opacity: 80, bleed: 0.2 },
        hatch: { distance: 7, angle: -41, rand: 0.1, brush: "2B" },
      },
      duration: 2.2,
    },
  },
  {
    label: "watercolor · double pass",
    config: {
      type: "highlight",
      highlightStyle: "watercolor",
      iterations: 2,
      brush: { fill: { color: "#66d9e8", opacity: 60, bleed: 0.3, texture: 0.6 } },
      duration: 2,
    },
  },
];

const wcAnnotations: BrushAnnotation[] = [];

function buildWcGallery(containerId: string, cells: WcCell[], defaultText: string): void {
  const container = $(containerId);
  for (const cell of cells) {
    const div = document.createElement("div");
    div.className = "cell";
    div.innerHTML = `<span class="label">${cell.label}</span><span class="target">${cell.text ?? defaultText}</span>`;
    container.appendChild(div);
    wcAnnotations.push(
      annotate(div.querySelector(".target") as HTMLElement, cell.config),
    );
  }
}

buildWcGallery("#wc-wash-gallery", WASH_CELLS, "wet pigment on paper");
buildWcGallery("#wc-shape-gallery", SHAPE_CELLS, "paint inside the lines");
buildWcGallery("#wc-hatch-gallery", HATCH_CELLS, "pencil fill patterns");
buildWcGallery("#wc-combo-gallery", COMBO_CELLS, "layered mixed media");

$("#replay-wc").addEventListener("click", () => replayAll(wcAnnotations, 0.06));
replayAll(wcAnnotations, 0.06);

// ---------------------------------------------------------------------------
// Stress test
// ---------------------------------------------------------------------------

const WORDS = [
  "gesso", "umber", "sienna", "ochre", "crimson", "viridian", "cerulean",
  "gouache", "impasto", "sfumato", "pentimento", "alla prima", "scumble",
  "glaze", "vermilion", "cadmium", "ultramarine", "titanium", "payne's gray",
  "burnt umber", "raw sienna", "sap green", "quinacridone", "phthalo",
  "alizarin", "naples yellow", "mars black", "zinc white", "cobalt", "indigo",
];
const stressGrid = $("#stress-grid");
const stressAnnotations: BrushAnnotation[] = [];
WORDS.forEach((word, i) => {
  const cell = document.createElement("div");
  cell.innerHTML = `<span>${word}</span>`;
  stressGrid.appendChild(cell);
  const type = TYPES[i % TYPES.length];
  stressAnnotations.push(
    annotate(cell.querySelector("span") as HTMLElement, {
      type: type === "contour" ? "circle" : type,
      brush: {
        name: ["2B", "pen", "marker", "charcoal", "HB"][i % 5],
        color: ["#c93030", "#1971c2", "#2b8a3e", "#e8590c", "#5f3dc4"][i % 5],
        weight: 1.1,
      },
      duration: 0.7,
      brackets: "left",
    }),
  );
});

function runStress(): void {
  replayAll(stressAnnotations, 0.05);
  $("#stress-count").textContent = String(stressAnnotations.length);
  setTimeout(() => {
    $("#gl-count").textContent = String(glContexts);
  }, 2600);
}
$("#replay-stress").addEventListener("click", runStress);
runStress();
