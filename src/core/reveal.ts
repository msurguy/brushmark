import type { AnimationEngine } from "../animation/engine";
import type { LineRect, RevealDirection, StrokeSpec } from "../types";
import type { ArtLayer } from "./renderer";

export interface RevealGroup {
  /** Tween target */
  progress: { value: number };
  order: number;
  strokes: StrokeSpec[];
  lengthPx: number;
}

export interface RevealState {
  overlayCtx: CanvasRenderingContext2D;
  widthCss: number;
  heightCss: number;
  dpr: number;
  layers: ArtLayer[];
  groups: RevealGroup[];
  direction: RevealDirection;
  /** Global fade multiplier (used by hide('fade')) */
  alpha: { value: number };
  /** Engine whose ticker drives this state's repaints */
  engine: AnimationEngine;
  dirty: boolean;
}

// One scratch mask canvas shared by all annotations (flushes are sequential).
let maskCanvas: HTMLCanvasElement | null = null;

function getMask(w: number, h: number): CanvasRenderingContext2D {
  if (!maskCanvas) maskCanvas = document.createElement("canvas");
  if (maskCanvas.width < w) maskCanvas.width = w;
  if (maskCanvas.height < h) maskCanvas.height = h;
  const ctx = maskCanvas.getContext("2d");
  if (!ctx) throw new Error("brushmark: 2D context unavailable");
  return ctx;
}

function dashOffsetFor(direction: RevealDirection, total: number, revealed: number): number {
  switch (direction) {
    case "rtl":
      return -(total - revealed);
    case "center-out":
      return -((total - revealed) / 2);
    default:
      return 0;
  }
}

function tracePolyline(ctx: CanvasRenderingContext2D, stroke: StrokeSpec): void {
  const pts = stroke.polyline;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (stroke.closed) ctx.closePath();
}

function sweepRect(box: LineRect, direction: RevealDirection, t: number): LineRect {
  switch (direction) {
    case "rtl":
      return { x: box.x + box.w * (1 - t), y: box.y, w: box.w * t, h: box.h };
    case "center-out": {
      const w = box.w * t;
      return { x: box.x + (box.w - w) / 2, y: box.y, w, h: box.h };
    }
    default:
      return { x: box.x, y: box.y, w: box.w * t, h: box.h };
  }
}

/**
 * Composite the current progress state onto the overlay canvas.
 *
 * Model: strokes are grouped into snapshot LAYERS (spatially independent art)
 * and reveal GROUPS (animate as one). Groups never share strokes, and strokes
 * of different groups within one layer don't overlap spatially — so each
 * layer is composited exactly once per frame, masked by the union of its
 * groups' dash/sweep shapes at their individual progress values.
 */
export function compositeReveal(state: RevealState): void {
  const { overlayCtx, dpr } = state;
  const wDev = Math.ceil(state.widthCss * dpr);
  const hDev = Math.ceil(state.heightCss * dpr);
  overlayCtx.clearRect(0, 0, wDev, hDev);
  if (state.alpha.value <= 0) return;
  overlayCtx.save();
  overlayCtx.globalAlpha = state.alpha.value;

  const layerIds = [...new Set(state.layers.map((l) => l.layer))].sort((a, b) => a - b);

  for (const layerId of layerIds) {
    const art = state.layers.find((l) => l.layer === layerId)?.canvas;
    if (!art) continue;

    // Collect (stroke, progress) pairs for this layer.
    const entries: Array<{ stroke: StrokeSpec; t: number }> = [];
    for (const group of state.groups) {
      const t = Math.min(1, Math.max(0, group.progress.value));
      for (const stroke of group.strokes) {
        if (stroke.layer === layerId) entries.push({ stroke, t });
      }
    }
    if (entries.length === 0 || entries.every((e) => e.t <= 0)) continue;

    // Fade reveal: composite the art at the layer's progress alpha.
    if (entries[0].stroke.reveal === "fade") {
      const t = Math.min(...entries.map((e) => e.t));
      if (t <= 0) continue;
      overlayCtx.save();
      overlayCtx.globalAlpha = state.alpha.value * t;
      overlayCtx.drawImage(art, 0, 0, wDev, hDev);
      overlayCtx.restore();
      continue;
    }

    // Fully revealed layer: draw art directly, skip masking.
    if (entries.every((e) => e.t >= 1)) {
      overlayCtx.drawImage(art, 0, 0, wDev, hDev);
      continue;
    }

    // Partial: build a mask from every stroke at its group's progress.
    const mctx = getMask(wDev, hDev);
    mctx.save();
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.globalCompositeOperation = "source-over";
    mctx.clearRect(0, 0, wDev, hDev);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.strokeStyle = "#000";
    mctx.fillStyle = "#000";
    mctx.lineCap = "round";
    mctx.lineJoin = "round";

    for (const { stroke, t } of entries) {
      if (t <= 0) continue;
      if (stroke.reveal === "sweep") {
        const box = stroke.sweepBox ?? { x: 0, y: 0, w: state.widthCss, h: state.heightCss };
        const r = sweepRect(box, state.direction, t);
        if (r.w > 0 && r.h > 0) mctx.fillRect(r.x, r.y, r.w, r.h);
        continue;
      }
      const total = stroke.lengthPx;
      const revealed = total * t;
      if (revealed <= 0.01) continue;
      if (t >= 1) {
        mctx.setLineDash([]);
      } else {
        mctx.setLineDash([revealed, total + 10]);
        mctx.lineDashOffset = dashOffsetFor(state.direction, total, revealed);
      }
      mctx.lineWidth = stroke.maskWidth;
      tracePolyline(mctx, stroke);
      mctx.stroke();
      mctx.setLineDash([]);
    }

    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.globalCompositeOperation = "source-in";
    mctx.drawImage(art, 0, 0, wDev, hDev);
    mctx.restore();
    overlayCtx.drawImage(maskCanvas!, 0, 0, wDev, hDev, 0, 0, wDev, hDev);
  }

  overlayCtx.restore();
}

// ---------------------------------------------------------------------------
// Shared flush loop: one ticker callback per engine repaints dirty annotations.
// ---------------------------------------------------------------------------

const dirtyStates = new Set<RevealState>();
/** Engines whose ticker currently has `flush` installed. */
const installed = new Set<AnimationEngine>();

/**
 * One composite pass per ticker tick for every dirty annotation. On an idle
 * tick (nothing dirty) the flush stands down from every engine's ticker, so
 * no rAF loop is left running once all animations have finished; the next
 * markDirty() re-arms it.
 */
function flush(): void {
  if (dirtyStates.size === 0) {
    for (const engine of installed) engine.ticker.remove(flush);
    installed.clear();
    return;
  }
  for (const state of dirtyStates) {
    compositeReveal(state);
    state.dirty = false;
  }
  dirtyStates.clear();
}

export function markDirty(state: RevealState): void {
  state.dirty = true;
  dirtyStates.add(state);
  if (!installed.has(state.engine)) {
    installed.add(state.engine);
    state.engine.ticker.add(flush);
  }
}

/**
 * Composite every dirty annotation right now instead of on the next ticker
 * tick — for hosts that snapshot the overlay canvas synchronously after a
 * seek (e.g. cloning it into an <img>).
 */
export function flushReveals(): void {
  flush();
}

export function unregister(state: RevealState): void {
  dirtyStates.delete(state);
}
