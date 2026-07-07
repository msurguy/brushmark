import * as brush from "p5.brush/standalone";
import type { StrokeSpec } from "../types";
import type { ResolvedBrush } from "./brushes";
import { paintStroke } from "./brushes";

const MAX_DEVICE_DIM = 4096;

export interface ArtLayer {
  /** Layer art snapshot, device px, same origin as the overlay */
  canvas: HTMLCanvasElement;
  layer: number;
}

export interface RenderJob {
  strokes: StrokeSpec[];
  resolved: ResolvedBrush;
  /** Content size in CSS px (the overlay canvas size) */
  widthCss: number;
  heightCss: number;
  dpr: number;
  seed: number;
}

/**
 * The single shared WebGL2 surface p5.brush paints on. Annotations render
 * here one at a time (synchronously) and the result is copied out to cheap
 * per-annotation 2D canvases, so the page never holds more than one GL
 * context regardless of how many annotations exist.
 */
class SharedGLRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private contextLost = false;

  private ensureCanvas(wDev: number, hDev: number): HTMLCanvasElement {
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.width = Math.min(MAX_DEVICE_DIM, Math.max(wDev, 512));
      this.canvas.height = Math.min(MAX_DEVICE_DIM, Math.max(hDev, 512));
      this.canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        this.contextLost = true;
      });
      this.canvas.addEventListener("webglcontextrestored", () => {
        this.contextLost = false;
      });
      brush.load(this.canvas);
      return this.canvas;
    }
    if (this.canvas.width < wDev || this.canvas.height < hDev) {
      this.canvas.width = Math.min(MAX_DEVICE_DIM, Math.max(this.canvas.width, wDev));
      this.canvas.height = Math.min(MAX_DEVICE_DIM, Math.max(this.canvas.height, hDev));
      brush.load(this.canvas);
    }
    return this.canvas;
  }

  get lost(): boolean {
    return this.contextLost;
  }

  /**
   * Render all strokes of a job, one snapshot per layer (layers may overlap
   * each other, e.g. crossed-off diagonals, so they are masked separately).
   */
  render(job: RenderJob): ArtLayer[] {
    let dpr = job.dpr;
    let wDev = Math.ceil(job.widthCss * dpr);
    let hDev = Math.ceil(job.heightCss * dpr);
    if (wDev > MAX_DEVICE_DIM || hDev > MAX_DEVICE_DIM) {
      // Soften resolution instead of breaking for huge annotations.
      const shrink = MAX_DEVICE_DIM / Math.max(wDev, hDev);
      dpr *= shrink;
      wDev = Math.ceil(job.widthCss * dpr);
      hDev = Math.ceil(job.heightCss * dpr);
    }
    const glCanvas = this.ensureCanvas(wDev, hDev);
    // brush.load() is required after any resize; it re-reads canvas dims.
    brush.load(glCanvas);

    const layerIds = [...new Set(job.strokes.map((s) => s.layer))].sort((a, b) => a - b);
    const out: ArtLayer[] = [];

    for (const layerId of layerIds) {
      brush.seed(job.seed + layerId * 101);
      brush.noiseSeed(job.seed + layerId * 101);
      // p5.brush's pigment mixing needs opaque paper to blend against —
      // clear to solid white, then key the paper out in the snapshot below.
      brush.clear(255, 255, 255);
      brush.push();
      // Origin is centered: shift to the top-left, then scale so annotation
      // coords (CSS px) land on device px. Brush stamp sizes follow the matrix.
      brush.translate(-glCanvas.width / 2, -glCanvas.height / 2);
      brush.scale(dpr);
      try {
        for (const stroke of job.strokes) {
          if (stroke.layer !== layerId) continue;
          paintStroke(stroke, job.resolved);
        }
      } finally {
        brush.pop();
      }
      brush.render();

      const art = document.createElement("canvas");
      art.width = Math.ceil(job.widthCss * job.dpr);
      art.height = Math.ceil(job.heightCss * job.dpr);
      const ctx = art.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        // (Stretches back up if resolution was softened for huge annotations.)
        ctx.drawImage(glCanvas, 0, 0, wDev, hDev, 0, 0, art.width, art.height);
        keyOutPaper(ctx, art.width, art.height);
      }
      out.push({ canvas: art, layer: layerId });
    }

    return out;
  }
}

/**
 * Convert paint-on-white-paper into true transparency: unpainted paper
 * (white) becomes alpha 0, pigment keeps its hue with alpha equal to its
 * ink density (a = 255 - min(r,g,b), c_ink = (c - (255-a)) * 255 / a).
 * Runs once per art snapshot, never per animation frame.
 */
function keyOutPaper(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const a = 255 - Math.min(r, g, b);
    if (a === 0) {
      d[i + 3] = 0;
      continue;
    }
    const paper = 255 - a;
    d[i] = Math.min(255, Math.round(((r - paper) * 255) / a));
    d[i + 1] = Math.min(255, Math.round(((g - paper) * 255) / a));
    d[i + 2] = Math.min(255, Math.round(((b - paper) * 255) / a));
    d[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
}

let shared: SharedGLRenderer | null = null;

export function getRenderer(): SharedGLRenderer {
  if (!shared) shared = new SharedGLRenderer();
  return shared;
}
