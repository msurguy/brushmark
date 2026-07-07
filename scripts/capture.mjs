// Record README GIFs of brushmark effects.
//
// Requires: a running dev server (`npm run dev`) and `ffmpeg` on PATH, plus
// `playwright` installed (dev-only). Drives demo/capture/index.html, stepping
// each annotation's timeline progress 0->1 and screenshotting the framed
// element per step, then assembles a looping GIF with ffmpeg.
//
// Usage:
//   BASE=http://localhost:5174 node scripts/capture.mjs
//   BASE=http://localhost:5174 node scripts/capture.mjs underline highlight

import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE ?? "http://localhost:5173";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "assets");

// Effects to feature in the README (skip looping/interactive ones).
const DEFAULT_IDS = [
  "underline",
  "highlight",
  "circle",
  "contour",
  "watercolor",
  "word-stagger",
];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_IDS;

const DRAW_FRAMES = 26; // frames spread across the reveal (t: 0 -> 1)
const HOLD_FRAMES = 14; // frames held on the finished art before looping
const FPS = 24;

function ffmpegGif(framesDir, out) {
  const palette = join(framesDir, "palette.png");
  const gen = spawnSync("ffmpeg", [
    "-y", "-framerate", String(FPS), "-i", join(framesDir, "f_%03d.png"),
    "-vf", "palettegen=stats_mode=full", palette,
  ]);
  if (gen.status !== 0) throw new Error("ffmpeg palettegen failed:\n" + gen.stderr);
  const use = spawnSync("ffmpeg", [
    "-y", "-framerate", String(FPS), "-i", join(framesDir, "f_%03d.png"),
    "-i", palette,
    "-lavfi", "paletteuse=dither=bayer:bayer_scale=3", "-loop", "0", out,
  ]);
  if (use.status !== 0) throw new Error("ffmpeg paletteuse failed:\n" + use.stderr);
}

async function capture(page, id) {
  await page.goto(`${BASE}/capture/index.html?id=${id}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
  const frame = page.locator("#capture-frame");
  await frame.waitFor();

  const tmp = mkdtempSync(join(tmpdir(), `brushmark-${id}-`));
  let n = 0;
  const shoot = async () => {
    const buf = await frame.screenshot({ type: "png" });
    writeFileSync(join(tmp, `f_${String(n).padStart(3, "0")}.png`), buf);
    n++;
  };

  for (let i = 0; i < DRAW_FRAMES; i++) {
    const t = i / (DRAW_FRAMES - 1);
    await page.evaluate((tt) => window.__seek?.(tt), t);
    // Let the rAF compositor paint this progress value.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
    await shoot();
  }
  for (let i = 0; i < HOLD_FRAMES; i++) await shoot();

  const out = join(ASSETS, `${id}.gif`);
  ffmpegGif(tmp, out);
  rmSync(tmp, { recursive: true, force: true });
  return out;
}

async function main() {
  mkdirSync(ASSETS, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  for (const id of ids) {
    try {
      const out = await capture(page, id);
      console.log(`✓ ${id} -> ${out}`);
    } catch (err) {
      console.error(`✗ ${id}:`, err.message);
    }
  }
  await browser.close();
}

main();
